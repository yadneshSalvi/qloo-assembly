#!/usr/bin/env bash
set -euo pipefail
# Run from ASSEMBLY after release freeze, migration and runtime grants succeed.
: "${ASSEMBLY_IMAGE:?Set ASSEMBLY_IMAGE to the immutable release image}"
: "${ASSEMBLY_GCP_PROJECT:=assembly-event-20261027}"
: "${ASSEMBLY_REGION:=us-central1}"
: "${ASSEMBLY_DB_SECRET_VERSION:?Set the runtime database secret version}"
: "${ASSEMBLY_CA_SECRET_VERSION:?Set the database CA secret version}"
: "${ASSEMBLY_QLOO_SECRET_VERSION:?Set the Qloo secret version}"
: "${ASSEMBLY_OPENAI_SECRET_VERSION:?Set the OpenAI secret version}"
gc=${ASSEMBLY_GCLOUD_WRAPPER:-./deploy/gcp/gcloud.sh}
worker_sa="assembly-worker@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com"
web_sa="assembly-web@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com"
invoker_sa="assembly-invoker@$ASSEMBLY_GCP_PROJECT.iam.gserviceaccount.com"
db_secrets="DATABASE_URL=assembly-database-url:$ASSEMBLY_DB_SECRET_VERSION,/secrets/sql-ca.pem=assembly-sql-ca:$ASSEMBLY_CA_SECRET_VERSION"
./deploy/gcp/configure-logging.sh
common=(--image="$ASSEMBLY_IMAGE" --region="$ASSEMBLY_REGION" --network=assembly-private --subnet=assembly-run --vpc-egress=private-ranges-only --cpu=1 --cpu-throttling --execution-environment=gen2 --min-instances=0 --quiet)
"$gc" run deploy assembly-worker "${common[@]}" \
  --service-account="$worker_sa" --memory=1Gi --min=0 --max=1 --max-instances=1 --concurrency=1 --timeout=180 \
  --startup-probe=httpGet.path=/health,httpGet.port=8080,timeoutSeconds=5,periodSeconds=10,failureThreshold=24 \
  --invoker-iam-check --no-allow-unauthenticated --command=node --args=--import,tsx,apps/worker/index.ts \
  --set-env-vars=WORKER_AUTH_MODE=cloud-run,DATABASE_SSL_MODE=verify-ca,DATABASE_SSL_CA_FILE=/secrets/sql-ca.pem,DATABASE_POOL_MAX=2,QLOO_BASE_URL=https://hackathon.api.qloo.com,OPENAI_MODEL=gpt-6.1-sol,QLOO_DAILY_CALL_LIMIT=64,QLOO_WORKSPACE_DAILY_CALL_LIMIT=12,MODEL_DAILY_CALL_LIMIT=90,MODEL_WORKSPACE_DAILY_CALL_LIMIT=12 \
  --set-secrets="$db_secrets,QLOO_API_KEY=assembly-qloo-api-key:$ASSEMBLY_QLOO_SECRET_VERSION,OPENAI_API_KEY=assembly-openai-api-key:$ASSEMBLY_OPENAI_SECRET_VERSION"
"$gc" run services add-iam-policy-binding assembly-worker --region="$ASSEMBLY_REGION" \
  --member="serviceAccount:$invoker_sa" --role=roles/run.invoker --quiet
worker_url=$("$gc" run services describe assembly-worker --region="$ASSEMBLY_REGION" --format='value(status.url)')
./deploy/gcp/scheduler.sh
"$gc" run deploy assembly-web "${common[@]}" \
  --service-account="$web_sa" --memory=512Mi --min=0 --max=2 --max-instances=2 --concurrency=20 --timeout=60 \
  --startup-probe=tcpSocket.port=8080,timeoutSeconds=1,periodSeconds=10,failureThreshold=24 \
  --no-invoker-iam-check --set-secrets="$db_secrets" \
  --set-env-vars="WORKER_AUTH_MODE=cloud-run,DATABASE_SSL_MODE=verify-ca,DATABASE_SSL_CA_FILE=/secrets/sql-ca.pem,DATABASE_POOL_MAX=4,WORKER_URL=$worker_url,GOOGLE_CLOUD_PROJECT=$ASSEMBLY_GCP_PROJECT,ASSEMBLY_TASKS_LOCATION=$ASSEMBLY_REGION,ASSEMBLY_TASKS_QUEUE=assembly-research,ASSEMBLY_TASKS_INVOKER_SERVICE_ACCOUNT=$invoker_sa"
web_url=$("$gc" run services describe assembly-web --region="$ASSEMBLY_REGION" --format='value(status.url)')
"$gc" run services update assembly-web --region="$ASSEMBLY_REGION" --update-env-vars="APP_ORIGIN=$web_url" --quiet
printf '%s\n' "$web_url"
