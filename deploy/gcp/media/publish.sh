#!/usr/bin/env bash
set -euo pipefail
# Invoke after release review checks the final media and publication is authorized.
: "${ASSEMBLY_MEDIA_BUILD_DIR:?Set ASSEMBLY_MEDIA_BUILD_DIR to the exact prepared build directory}"
: "${ASSEMBLY_MEDIA_IMAGE:?Set ASSEMBLY_MEDIA_IMAGE to a unique Artifact Registry release tag}"
: "${ASSEMBLY_GCP_PROJECT:=assembly-event-20261027}"
: "${ASSEMBLY_REGION:=us-central1}"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
gc=${ASSEMBLY_GCLOUD_WRAPPER:-"$script_dir/../gcloud.sh"}
"$gc" builds submit "$ASSEMBLY_MEDIA_BUILD_DIR" --config="$script_dir/cloudbuild.yaml" \
  --service-account="projects/$ASSEMBLY_GCP_PROJECT/serviceAccounts/assembly-build@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com" \
  --substitutions="_IMAGE=$ASSEMBLY_MEDIA_IMAGE" --quiet
"$gc" run deploy assembly-demo --region="$ASSEMBLY_REGION" --image="$ASSEMBLY_MEDIA_IMAGE" \
  --service-account="assembly-media@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com" \
  --port=8080 --cpu=1 --memory=512Mi --cpu-throttling --execution-environment=gen2 \
  --min=0 --min-instances=0 --max=1 --max-instances=1 --concurrency=40 --timeout=300 \
  --no-invoker-iam-check --quiet
"$gc" run services describe assembly-demo --region="$ASSEMBLY_REGION" --format='value(status.url)'
