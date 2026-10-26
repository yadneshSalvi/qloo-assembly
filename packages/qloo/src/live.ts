import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { CatalogCandidate, CulturalType } from '@assembly/contracts';

export const QLOO_ADAPTER_VERSION = 'assembly-harness-api-0.1.26-v1';
export const SUPPORTED_CULTURAL_TYPES = ['artist', 'movie', 'book', 'person', 'brand', 'place'] as const;
export class ProviderError extends Error {
  constructor(public code: 'CONFIGURATION' | 'INPUT' | 'TIMEOUT' | 'UPSTREAM' | 'MALFORMED' | 'BUDGET' | 'CANCELLED' | 'STALE' | 'GROUNDING', message: string) { super(message); this.name = 'ProviderError'; }
}
const uuid = z.uuid().transform(value => value.toLowerCase());
const types = z.enum(SUPPORTED_CULTURAL_TYPES);
const safeText = (value: string, max = 300) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
export type QlooRequest = { operation: 'search'; entityType: CulturalType; query: string } | { operation: 'insights'; entityType: CulturalType; signals: string[]; candidates?: string[]; take: number };
export interface QlooEntity { entityId: string; entityType: CulturalType; name: string; affinity: number | null; }
export type QlooTransport = (request: QlooRequest, signal?: AbortSignal) => Promise<unknown>;
export function validateQlooRequest(request: QlooRequest): QlooRequest {
  if (!types.safeParse(request.entityType).success) throw new ProviderError('INPUT', 'Choose a supported cultural category.');
  if (request.operation === 'search') {
    if (typeof request.query !== 'string' || !request.query.trim() || request.query.length > 160 || /[\u0000-\u001f]/.test(request.query)) throw new ProviderError('INPUT', 'Enter a short cultural catalog query.');
    return { ...request, query: request.query.trim() };
  }
  if (request.operation !== 'insights' || !Number.isInteger(request.take) || request.take < 1 || request.take > 5) throw new ProviderError('INPUT', 'Insights accepts one to five results.');
  const ids = (values: string[]) => {
    const result = z.array(uuid).min(1).max(10).safeParse(values);
    if (!result.success || new Set(result.data).size !== result.data.length) throw new ProviderError('INPUT', 'Use one to ten distinct, confirmed entity IDs.');
    return result.data;
  };
  return { ...request, signals: ids(request.signals), ...(request.candidates ? { candidates: ids(request.candidates) } : {}) };
}
const rowSchema = z.object({
  entity_id: uuid, name: z.string().min(1).max(500).optional(),
  types: z.array(z.string()).max(10).optional(), type: z.string().optional(), subtype: z.string().optional(),
  disambiguation: z.string().max(2000).optional(), query: z.object({ affinity: z.number().finite().optional() }).optional(),
});
function parseRows(raw: unknown, entityType: CulturalType, limit: number) {
  const parsed = z.array(rowSchema).max(limit).safeParse(raw);
  if (!parsed.success) throw new ProviderError('MALFORMED', 'Qloo returned an unsupported result. No identity or recommendation was substituted.');
  const seen = new Set<string>(); const expected = `urn:entity:${entityType}`;
  for (const row of parsed.data) {
    const declared = [...(row.types ?? []), ...(row.type ? [row.type] : []), ...(row.subtype ? [row.subtype] : [])];
    if (!declared.includes(expected) || declared.some(type => type !== expected && type !== 'urn:entity') || seen.has(row.entity_id)) throw new ProviderError('MALFORMED', 'Qloo returned a duplicate or wrong-category result.');
    seen.add(row.entity_id);
  }
  return parsed.data;
}
export function parseSearchResults(raw: unknown, entityType: CulturalType): CatalogCandidate[] {
  return parseRows(raw, entityType, 5).map(row => {
    if (!row.name) throw new ProviderError('MALFORMED', 'Catalog results need an explicit canonical name.');
    return { entityId: row.entity_id, entityType, name: safeText(row.name), disambiguation: safeText(row.disambiguation ?? '') };
  });
}
export function parseInsightsResults(raw: unknown, request: Extract<QlooRequest, { operation: 'insights' }>, knownNames: Map<string, string> = new Map()): QlooEntity[] {
  return parseRows(raw, request.entityType, request.take).map(row => {
    if (request.candidates && !request.candidates.includes(row.entity_id)) throw new ProviderError('MALFORMED', 'Qloo returned an entity outside the confirmed influence pool.');
    const name = row.name ?? knownNames.get(row.entity_id);
    if (!name) throw new ProviderError('MALFORMED', 'A cultural discovery lacked a canonical name.');
    return { entityId: row.entity_id, entityType: request.entityType, name: safeText(name), affinity: row.query?.affinity ?? null };
  });
}
export function officialQlooArguments(input: QlooRequest): string[] {
  const request = validateQlooRequest(input);
  if (request.operation === 'search') return ['api', 'search', '--query', request.query, '--type', request.entityType, '--take', '5', '--json'];
  return ['api', 'insights', '--type', request.entityType, '--signal-entities', request.signals.join(','), ...(request.candidates ? ['--params', JSON.stringify({ 'filter.results.entities': request.candidates })] : []), '--take', String(request.take), '--json'];
}
const runFile = promisify(execFile);
/** Uses only the installed official harness. Arguments are constructed, never model-provided commands. */
export function officialQlooTransport(env: NodeJS.ProcessEnv = process.env): QlooTransport {
  return async (request, signal) => {
    signal?.throwIfAborted();
    if (!env.QLOO_API_KEY?.trim() || (env.QLOO_BASE_URL && env.QLOO_BASE_URL !== 'https://hackathon.api.qloo.com')) throw new ProviderError('CONFIGURATION', 'Live Qloo is not configured. Saved authored examples remain separate.');
    const bin = fileURLToPath(new URL('./bin.js', import.meta.resolve('@qloo/qloo-harness')));
    const guard = fileURLToPath(new URL('../../../scripts/qloo-fetch-guard.mjs', import.meta.url));
    try {
      const { stdout } = await runFile(process.execPath, ['--import', guard, bin, ...officialQlooArguments(request)], {
        timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 512000, encoding: 'utf8', signal,
        env: { NODE_ENV: 'production', PATH: env.PATH, QLOO_HOME: resolve('.data/qloo-worker'), QLOO_API_KEY: env.QLOO_API_KEY.trim(), QLOO_BASE_URL: 'https://hackathon.api.qloo.com', QLOO_TRUSTED_BASE_URL: 'https://hackathon.api.qloo.com', ASSEMBLY_QLOO_FETCH_GUARD: '1', ASSEMBLY_QLOO_OPERATION: request.operation },
      });
      try { return JSON.parse(stdout); } catch { throw new ProviderError('MALFORMED', 'Qloo returned invalid JSON.'); }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal?.aborted) throw new ProviderError('CANCELLED', 'Research was cancelled.');
      const timedOut = !!error && typeof error === 'object' && 'killed' in error && error.killed;
      throw new ProviderError(timedOut ? 'TIMEOUT' : 'UPSTREAM', timedOut ? 'Qloo exceeded its deadline. No sample result was substituted.' : 'Qloo could not complete this single-request lookup. No sample result was substituted.');
    }
  };
}
