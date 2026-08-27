#!/usr/bin/env bash
# Synthetic conference demo - no real data.
# One-command deploy for the fleet demo stack. Reads config from infra/samconfig.toml.
set -euo pipefail
cd "$(dirname "$0")/.."

STACK="${STACK_NAME:-fleet-demo}"

if [ ! -f infra/samconfig.toml ]; then
  echo "infra/samconfig.toml not found. Copy infra/samconfig.toml.example and edit it." >&2
  exit 1
fi

echo ">> sam validate"
sam validate --template infra/fleet-demo.yaml --lint

echo ">> sam build"
sam build --template infra/fleet-demo.yaml

echo ">> sam deploy ($STACK)"
sam deploy --template infra/fleet-demo.yaml --config-file "$(pwd)/infra/samconfig.toml" --stack-name "$STACK"

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
