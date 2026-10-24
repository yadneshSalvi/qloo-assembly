import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { countsFor, type ActionType } from '@assembly/contracts';
import { ActionError, applyAction, concepts, createWorkspace, type StoredWorkspace } from '@assembly/domain';

function fixture() { return { workspace: createWorkspace(randomUUID()), contactDigests: {} } satisfies StoredWorkspace; }
function act(s: StoredWorkspace, type: ActionType, payload: Record<string, unknown> = {}) {
  return applyAction(s, { type, payload, expectedVersion: s.workspace.version, idempotencyKey: randomUUID() });
}
function prepared(s: StoredWorkspace) {
  s.workspace.concepts = structuredClone(concepts); s.workspace.event.lifecycle = 'CONCEPT_READY';
  act(s, 'SELECT_CONCEPT', { conceptId: 'blue-hour' }); act(s, 'PUBLISH', { termsHash: s.workspace.terms.hash });
  for (const supplierId of ['low-lights', 'little-table']) act(s, 'CONFIRM_SUPPLIER', { supplierId });
  for (const r of s.workspace.requirements) act(s, 'CONFIRM_REQUIREMENT', { requirementId: r.id, proof: 'Sample operator checklist reviewed.' });
  act(s, 'GREENLIGHT', { termsHash: s.workspace.terms.hash }); act(s, 'OPEN_BOOKING');
}
function interest(s: StoredWorkspace, email = 'guest@example.test', quantity = 1) {
  const result = act(s, 'EXPRESS_INTEREST', { name: 'Sample Guest', email, quantity, consent: true, termsVersion: s.workspace.terms.version });
  act(s, 'VERIFY_INTEREST', { token: result.token, termsVersion: s.workspace.terms.version });
  return s.workspace.commitments.at(-1)!;
}

describe('production authority and exact terms', () => {
  it('keeps each concept’s public program, supplier scope and schedule consistent', () => {
    for (const [conceptId, supplierName, treatment] of [['night-garden', 'Frame Club', 'short-film'], ['soft-signals', 'Paper & Sound', 'print workshop']]) {
      const s = fixture(); s.workspace.concepts = structuredClone(concepts); s.workspace.event.lifecycle = 'CONCEPT_READY';
      act(s, 'SELECT_CONCEPT', { conceptId });
      expect(s.workspace.terms.program).toContain(supplierName);
      expect(s.workspace.runOfShow.find(item => item.id === 'music')?.detail).toContain(treatment);
      expect(JSON.stringify(s.workspace.runOfShow)).not.toContain('Nila');
      expect(s.workspace.runOfShow.map(item => item.time)).toEqual(s.workspace.runOfShow.map(item => item.time).sort());
    }
  });
  it('rebuilds the schedule and invalidates confirmed supply when timing changes', () => {
    const s = fixture(); s.workspace.concepts = structuredClone(concepts); s.workspace.event.lifecycle = 'CONCEPT_READY';
    act(s, 'SELECT_CONCEPT', { conceptId: 'blue-hour' }); act(s, 'CONFIRM_SUPPLIER', { supplierId: 'low-lights' });
    act(s, 'SAVE_BRIEF', { brief: { ...s.workspace.brief, doors: '18:00', end: '21:30' } });
    expect(s.workspace.runOfShow.find(item => item.id === 'music')?.time).toBe('18:30');
    expect(s.workspace.suppliers.find(item => item.id === 'low-lights')?.status).toBe('QUOTED');
    expect(s.workspace.venue.availability).toBe('UNCONFIRMED');
    expect(() => act(s, 'SAVE_BRIEF', { brief: { ...s.workspace.brief, doors: '20:00', end: '21:00' } })).toThrow('three hours');
  });
  it('does not treat a concept or unverified supply as a greenlight', () => {
    const s = fixture(); expect(() => act(s, 'GREENLIGHT', { termsHash: s.workspace.terms.hash })).toThrow(ActionError);
    s.workspace.concepts = structuredClone(concepts); s.workspace.event.lifecycle = 'CONCEPT_READY'; act(s, 'SELECT_CONCEPT', { conceptId: 'blue-hour' }); act(s, 'PUBLISH', { termsHash: s.workspace.terms.hash });
    expect(() => act(s, 'GREENLIGHT', { termsHash: s.workspace.terms.hash })).toThrow('unresolved');
  });
  it('rejects stale versions, unknown fields and stale approval hashes', () => {
    const s = fixture();
    expect(() => applyAction(s, { type: 'CONFIRM_AVAILABILITY', payload: {}, expectedVersion: 0, idempotencyKey: randomUUID() })).toThrow('changed');
    expect(() => act(s, 'CONFIRM_AVAILABILITY', { approveEverything: true })).toThrow('unsupported');
    s.workspace.concepts = structuredClone(concepts); s.workspace.event.lifecycle = 'CONCEPT_READY'; act(s, 'SELECT_CONCEPT', { conceptId: 'blue-hour' });
    expect(() => act(s, 'PUBLISH', { termsHash: 'old' })).toThrow('changed');
  });
  it('blocks an event outside curfew or budget', () => {
    const s = fixture(); s.workspace.concepts = structuredClone(concepts); s.workspace.event.lifecycle = 'CONCEPT_READY'; act(s, 'SELECT_CONCEPT', { conceptId: 'blue-hour' });
    s.workspace.brief.end = '23:00'; expect(() => act(s, 'PUBLISH', { termsHash: s.workspace.terms.hash })).toThrow('feasible');
    s.workspace.brief.end = '22:00'; s.workspace.brief.budgetMinor = 100; expect(() => act(s, 'PUBLISH', { termsHash: s.workspace.terms.hash })).toThrow('feasible');
  });
  it('never silently falls back from live research to authored results', () => {
    const s = fixture(); expect(() => act(s, 'RESEARCH', { mode: 'LIVE' })).toThrow('not connected'); expect(s.workspace.run).toBeNull();
  });
});

