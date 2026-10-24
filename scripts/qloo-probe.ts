import { QlooHarness } from '@assembly/qloo';
const harness = new QlooHarness();
try {
  const capability = await harness.connect();
  console.log(JSON.stringify({ ...capability, message: capability.ready ? 'Harness configured; no authenticated API request was made.' : 'Harness installed; awaiting Qloo credential. No API request was made.' }, null, 2));
} finally { await harness.close(); }
