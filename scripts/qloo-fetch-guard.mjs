/** Preloaded only in the official harness subprocess: one bounded GET, no retry or redirect. */
export function boundedQlooFetch(fetchImpl, operation) {
  let requests = 0;
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const path = operation === 'search' ? '/search' : '/v2/insights';
    if (!['search', 'insights'].includes(operation) || url.origin !== 'https://hackathon.api.qloo.com' || url.pathname !== path || method.toUpperCase() !== 'GET' || url.username || url.password) throw new Error('Request outside the Qloo boundary.');
    if (++requests > 1) throw new Error('Qloo request allowance exhausted.');
    const prior = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const response = await fetchImpl(input, { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(12000), ...(prior ? [prior] : [])]) });
    // Buffer once under a byte cap. Neither upstream diagnostics nor raw rows are logged.
    const reader = response.body?.getReader();
    const chunks = []; let size = 0;
    if (reader) {
      try {
        while (true) {
          const next = await reader.read(); if (next.done) break;
          size += next.value.byteLength;
          if (size > 512000) throw new Error('Qloo response exceeded its byte limit.');
          chunks.push(next.value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
    }
    return new Response(Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}
if (process.env.ASSEMBLY_QLOO_FETCH_GUARD === '1') globalThis.fetch = boundedQlooFetch(globalThis.fetch, process.env.ASSEMBLY_QLOO_OPERATION);
