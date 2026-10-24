import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { ActionRequest, ActionResult, Workspace } from '@assembly/contracts';
import { ActionError, applyAction, type StoredWorkspace } from './actions';
import { concepts, createWorkspace } from './seed';

const globalDb = globalThis as typeof globalThis & { assemblyPool?: Pool };
export const pool = globalDb.assemblyPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const migration = `
CREATE TABLE IF NOT EXISTS assembly_workspaces (
 id uuid PRIMARY KEY, token_hash text UNIQUE NOT NULL, document jsonb NOT NULL,
 version integer NOT NULL CHECK(version > 0), expires_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assembly_idempotency (
 workspace_id uuid NOT NULL REFERENCES assembly_workspaces(id) ON DELETE CASCADE,
 key text NOT NULL, request_digest text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id, key)
);
CREATE TABLE IF NOT EXISTS assembly_jobs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES assembly_workspaces(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('QUEUED','RUNNING','COMPLETED','FAILED')),
 attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS assembly_job_queue ON assembly_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS assembly_workspace_expiry ON assembly_workspaces(expires_at);
`;
export async function migrate() { await pool.query(migration); }

async function transaction<T>(body: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await body(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function createSession(): Promise<{ token: string; workspace: Workspace }> {
  const token = randomBytes(32).toString('hex'), workspace = createWorkspace(randomUUID());
  await pool.query('INSERT INTO assembly_workspaces(id,token_hash,document,version,expires_at) VALUES($1,$2,$3,$4,$5)', [workspace.id, digest(token), { workspace, contactDigests: {} }, workspace.version, workspace.expiresAt]);
  return { token, workspace };
}

export async function readWorkspace(token: string): Promise<Workspace | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await pool.query<{ document: StoredWorkspace }>('SELECT document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now()', [digest(token)]);
  return rows[0]?.document.workspace ?? null;
}

export async function performAction(token: string, request: ActionRequest): Promise<ActionResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ActionError('forbidden', 'Open a sample workspace first.', 401);
  if (typeof request.idempotencyKey !== 'string' || request.idempotencyKey.length < 8 || request.idempotencyKey.length > 120 || !Number.isSafeInteger(request.expectedVersion)) throw new ActionError('validation', 'A request key and current version are required.', 400);
  const requestDigest = digest(JSON.stringify(request));
  return transaction(async client => {
    const { rows } = await client.query<{ id: string; document: StoredWorkspace }>('SELECT id,document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now() FOR UPDATE', [digest(token)]);
    const row = rows[0]; if (!row) throw new ActionError('forbidden', 'This sample expired. Open a fresh workspace.', 401);
    const prior = await client.query<{ request_digest: string; result: { message: string; token?: string } }>('SELECT request_digest,result FROM assembly_idempotency WHERE workspace_id=$1 AND key=$2', [row.id, request.idempotencyKey]);
    if (prior.rows[0]) {
      if (prior.rows[0].request_digest !== requestDigest) throw new ActionError('validation', 'That request key was used for a different action.', 409);
      return { workspace: row.document.workspace, ...prior.rows[0].result };
    }
    const result = applyAction(row.document, request);
    await client.query('UPDATE assembly_workspaces SET document=$2,version=$3,updated_at=now() WHERE id=$1', [row.id, row.document, result.workspace.version]);
    await client.query('INSERT INTO assembly_idempotency(workspace_id,key,request_digest,result) VALUES($1,$2,$3,$4)', [row.id, request.idempotencyKey, requestDigest, { message: result.message, ...(result.token ? { token: result.token } : {}) }]);
    if (request.type === 'RESEARCH' && result.workspace.run) await client.query('INSERT INTO assembly_jobs(id,workspace_id,status) VALUES($1,$2,$3)', [result.workspace.run.id, row.id, 'QUEUED']);
    return result;
  });
}

