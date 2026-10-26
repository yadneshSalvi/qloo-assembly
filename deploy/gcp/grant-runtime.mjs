import { pool } from '@assembly/domain';
const tables = [
  'assembly_workspaces', 'assembly_owner_workspaces', 'assembly_idempotency',
  'assembly_jobs', 'assembly_capabilities', 'assembly_public_idempotency',
  'assembly_rate_limits', 'assembly_provider_usage', 'assembly_provider_cache',
  'assembly_worker_health',
].map(name => `public.${name}`).join(', ');
try {
  await pool.query(`BEGIN;
    REVOKE cloudsqlsuperuser FROM assembly_app;
    ALTER ROLE assembly_app NOCREATEDB NOCREATEROLE;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    REVOKE ALL ON SCHEMA public FROM assembly_app;
    GRANT CONNECT ON DATABASE assembly TO assembly_app;
    GRANT USAGE ON SCHEMA public TO assembly_app;
    REVOKE ALL ON TABLE ${tables} FROM assembly_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tables} TO assembly_app;
    COMMIT;`);
  const role = (await pool.query("SELECT rolcreatedb,rolcreaterole,rolsuper FROM pg_roles WHERE rolname='assembly_app'")).rows[0];
  const membership = (await pool.query("SELECT pg_has_role('assembly_app','cloudsqlsuperuser','MEMBER') AS elevated")).rows[0];
  if (!role || role.rolcreatedb || role.rolcreaterole || role.rolsuper || membership.elevated) throw new Error('Unexpected runtime role privileges.');
  console.log('ASSEMBLY runtime role verified: CRUD on ten named application tables, no database/role creation or cloudsqlsuperuser membership.');
} catch (error) {
  console.error('ASSEMBLY database privilege configuration failed.', { code: /^[A-Z0-9]{5}$/.test(String(error?.code)) ? error.code : 'UNKNOWN' });
  process.exitCode = 1;
} finally { await pool.end(); }
