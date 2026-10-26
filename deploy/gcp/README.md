# ASSEMBLY on Google Cloud

The dedicated project is `assembly-event-20261027` in `us-central1`. This deployment
has one public Cloud Run web service, an IAM-private request-driven worker, a
serialized Cloud Tasks queue, and private-IP Cloud SQL PostgreSQL 17. No deployment
command changes another product or the shared gcloud default project/account.

The worker handles one bounded `/dispatch` request at a time. Cloud Tasks supplies
an OIDC token for the dedicated invoker identity; a minute-by-minute Cloud Scheduler
request with `{}` recovers durable queued or expired work. There is no background
polling in Cloud Run mode. Official Qloo harness CLI calls run inside bounded jobs,
not as an unsupported persistent MCP server. Provider results remain labelled as
evidence, interpretations, or authored sample material by the application.

## Runtime boundaries

- Web: `node node_modules/next/dist/bin/next start apps/web --hostname 0.0.0.0`,
  `PORT=8080`, 512 MiB, minimum 1 / maximum 2 instances, pool 4.
- Worker: `node --import tsx apps/worker/index.ts`, 1 GiB, minimum 0 / maximum 1,
  concurrency 1, 180-second HTTP deadline, pool 2. Research is bounded to 90 seconds and at most four model calls, including one
  proposal correction.
- Both use Direct VPC egress to `assembly-private/assembly-run`; there is no paid
  VPC connector. PostgreSQL has no public IP and uses its exact mounted server CA.
  Worker HTTP startup probes at `/health` check database connectivity/configuration. Web uses
  a TCP startup probe plus the separate database smoke job: public health must
  remain honest when the persisted worker heartbeat is not yet recent.
- The web receives only its runtime database URL and CA. Qloo/OpenAI credentials
  are mounted only on the worker. The migration identity has a separate database
  URL and no provider keys. Never put secret values in command arguments or logs.
- Runtime SQL grants enumerate the ten current `public.assembly_*` tables. They
  grant only SELECT/INSERT/UPDATE/DELETE, remove `cloudsqlsuperuser`, CREATEDB and
  CREATEROLE, and remove public-schema CREATE. No other public tables or sequences
  are granted. New tables require a deliberate update to the grant list.

The public web uses Google's documented `--no-invoker-iam-check` setting because
organization policy restricts `allUsers` IAM bindings. Worker IAM checks stay
explicitly enabled and only `assembly-invoker` receives its service invoker role.

## Releasing

Run from the ASSEMBLY repository. Set `ASSEMBLY_GCP_ACCOUNT` to the authorized
account and optionally `GCLOUD_BIN` to your installed SDK. The wrapper always
passes the account, project and quota project explicitly. Alternatively set
`ASSEMBLY_GCLOUD_WRAPPER` to a private wrapper that provides the same isolation.
The project foundation, database roles and Secret Manager versions must exist.
Before first public traffic, run `./deploy/gcp/configure-logging.sh`. Deployment
also enforces this step. Its enabled `_Default` sink exclusion omits Cloud Run
request URLs for `/commitments/*`, `/collaborate/*`, `/api/participants/*`, and
`/api/suppliers/*`, including case/encoded-slash variants. These paths contain
private possession tokens. The exclusion preserves unrelated diagnostics and
other sink exclusions. This deployment enables no custom tracing. Do not log
capability URLs from application code or add tracing that records those URLs.

1. Freeze compatible application/worker source after the required checks. Set
   `ASSEMBLY_IMAGE` to a unique Artifact Registry tag and run `./deploy/gcp/build.sh`.
   The build context excludes credentials, private plans, generated caches and
   provider data. The image keeps pnpm workspace links and the official CLI intact.
2. Replace `ASSEMBLY_IMAGE` with the build's immutable digest. Set the exact
   `ASSEMBLY_MIGRATION_SECRET_VERSION`, `ASSEMBLY_DB_SECRET_VERSION`,
   `ASSEMBLY_CA_SECRET_VERSION`, `ASSEMBLY_QLOO_SECRET_VERSION`, and
   `ASSEMBLY_OPENAI_SECRET_VERSION`. These are version numbers, not secret values.
3. Run `./deploy/gcp/migrate.sh`, `./deploy/gcp/grant-runtime.sh`, and
   `./deploy/gcp/verify-runtime.sh`. They use private one-task Cloud Run Jobs,
   no retries and no provider calls. Temporary grant/smoke jobs are removed after
   success. Migration retains an advisory transaction lock. Grant and smoke scripts
   import the application's own domain pool, preserving identical TLS behavior.
   Smoke verifies all four DML permissions on each table, absence of elevated
   roles/schema CREATE, trusted connectivity, and rejection of an unrelated CA.
4. Run `./deploy/gcp/deploy.sh`. It publishes the worker first, binds only its
   invoker, initializes automatic recovery, then publishes web and pins its HTTPS `APP_ORIGIN` for browser-origin
   checks and Secure cookies. Existing Secret Manager versions stay pinned.
5. `./deploy/gcp/scheduler.sh` can update the recovery configuration idempotently.
   Verify automatic recovery, public `/api/health`,
   unauthenticated worker `/health` returning 403, authenticated worker readiness,
   and a user-initiated web → Tasks → worker job. Synthetic checks are not proof
   of successful live provider evidence.

Never upload `.env`, private plans, catalog dumps, participant records or raw
provider responses. TLS uses `DATABASE_SSL_MODE=verify-ca` with the exact unique
instance CA mounted at `DATABASE_SSL_CA_FILE=/secrets/sql-ca.pem`. Chain validation
stays enabled. This mode relies on Cloud SQL's per-instance
`GOOGLE_MANAGED_INTERNAL_CA` identity; it must not be used with a shared CA or a
public trust bundle. Do not disable TLS validation to make a deployment pass.
Cloud Run reserves some paths ending in `z`; use `/health` for external worker
readiness. `/healthz` remains a local compatibility alias.
Public readiness can be degraded while a newly provisioned scheduler initializes.
Cloud Scheduler's first job in a new project can take a few minutes to start.

## Limits, cost and recovery

The zonal `db-f1-micro` uses 10 GiB SSD and has no high availability or Cloud SQL
SLA. Along with one warm request-billed web instance, estimated fixed infrastructure
is roughly US$20–25/month before active workload, network/build/registry usage and
provider billing. Maximum instances, one-at-a-time dispatch and persisted global /
workspace daily provider limits remain bounded. Hosted worker limits are 64 / 12
Qloo calls and 90 / 12 model calls per global / workspace day respectively. Source/local Qloo defaults remain 24 global calls;
the hosted override of 64 permits several fresh judging walkthroughs while keeping
the workspace limit at 12 and per-job Qloo limit at 6. No automatic provider calls
are added by this allowance.

Keep database backups and deletion protection enabled. On an application rollback,
route web and worker to the prior compatible image revision without resetting data.
Schema rollback requires an explicit reviewed migration or a database restore;
never run a destructive reset against production. Pin secret versions and preserve
migration compatibility when releasing forward again.

References: [Cloud Run pricing](https://cloud.google.com/run/pricing),
[Cloud SQL pricing](https://cloud.google.com/sql/pricing),
[authenticated Tasks delivery](https://docs.cloud.google.com/run/docs/triggering/using-tasks),
[public access](https://docs.cloud.google.com/run/docs/authenticating/public),
[Cloud SQL TLS identity](https://docs.cloud.google.com/sql/docs/postgres/configure-ssl-instance),
[first scheduler job](https://docs.cloud.google.com/scheduler/docs/schedule-run-cron-job).
