import { describe, expect, it, vi } from 'vitest';
import { boundedQlooFetch } from '../scripts/qloo-fetch-guard.mjs';

describe('one-request Qloo subprocess guard', () => {
  it('allows only a fixed GET origin/path, forbids redirect and retry, and carries a deadline', async () => {
    const fetch = vi.fn(async (_input: unknown, options: RequestInit) => { expect(options.redirect).toBe('error'); expect(options.signal).toBeInstanceOf(AbortSignal); return new Response('[]'); });
    const guarded = boundedQlooFetch(fetch, 'search');
    await expect(guarded('https://wrong.example/search')).rejects.toThrow();
    await expect(guarded('https://hackathon.api.qloo.com/v2/insights')).rejects.toThrow();
    await expect(guarded('https://hackathon.api.qloo.com/search', { method: 'POST' })).rejects.toThrow();
    expect(await (await guarded('https://hackathon.api.qloo.com/search?query=Synthetic')).text()).toBe('[]');
    await expect(guarded('https://hackathon.api.qloo.com/search')).rejects.toThrow('allowance');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('caps bytes even when Content-Length is absent', async () => {
    const guarded = boundedQlooFetch(async () => new Response('x'.repeat(512001)), 'insights');
    await expect(guarded('https://hackathon.api.qloo.com/v2/insights')).rejects.toThrow('byte limit');
  });
  it('honors cancellation without permitting another request', async () => {
    const controller = new AbortController(); controller.abort();
    const guarded = boundedQlooFetch(async (_input: unknown, options: RequestInit) => { options.signal?.throwIfAborted(); return new Response('[]'); }, 'search');
    await expect(guarded('https://hackathon.api.qloo.com/search', { signal: controller.signal })).rejects.toThrow();
    await expect(guarded('https://hackathon.api.qloo.com/search')).rejects.toThrow('allowance');
  });
});
