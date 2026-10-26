#!/usr/bin/env bash
set -euo pipefail
: "${ASSEMBLY_IMAGE:?Set ASSEMBLY_IMAGE to the immutable release image}"
: "${ASSEMBLY_GCP_PROJECT:=assembly-event-20261027}"
: "${ASSEMBLY_MIGRATION_SECRET_VERSION:?Set the migration database secret version}"
: "${ASSEMBLY_CA_SECRET_VERSION:?Set the database CA secret version}"
gc=${ASSEMBLY_GCLOUD_WRAPPER:-./deploy/gcp/gcloud.sh}
"$gc" run jobs deploy assembly-runtime-grants --region=us-central1 --image="$ASSEMBLY_IMAGE" \
  --service-account="assembly-migrator@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com" \
  --network=assembly-private --subnet=assembly-run --vpc-egress=private-ranges-only \
  --cpu=1 --memory=512Mi --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=120s \
  --command=node --args=--import,tsx,deploy/gcp/grant-runtime.mjs \
  --set-env-vars=DATABASE_SSL_MODE=verify-ca,DATABASE_SSL_CA_FILE=/secrets/sql-ca.pem \
  --set-secrets="DATABASE_URL=assembly-migration-database-url:$ASSEMBLY_MIGRATION_SECRET_VERSION,/secrets/sql-ca.pem=assembly-sql-ca:$ASSEMBLY_CA_SECRET_VERSION" --quiet
"$gc" run jobs execute assembly-runtime-grants --region=us-central1 --wait --quiet
"$gc" run jobs delete assembly-runtime-grants --region=us-central1 --quiet
