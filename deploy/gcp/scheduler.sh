#!/usr/bin/env bash
set -euo pipefail
: "${ASSEMBLY_GCP_PROJECT:=assembly-event-20261027}"
: "${ASSEMBLY_REGION:=us-central1}"
gc=${ASSEMBLY_GCLOUD_WRAPPER:-./deploy/gcp/gcloud.sh}
worker_url=$("$gc" run services describe assembly-worker --region="$ASSEMBLY_REGION" --format='value(status.url)')
if "$gc" scheduler jobs describe assembly-worker-recovery --location="$ASSEMBLY_REGION" --format='value(name)' >/dev/null 2>&1; then mode=update; headers=(--update-headers=Content-Type=application/json); else mode=create; headers=(--headers=Content-Type=application/json); fi
"$gc" scheduler jobs "$mode" http assembly-worker-recovery --location="$ASSEMBLY_REGION" \
  --schedule='* * * * *' --time-zone=Etc/UTC --uri="$worker_url/dispatch" --http-method=POST \
  "${headers[@]}" --message-body='{}' \
  --oidc-service-account-email="assembly-invoker@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com" \
  --oidc-token-audience="$worker_url" --attempt-deadline=180s \
  --max-retry-attempts=1 --min-backoff=30s --max-backoff=300s --quiet
