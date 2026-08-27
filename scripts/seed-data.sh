#!/usr/bin/env bash
# Synthetic conference demo - no real data.
# Reset demo state to a known-good starting point before a run-through:
#  - clear VehicleState, PendingApprovals, Connections tables
#  - regenerate the replay log
set -euo pipefail
cd "$(dirname "$0")/.."

STACK="${STACK_NAME:-fleet-demo}"
REGION="${AWS_REGION:-eu-central-1}"

echo ">> regenerating replay-data/session.json"
node scripts/gen-replay.js

if aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" >/dev/null 2>&1; then
  for T in vehicle-state pending-approvals connections; do
    TABLE="${STACK}-${T}"
    KEY=$(case "$T" in vehicle-state) echo vehicleId;; pending-approvals) echo approvalId;; connections) echo connectionId;; esac)
    echo ">> clearing $TABLE"
    aws dynamodb scan --table-name "$TABLE" --region "$REGION" \
      --projection-expression "$KEY" --query "Items[][\"$KEY\"].S" --output text 2>/dev/null | tr '\t' '\n' | while read -r ID; do
        [ -z "$ID" ] && continue
        aws dynamodb delete-item --table-name "$TABLE" --region "$REGION" \
          --key "{\"$KEY\":{\"S\":\"$ID\"}}"
      done
  done
  echo "OK - live tables cleared."
else
  echo "(stack not deployed - only replay data was regenerated)"
fi
