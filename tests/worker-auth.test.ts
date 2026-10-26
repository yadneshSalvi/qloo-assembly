import { describe, expect, it } from 'vitest';
import { workerDispatchAuthorized } from '../apps/worker/auth';

describe('worker dispatch identity', () => {
  it('requires a configured long local token and exact Bearer match', () => {
    const secret = 'synthetic-dispatch-test-token-0000000000';
    expect(workerDispatchAuthorized(undefined, {})).toBe(false);
    expect(workerDispatchAuthorized('Bearer short', { WORKER_DISPATCH_TOKEN: 'short' })).toBe(false);
    expect(workerDispatchAuthorized(`Bearer ${secret}`, { WORKER_DISPATCH_TOKEN: secret })).toBe(true);
    expect(workerDispatchAuthorized(`Bearer ${secret}x`, { WORKER_DISPATCH_TOKEN: secret })).toBe(false);
  });
  it('requires the Cloud Run environment when relying on platform IAM and preserves OIDC', () => {
    expect(workerDispatchAuthorized('Bearer synthetic-google-oidc', { WORKER_AUTH_MODE: 'cloud-run' })).toBe(false);
    expect(workerDispatchAuthorized('Bearer synthetic-google-oidc', { WORKER_AUTH_MODE: 'cloud-run', K_SERVICE: 'assembly-worker' })).toBe(true);
  });
});
