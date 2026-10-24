import { processNextJob, purgeExpired, pool } from '@assembly/domain';
let stopped = false;
process.once('SIGINT', () => { stopped = true; });
process.once('SIGTERM', () => { stopped = true; });
console.log('ASSEMBLY sample worker started. Live Qloo research is not enabled.');
let ticks = 0;
try {
  while (!stopped) {
    try {
      const worked = await processNextJob();
      if (++ticks % 300 === 0) await purgeExpired();
      if (!worked) await new Promise(resolve => setTimeout(resolve, 750));
    } catch (error) {
      console.error('Worker step failed; the durable lease will permit recovery.', error instanceof Error ? error.name : 'Unknown error');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
} finally { await pool.end(); }
