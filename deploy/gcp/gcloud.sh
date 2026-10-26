#!/usr/bin/env bash
set -euo pipefail
: "${GCLOUD_BIN:=gcloud}"
: "${ASSEMBLY_GCP_PROJECT:=assembly-event-20261027}"
: "${ASSEMBLY_GCP_ACCOUNT:?Set ASSEMBLY_GCP_ACCOUNT to the authorized Google Cloud account}"
exec "$GCLOUD_BIN" --account="$ASSEMBLY_GCP_ACCOUNT" --project="$ASSEMBLY_GCP_PROJECT" --billing-project="$ASSEMBLY_GCP_PROJECT" "$@"
