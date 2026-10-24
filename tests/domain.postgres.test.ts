import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnvFile } from 'node:process';
import { countsFor, type ActionType, type Workspace } from '@assembly/contracts';
// The suite is opt-in and uses only newly created disposable sample workspaces.
try { loadEnvFile('.env.local'); } catch { /* CI can set DATABASE_URL directly. */ }
const enabled = process.env.ASSEMBLY_DB_TEST === '1';
const created: string[] = [];
describe.skipIf(!enabled)('PostgreSQL durability and concurrent writes', () => {
  let domain: typeof import('@assembly/domain');
  beforeAll(async () => { domain = await import('@assembly/domain'); await domain.migrate(); });
  afterAll(async () => { if (created.length) await domain.pool.query('DELETE FROM assembly_workspaces WHERE id=ANY($1::uuid[])', [created]); await domain.pool.end(); });
  async function session() { const value = await domain.createSession(); created.push(value.workspace.id); return value; }
  async function act(token: string, type: ActionType, payload: Record<string, unknown> = {}) {
    const w = (await domain.readWorkspace(token))!;
    return domain.performAction(token, { type, payload, expectedVersion: w.version, idempotencyKey: randomUUID() });
  }
  async function ready(token: string) {
    await act(token, 'RESEARCH', { mode: 'SAMPLE' }); while (await domain.processNextJob()) { /* drain actual test jobs */ }
    await act(token, 'SELECT_CONCEPT', { conceptId: 'blue-hour' }); let w = (await domain.readWorkspace(token))!;
    await act(token, 'SAVE_VENUE', { venue: { ...w.venue, capacity: 1 } }); await act(token, 'CONFIRM_AVAILABILITY'); w = (await domain.readWorkspace(token))!;
    await act(token, 'PUBLISH', { termsHash: w.terms.hash });
    for (const supplierId of ['low-lights', 'little-table']) await act(token, 'CONFIRM_SUPPLIER', { supplierId });
    for (const r of w.requirements) await act(token, 'CONFIRM_REQUIREMENT', { requirementId: r.id, proof: 'Database test fixture approval.' });
    w = (await domain.readWorkspace(token))!; await act(token, 'GREENLIGHT', { termsHash: w.terms.hash }); await act(token, 'OPEN_BOOKING');
    for (const email of ['first@example.test', 'second@example.test']) {
      w = (await domain.readWorkspace(token))!; const r = await act(token, 'EXPRESS_INTEREST', { name: 'Sample', email, quantity: 1, consent: true, termsVersion: w.terms.version });
      await act(token, 'VERIFY_INTEREST', { token: r.token, termsVersion: w.terms.version });
    }
  }
  it('keeps sessions isolated and replays an identical request without repeating its effect', async () => {
    const a = await session(), b = await session();
    const request = { type: 'CONFIRM_AVAILABILITY' as const, payload: {}, expectedVersion: a.workspace.version, idempotencyKey: randomUUID() };
    const first = await domain.performAction(a.token, request), second = await domain.performAction(a.token, request);
    expect(first.workspace.version).toBe(second.workspace.version); expect((await domain.readWorkspace(b.token))!.version).toBe(1);
    await expect(domain.performAction(a.token, { ...request, payload: { extra: true } })).rejects.toThrow('different');
    expect(await domain.readWorkspace('0'.repeat(64))).toBeNull();
  });
  it('serializes competing last-seat writes and rechecks capacity after refreshing', async () => {
    const a = await session(); await ready(a.token); const w = (await domain.readWorkspace(a.token))!;
    const attempts = w.commitments.map(c => domain.performAction(a.token, { type: 'BOOK', payload: { commitmentId: c.id }, expectedVersion: w.version, idempotencyKey: randomUUID() }));
    const results = await Promise.allSettled(attempts);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const current = (await domain.readWorkspace(a.token))!; expect(countsFor(current).bookings).toBe(1); expect(countsFor(current).remaining).toBe(0);
    const loser = current.commitments.find(c => !current.bookings.some(b => b.commitmentId === c.id))!;
    await expect(act(a.token, 'BOOK', { commitmentId: loser.id })).rejects.toThrow('remaining');
  });
  it('reset cannot be overwritten by a previously queued research job', async () => {
    const a = await session(); const queued = await act(a.token, 'RESEARCH', { mode: 'SAMPLE' });
    const reset = await domain.resetWorkspace(a.token, queued.workspace.version, randomUUID());
    while (await domain.processNextJob()) { /* any remaining jobs are unrelated */ }
    const current: Workspace = (await domain.readWorkspace(a.token))!;
    expect(current.version).toBe(reset.version); expect(current.run).toBeNull(); expect(current.event.lifecycle).toBe('DRAFT');
  });
  it('exhausted worker leases fail honestly and preserve the saved brief', async () => {
    const a = await session(); const queued = await act(a.token, 'RESEARCH', { mode: 'SAMPLE' });
    await domain.pool.query("UPDATE assembly_jobs SET status='RUNNING',attempts=3,lease_until=now()-interval '1 second' WHERE id=$1", [queued.workspace.run!.id]);
    await domain.processNextJob();
    const current = (await domain.readWorkspace(a.token))!;
    expect(current.run!.status).toBe('FAILED'); expect(current.run!.error).toContain('retry budget');
    expect(current.brief).toEqual(a.workspace.brief); expect(current.concepts).toHaveLength(0);
  });
});
