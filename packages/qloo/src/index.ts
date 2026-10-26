import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
export * from './live';

export type WorkflowStatus = 'ok' | 'empty' | 'needs_input' | 'partial' | 'degraded' | 'error';
export interface WorkflowEnvelope {
  status: WorkflowStatus; operation: string; summary?: string; results?: unknown; result_count?: number;
  error?: { code: string; layer: string; retryable: boolean; recovery: string };
}
export interface HarnessCapability {
  ready: boolean; contractVersion: string; contractChecksum: string; tools: string[];
  checkedAt: string; liveCallMade: false;
}
export class QlooBoundaryError extends Error {
  constructor(public code: 'NOT_CONFIGURED' | 'CONTRACT' | 'BUDGET' | 'INPUT' | 'TRANSPORT', message: string) { super(message); }
}
const statuses = new Set<WorkflowStatus>(['ok', 'empty', 'needs_input', 'partial', 'degraded', 'error']);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseEnvelope(raw: unknown, operation: string): WorkflowEnvelope {
  if (!record(raw) || !statuses.has(raw.status as WorkflowStatus) || raw.operation !== operation) throw new QlooBoundaryError('CONTRACT', 'Qloo returned an unexpected workflow contract.');
  if (raw.status === 'error' && (!record(raw.error) || typeof raw.error.code !== 'string' || typeof raw.error.layer !== 'string' || typeof raw.error.retryable !== 'boolean' || typeof raw.error.recovery !== 'string')) throw new QlooBoundaryError('CONTRACT', 'Qloo returned an invalid error contract.');
  if (raw.summary !== undefined && typeof raw.summary !== 'string') throw new QlooBoundaryError('CONTRACT', 'Qloo summary was malformed.');
  if (raw.result_count !== undefined && (!Number.isSafeInteger(raw.result_count) || Number(raw.result_count) < 0)) throw new QlooBoundaryError('CONTRACT', 'Qloo result count was malformed.');
  return raw as unknown as WorkflowEnvelope;
}
export function validateConfirmedIds(ids: string[], label: string) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 10 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new QlooBoundaryError('INPUT', `${label} must contain one to ten unique, explicitly confirmed Qloo entity UUIDs.`);
}

/** Server worker only. Readiness is not authentication verification or a successful live call. */
export class QlooHarness {
  private client = new Client({ name: 'assembly-worker', version: '0.1.0' });
  private connected = false;
  private capability: HarnessCapability | null = null;
  constructor(private readonly settings: { maxCalls?: number; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}) {
    if (!Number.isSafeInteger(settings.maxCalls ?? 6) || (settings.maxCalls ?? 6) < 1 || (settings.maxCalls ?? 6) > 20) throw new QlooBoundaryError('BUDGET', 'Set a finite run budget of one to twenty tool calls.');
    if (!Number.isSafeInteger(settings.timeoutMs ?? 20000) || (settings.timeoutMs ?? 20000) < 100 || (settings.timeoutMs ?? 20000) > 60000) throw new QlooBoundaryError('BUDGET', 'Tool timeouts must be between 100 and 60000 milliseconds.');
  }
  private options() { return { timeout: this.settings.timeoutMs ?? 20000, maxTotalTimeout: this.settings.timeoutMs ?? 20000, resetTimeoutOnProgress: false }; }
  async connect(): Promise<HarnessCapability> {
    if (this.connected && this.capability) return this.capability;
    const harnessEntry = import.meta.resolve('@qloo/qloo-harness');
    const binary = fileURLToPath(new URL('./bin.js', harnessEntry));
    const sourceEnv = this.settings.env ?? process.env;
    if (sourceEnv.QLOO_BASE_URL && sourceEnv.QLOO_BASE_URL !== 'https://hackathon.api.qloo.com') throw new QlooBoundaryError('INPUT', 'This event build uses the Qloo hackathon endpoint.');
    const env = { NODE_ENV: 'production', PATH: sourceEnv.PATH ?? '', QLOO_API_KEY: sourceEnv.QLOO_API_KEY ?? '', QLOO_HOME: resolve('.data/qloo-worker'), QLOO_BASE_URL: 'https://hackathon.api.qloo.com', QLOO_TRUSTED_BASE_URL: 'https://hackathon.api.qloo.com' };
    const transport = new StdioClientTransport({ command: process.execPath, args: [binary, 'mcp'], env, stderr: 'pipe' });
    // Never echo the child's stderr: upstream diagnostics can contain request context.
    transport.stderr?.on('data', () => undefined);
    try {
      await this.client.connect(transport, this.options());
      this.connected = true;
      const tools = await this.client.listTools({}, this.options());
      const result = await this.client.callTool({ name: 'qloo_capabilities', arguments: {} }, undefined, this.options());
      const raw = result.structuredContent;
      if (!record(raw) || !record(raw.adapter) || typeof raw.adapter.ready !== 'boolean' || typeof raw.contract_version !== 'string' || typeof raw.contract_checksum !== 'string') throw new QlooBoundaryError('CONTRACT', 'The official harness returned invalid capabilities.');
      this.capability = { ready: raw.adapter.ready, contractVersion: raw.contract_version, contractChecksum: raw.contract_checksum, tools: tools.tools.map(tool => tool.name), checkedAt: new Date().toISOString(), liveCallMade: false };
      return this.capability;
    } catch (error) {
      await this.close();
      if (error instanceof QlooBoundaryError) throw error;
      throw new QlooBoundaryError('TRANSPORT', 'The local Qloo harness could not be started. Check the installed runtime and worker configuration.');
    }
  }
  async close() { await this.client.close().catch(() => undefined); this.connected = false; this.capability = null; }
}
