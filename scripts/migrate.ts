import { migrate, pool } from '@assembly/domain';
try { await migrate(); console.log('ASSEMBLY database schema is ready.'); } finally { await pool.end(); }
