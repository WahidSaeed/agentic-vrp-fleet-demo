#!/usr/bin/env bash
# Synthetic conference demo - no real data.
# Full lifecycle rehearsal: deploy -> seed -> inject one disruption via the
# simulator -> assert an approval row appears -> teardown -> verify empty.
# Run this the night before the talk.
set -uo pipefail
cd "$(dirname "$0")/.."

STACK="${STACK_NAME:-fleet-demo}"
REGION="${AWS_REGION:-eu-central-1}"
FAIL=0

step() { echo; echo "=== $* ==="; }

step "deploy"
./scripts/deploy.sh || { echo "deploy failed"; exit 1; }

STREAM=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='TelemetryStreamName'].OutputValue" --output text)

step "seed"
./scripts/seed-data.sh

step "inject disruption"
( cd simulator && npm install --silent && \
  node index.js disrupt --stream "$STREAM" --region "$REGION" --vehicle veh-3 --kind road_closure )

step "wait for agent to write an approval row (up to 60s)"
FOUND=0
for i in $(seq 1 20); do
  CNT=$(aws dynamodb scan --table-name "${STACK}-pending-approvals" --region "$REGION" \
    --select COUNT --query Count --output text 2>/dev/null || echo 0)
  if [ "${CNT:-0}" -ge 1 ]; then FOUND=1; break; fi
  sleep 3
done
[ "$FOUND" -eq 1 ] && echo "PASS: approval row created" || { echo "FAIL: no approval row"; FAIL=1; }

step "teardown + verify empty"
./scripts/teardown.sh || FAIL=1

echo
[ "$FAIL" -eq 0 ] && echo "SMOKE TEST PASSED" || echo "SMOKE TEST FAILED"
exit $FAIL
