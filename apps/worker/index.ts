import { createServer } from 'node:http';
import { pool, processNextJob, purgeExpired } from '@assembly/domain';
import { executeResearchJob, type ResearchRuntime } from '@assembly/research';
import * as store from '@assembly/domain';
import { ProviderError } from '@assembly/qloo';
import type { ClaimedResearchJob } from '@assembly/contracts';
import { workerDispatchAuthorized } from './auth';

let stopped = false, active = false, lastHeartbeat = Date.now(), ticks = 0;
let lastTickFailure: string | null = null;
const cloudRunMode = process.env.WORKER_AUTH_MODE === 'cloud-run';
let finishShutdown: (() => void) | undefined;
const controller = new AbortController();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** One active claim per process; Postgres leases arbitrate across worker instances. */
async function tick(jobId?: string) {
  if (active || stopped) return false;
  active = true;
  try {
    const worked = await processNextJob(async (job: ClaimedResearchJob) => {
      const runtime: ResearchRuntime = {
        signal: controller.signal,
        checkpoint: (stage, trace) => store.checkpointJob(job.id, job.leaseToken, stage, trace),
        reserve: (provider, units) => store.reserveProviderCall(job.id, job.leaseToken, provider, units),
        cacheGet: key => store.providerCacheGet(key),
        cachePut: (key, value, ttlMs) => store.providerCachePut(key, value, ttlMs),
      };
      try { return await executeResearchJob(job, runtime); }
      catch (error) {
        // No provider response body, prompt, stderr, key, URL or stack is logged.
        if (error instanceof ProviderError) throw new store.ActionError(error.code === 'INPUT' || error.code === 'GROUNDING' ? 'validation' : error.code === 'BUDGET' ? 'capacity' : error.code === 'STALE' || error.code === 'CANCELLED' ? 'stale_version' : 'upstream', error.message, error.code === 'BUDGET' ? 429 : 422);
        if (error instanceof store.ActionError) throw error;
        throw new store.ActionError('upstream', 'Live research stopped safely. Saved inputs and prior evidence are preserved.');
      }
    }, jobId);
    if (++ticks % 300 === 0) await purgeExpired();
    lastHeartbeat = Date.now();
    lastTickFailure = null;
    return worked;
  } catch (error) {
    lastTickFailure = new Date().toISOString();
    throw error;
  } finally { active = false; }
}
const port = Number(process.env.PORT ?? process.env.WORKER_PORT ?? 8080);
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET' && (request.url === '/health' || request.url === '/healthz')) {
    let database: 'ready' | 'unavailable' = 'ready';
    try { await pool.query('SELECT 1'); } catch { database = 'unavailable'; }
    const providerConfiguration = {
      qloo: !!process.env.QLOO_API_KEY?.trim() && (!process.env.QLOO_BASE_URL || process.env.QLOO_BASE_URL === 'https://hackathon.api.qloo.com'),
      model: !!process.env.OPENAI_API_KEY?.trim() && (!process.env.OPENAI_MODEL || process.env.OPENAI_MODEL === 'gpt-6.1-sol'),
    };
    const healthy = !stopped && database === 'ready' && providerConfiguration.qloo && providerConfiguration.model && !lastTickFailure && (cloudRunMode || Date.now() - lastHeartbeat < 180000);
    response.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: healthy ? 'ok' : 'degraded', process: stopped ? 'stopping' : 'alive', database, providerConfiguration, active, heartbeatAt: new Date(lastHeartbeat).toISOString(), lastFailureAt: lastTickFailure })); return;
  }
  if (request.method !== 'POST' || request.url !== '/dispatch') { response.writeHead(404); response.end(); return; }
  if (!workerDispatchAuthorized(request.headers.authorization)) { response.writeHead(401); response.end(); return; }
  if (Number(request.headers['content-length'] ?? 0) > 1024) { response.writeHead(413); response.end(); return; }
  if (active) { response.writeHead(429); response.end(); return; }
  let body = '';
  try {
    for await (const chunk of request) { body += chunk.toString(); if (Buffer.byteLength(body) > 1024) { response.writeHead(413); response.end(); return; } }
    const payload: unknown = body ? JSON.parse(body) : {};
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(key => key !== 'jobId')) { response.writeHead(400); response.end(); return; }
    const jobId = 'jobId' in payload ? payload.jobId : undefined;
    if (jobId !== undefined && (typeof jobId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId))) { response.writeHead(400); response.end(); return; }
    if (active) { response.writeHead(429); response.end(); return; }
    const worked = await tick(jobId as string | undefined); response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ accepted: true, worked, active }));
  }
  catch { response.writeHead(503, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'Worker step stopped; durable state is preserved.' })); }
});
server.listen(port, '0.0.0.0', () => console.log('ASSEMBLY durable worker ready.'));
const stop = () => { stopped = true; controller.abort(); server.close(); finishShutdown?.(); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  if (cloudRunMode) await new Promise<void>(resolve => { finishShutdown = resolve; });
  while (!cloudRunMode && !stopped) {
    try { const worked = await tick(); if (!worked) await pause(750); }
    catch { console.error('Worker step stopped; durable lease recovery remains available.'); await pause(2000); }
  }
} finally { await pool.end(); }