describe('interest, bookings and attendance are different facts', () => {
  it('deduplicates contacts and counts only verified choices as verified', () => {
    const s = fixture(); prepared(s);
    act(s, 'EXPRESS_INTEREST', { name: 'Guest', email: 'one@example.test', quantity: 2, consent: true, termsVersion: s.workspace.terms.version });
    expect(countsFor(s.workspace)).toMatchObject({ interested: 2, pending: 2, verified: 0, bookings: 0 });
    expect(() => interest(s, 'ONE@example.test')).toThrow('already');
  });
  it('requires verification, prevents duplicate allocation and cannot oversell', () => {
    const s = fixture(); prepared(s); s.workspace.venue.capacity = 1;
    const first = interest(s); act(s, 'BOOK', { commitmentId: first.id });
    const second = interest(s, 'other@example.test'); expect(() => act(s, 'BOOK', { commitmentId: second.id })).toThrow('remaining');
    expect(() => act(s, 'BOOK', { commitmentId: first.id })).toThrow('already'); expect(countsFor(s.workspace).remaining).toBe(0);
    act(s, 'WITHDRAW_INTEREST', { token: first.token, termsVersion: s.workspace.terms.version }); expect(countsFor(s.workspace).remaining).toBe(1);
  });
  it('does not accept check-in before readiness or complete before live', () => {
    const s = fixture(); prepared(s); const c = interest(s); act(s, 'BOOK', { commitmentId: c.id });
    expect(() => act(s, 'CHECK_IN', { bookingId: s.workspace.bookings[0].id })).toThrow('ready'); expect(() => act(s, 'COMPLETE_EVENT')).toThrow('Start');
  });
});

describe('recovery preserves capacity and asks for renewed consent', () => {
  it('pauses, reviews the replacement, invalidates commitments and preserves held seats until resolved', () => {
    const s = fixture(); prepared(s); const c = interest(s, 'guest@example.test', 2); act(s, 'BOOK', { commitmentId: c.id });
    const oldVersion = s.workspace.terms.version, remaining = countsFor(s.workspace).remaining;
    act(s, 'DISRUPT', { supplierId: 'low-lights' }); expect(s.workspace.event.bookingPaused).toBe(true);
    expect(() => act(s, 'APPROVE_CHANGE', { termsHash: s.workspace.terms.hash })).toThrow('availability');
    act(s, 'CONFIRM_SUPPLIER', { supplierId: 'sunday-people' }); act(s, 'APPROVE_CHANGE', { termsHash: s.workspace.terms.hash, changeId: s.workspace.change!.id });
    expect(s.workspace.terms.version).toBe(oldVersion + 1); expect(countsFor(s.workspace).remaining).toBe(remaining);
    expect(countsFor(s.workspace).bookings).toBe(0); expect(s.workspace.bookings[0].status).toBe('RECONFIRM_REQUIRED');
    expect(() => act(s, 'RESUME_BOOKING')).toThrow('Resolve');
    act(s, 'RECONFIRM', { token: c.token, termsVersion: s.workspace.terms.version }); act(s, 'RESUME_BOOKING');
    expect(s.workspace.bookings[0].status).toBe('CONFIRMED'); expect(s.workspace.event.bookingPaused).toBe(false);
  });
  it('requires dependency evidence then records sample completion', () => {
    const s = fixture(); prepared(s); const c = interest(s); act(s, 'BOOK', { commitmentId: c.id });
    expect(() => act(s, 'COMPLETE_TASK', { taskId: 'front', evidence: 'Checked.' })).toThrow('preceding');
    for (const task of s.workspace.tasks) act(s, 'COMPLETE_TASK', { taskId: task.id, evidence: 'Sample operator verified this task.' });
    act(s, 'MARK_READY'); act(s, 'CHECK_IN', { bookingId: s.workspace.bookings[0].id }); act(s, 'START_EVENT'); act(s, 'COMPLETE_EVENT');
    expect(s.workspace.event.lifecycle).toBe('COMPLETED'); expect(countsFor(s.workspace).checkins).toBe(1);
  });
});
