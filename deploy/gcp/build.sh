#!/usr/bin/env bash
set -euo pipefail
# Run from ASSEMBLY only after the release source is frozen.
: "${ASSEMBLY_IMAGE:?Set ASSEMBLY_IMAGE to a unique Artifact Registry release tag}"
: "${ASSEMBLY_GCP_PROJECT:=assembly-event-20261027}"
gc=${ASSEMBLY_GCLOUD_WRAPPER:-./deploy/gcp/gcloud.sh}
"$gc" builds submit . --config=deploy/gcp/cloudbuild.yaml \
  --service-account="projects/$ASSEMBLY_GCP_PROJECT/serviceAccounts/assembly-build@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com" \
  --substitutions="_IMAGE=$ASSEMBLY_IMAGE" --quiet
