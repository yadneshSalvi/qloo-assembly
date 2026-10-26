import { pool } from '@assembly/domain';
import { rootCertificates } from 'node:tls';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const expectedTables = [
  'assembly_workspaces', 'assembly_owner_workspaces', 'assembly_idempotency',
  'assembly_jobs', 'assembly_capabilities', 'assembly_public_idempotency',
  'assembly_rate_limits', 'assembly_provider_usage', 'assembly_provider_cache',
  'assembly_worker_health',
];
const trustErrors = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY']);
if (process.argv.includes('--negative-ca')) {
  try { await pool.query('SELECT 1'); process.exitCode = 1; }
  catch (error) { process.exitCode = trustErrors.has(error?.code) ? 0 : 1; }
  finally { await pool.end(); }
} else {
  let folder;
  try {
    await pool.query('SELECT 1');
    const roles = (await pool.query("SELECT rolcreatedb,rolcreaterole,rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0];
    const rights = (await pool.query("SELECT pg_has_role(current_user,'cloudsqlsuperuser','MEMBER') AS elevated,has_schema_privilege(current_user,'public','CREATE') AS ddl")).rows[0];
    if (!roles || roles.rolcreatedb || roles.rolcreaterole || roles.rolsuper || rights.elevated || rights.ddl) throw new Error('Runtime role is elevated.');
    for (const table of expectedTables) {
      const privileges = (await pool.query("SELECT bool_and(has_table_privilege(current_user,$1,permission)) AS crud FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[]) AS rights(permission)", [`public.${table}`])).rows[0];
      if (!privileges.crud) throw new Error('Missing application table access.');
    }
    folder = await mkdtemp(join(tmpdir(), 'assembly-ca-negative-'));
    const wrongCa = join(folder, 'unrelated-ca.pem');
    await writeFile(wrongCa, rootCertificates[0], { mode: 0o600 });
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', 'deploy/gcp/verify-runtime.mjs', '--negative-ca'], {
        env: { ...process.env, DATABASE_SSL_CA_FILE: wrongCa }, stdio: 'ignore', timeout: 15000,
      });
      child.once('error', reject); child.once('close', resolve);
    });
    if (code !== 0) throw new Error('Wrong-CA rejection was not verified.');
    console.log('ASSEMBLY runtime smoke passed: trusted private TLS, wrong CA rejected, ten table grants, no elevated role/schema rights.');
  } catch (error) {
    console.error('ASSEMBLY runtime smoke failed.', { code: /^[A-Z0-9_]{5,60}$/.test(String(error?.code)) ? error.code : 'CHECK_FAILED' });
    process.exitCode = 1;
  } finally { await pool.end(); if (folder) await rm(folder, { recursive: true, force: true }); }
}
