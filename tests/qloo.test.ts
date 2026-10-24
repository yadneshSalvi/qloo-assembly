import { describe, expect, it } from 'vitest';
import { parseEnvelope, QlooHarness, validateConfirmedIds } from '@assembly/qloo';

describe('Qloo worker boundary', () => {
  it('preserves every documented non-error state without claiming successful ranking', () => {
    for (const status of ['ok', 'empty', 'needs_input', 'partial', 'degraded']) expect(parseEnvelope({ status, operation: 'rank', results: [] }, 'rank').status).toBe(status);
  });
  it('requires the expected workflow and a valid error contract', () => {
    expect(() => parseEnvelope({ status: 'ok', operation: 'describe' }, 'rank')).toThrow();
    expect(() => parseEnvelope({ status: 'error', operation: 'rank', error: {} }, 'rank')).toThrow();
    const error = { code: 'QLOO_AUTH', layer: 'qloo', retryable: false, recovery: 'Configure the event key' };
    expect(parseEnvelope({ status: 'error', operation: 'rank', error }, 'rank').error?.retryable).toBe(false);
  });
  it('will not silently truncate or batch-combine an oversized candidate pool', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`);
    expect(() => validateConfirmedIds(ids, 'Options')).toThrow();
    expect(() => validateConfirmedIds(ids.slice(0, 10), 'Options')).not.toThrow();
    expect(() => validateConfirmedIds([ids[0], ids[0]], 'Options')).toThrow();
    expect(() => validateConfirmedIds(['an unresolved name'], 'Options')).toThrow();
  });
  it('rejects infinite or invalid tool budgets', () => {
    expect(() => new QlooHarness({ maxCalls: Infinity })).toThrow();
    expect(() => new QlooHarness({ maxCalls: 0 })).toThrow();
  });
});
