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

echo ">> outputs"
aws cloudformation describe-stacks --stack-name "$STACK" \
  --query "Stacks[0].Outputs" --output table

cat <<'EOF'

Next:
  1. Put WebSocketUrl / DemoWsToken / TelemetryStreamName into frontend/.env.local
     and (optionally) simulator env. Do NOT commit those values.
  2. ./scripts/seed-data.sh        # reset state
  3. cd simulator && npm start     # start telemetry
EOF