export async function resetWorkspace(token: string, expectedVersion: number, idempotencyKey: string): Promise<Workspace> {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 120) throw new ActionError('validation', 'A valid reset request key is required.', 400);
  return transaction(async client => {
    const { rows } = await client.query<{ id: string; document: StoredWorkspace }>('SELECT id,document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now() FOR UPDATE', [digest(token)]);
    const row = rows[0]; if (!row) throw new ActionError('forbidden', 'Open a fresh workspace.', 401);
    const requestDigest = digest(JSON.stringify({ type: 'RESET', expectedVersion, idempotencyKey }));
    const prior = await client.query<{ request_digest: string }>('SELECT request_digest FROM assembly_idempotency WHERE workspace_id=$1 AND key=$2', [row.id, idempotencyKey]);
    if (prior.rows[0]) {
      if (prior.rows[0].request_digest !== requestDigest) throw new ActionError('validation', 'Reset key was reused with different terms.', 409);
      return row.document.workspace;
    }
    if (row.document.workspace.version !== expectedVersion) throw new ActionError('stale_version', 'Refresh before resetting this changed workspace.', 409);
    const workspace = createWorkspace(row.id); workspace.version = expectedVersion + 1;
    workspace.audit[0].version = workspace.version;
    await client.query('DELETE FROM assembly_jobs WHERE workspace_id=$1', [row.id]);
    await client.query('UPDATE assembly_workspaces SET document=$2,version=$3,expires_at=$4,updated_at=now() WHERE id=$1', [row.id, { workspace, contactDigests: {} }, workspace.version, workspace.expiresAt]);
    await client.query('INSERT INTO assembly_idempotency(workspace_id,key,request_digest,result) VALUES($1,$2,$3,$4)', [row.id, idempotencyKey, requestDigest, { message: 'Sample reset.' }]);
    return workspace;
  });
}

/** Durable, leased sample jobs perform real catalog/constraint work without implying an AI call. */
export async function processNextJob(): Promise<boolean> {
  const job = await transaction(async client => {
    const result = await client.query<{ id: string; workspace_id: string; attempts: number }>(`SELECT id,workspace_id,attempts FROM assembly_jobs WHERE status='QUEUED' OR (status='RUNNING' AND lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    const job = result.rows[0]; if (!job) return null;
    await client.query(`UPDATE assembly_jobs SET status='RUNNING', attempts=attempts+1, lease_until=now()+interval '30 seconds' WHERE id=$1`, [job.id]);
    return job;
  });
  if (!job) return false;
  await transaction(async client => {
    const result = await client.query<{ document: StoredWorkspace }>('SELECT document FROM assembly_workspaces WHERE id=$1 AND expires_at>now() FOR UPDATE', [job.workspace_id]);
    const stored = result.rows[0]?.document;
    if (!stored || stored.workspace.run?.id !== job.id) { await client.query(`UPDATE assembly_jobs SET status='FAILED', last_error='Workspace expired or run superseded', lease_until=NULL WHERE id=$1`, [job.id]); return; }
    const w = stored.workspace;
    const capturedAt = new Date().toISOString();
    const eligible = concepts.filter(c => c.fixedCostMinor + c.variableCostMinor * w.venue.capacity <= w.brief.budgetMinor);
    if (job.attempts >= 3 || !eligible.length) {
      w.run!.status = 'FAILED'; w.run!.stage = job.attempts >= 3 ? 'Research needs a retry' : 'Needs a revised brief'; w.run!.error = job.attempts >= 3 ? 'The worker could not complete this run within its retry budget. Your brief is saved.' : 'No authored concept fits this capacity and budget. Adjust the brief and retry.'; w.event.lifecycle = 'DRAFT';
    } else {
      w.concepts = structuredClone(eligible); w.run!.status = 'COMPLETED'; w.run!.stage = 'Authored concepts ready';
      w.run!.milestones = [{ label: 'Read the saved brief', at: capturedAt }, { label: 'Checked sample inventory and budget', at: capturedAt }, { label: 'Prepared authored editorial concepts', at: capturedAt }];
      w.event.lifecycle = 'CONCEPT_READY';
    }
    w.version++; w.audit.push({ id: randomUUID(), action: 'RESEARCH_COMPLETED', description: w.run!.error ?? 'The sample worker prepared budget-eligible authored concepts. No Qloo call occurred.', at: capturedAt, version: w.version });
    await client.query('UPDATE assembly_workspaces SET document=$2,version=$3,updated_at=now() WHERE id=$1', [job.workspace_id, stored, w.version]);
    await client.query('UPDATE assembly_jobs SET status=$2,lease_until=NULL,completed_at=now() WHERE id=$1', [job.id, w.run!.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED']);
  });
  return true;
}

export async function purgeExpired() { await pool.query('DELETE FROM assembly_workspaces WHERE expires_at<=now()'); }
