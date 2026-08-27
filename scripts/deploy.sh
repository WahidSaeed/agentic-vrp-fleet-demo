#!/usr/bin/env bash
# Synthetic conference demo - no real data.
# One-command deploy for the fleet demo stack. Reads config from infra/samconfig.toml.
set -euo pipefail
cd "$(dirname "$0")/.."

STACK="${STACK_NAME:-fleet-demo}"
REGION="${AWS_REGION:-eu-central-1}"

if [ ! -f infra/samconfig.toml ]; then
  echo "infra/samconfig.toml not found. Copy infra/samconfig.toml.example and edit it." >&2
  exit 1
fi

# Dedicated per-demo artifact bucket - created here, removed by teardown.sh.
# We deliberately do NOT use `sam deploy --resolve-s3` / the shared
# aws-sam-cli-managed-default stack, so this demo owns 100% of its footprint.
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ARTIFACT_BUCKET="${STACK}-artifacts-${ACCOUNT_ID}-${REGION}"

if ! aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" 2>/dev/null; then
  echo ">> creating artifact bucket $ARTIFACT_BUCKET"
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION"
  fi
  aws s3api put-public-access-block --bucket "$ARTIFACT_BUCKET" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-tagging --bucket "$ARTIFACT_BUCKET" \
    --tagging "TagSet=[{Key=Project,Value=aws-community-day-demo},{Key=Demo,Value=fleet}]"
fi

echo ">> sam validate"
sam validate --template infra/fleet-demo.yaml --lint

echo ">> sam build"
sam build --template infra/fleet-demo.yaml

# deploy from the built template (.aws-sam/build) so CodeUri points at built artifacts
echo ">> sam deploy ($STACK)"
sam deploy --config-file "$(pwd)/infra/samconfig.toml" --stack-name "$STACK" \
  --s3-bucket "$ARTIFACT_BUCKET" --s3-prefix "$STACK"

get_out() { aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }

WS_URL=$(get_out WebSocketUrl)
WS_TOKEN=$(get_out DemoWsToken)
STREAM=$(get_out TelemetryStreamName)
SITE_BUCKET=$(get_out SiteBucketName)
DIST_ID=$(get_out SiteDistributionId)
SITE_URL=$(get_out SiteUrl)

echo ">> building + publishing frontend to $SITE_BUCKET"
# .env.production is gitignored; it bakes the live WS endpoint into the bundle so
# the ?live toggle works. The demo token is demo-grade (rotate per event).
cat > frontend/.env.production <<ENV
VITE_DEMO_MODE=replay
VITE_WS_URL=$WS_URL
VITE_WS_TOKEN=$WS_TOKEN
VITE_REPLAY_URL=/session.json
ENV
( cd frontend && npm ci --silent && npm run build )
aws s3 sync frontend/dist/ "s3://$SITE_BUCKET/" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

echo ">> outputs"
aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs" --output table

cat <<EOF

Hosted frontend:  $SITE_URL           (replay mode, always works)
Live end-to-end:  $SITE_URL/?live     (drives the deployed WebSocket API)
  (CloudFront can take a few minutes to serve the first deploy.)

Local dev / simulator:
  1. frontend/.env.local already targets the stack for \`npm run dev\`
  2. ./scripts/seed-data.sh
  3. node simulator/index.js run --stream $STREAM --region $REGION --vehicles 8
EOF
