#!/usr/bin/env bash
# Synthetic conference demo - no real data.
# One-command teardown. Deletes the stack, waits, then verifies NOTHING tagged
# Project=aws-community-day-demo / Demo=fleet remains. Exits non-zero if it does.
set -uo pipefail
cd "$(dirname "$0")/.."

STACK="${STACK_NAME:-fleet-demo}"
REGION="${AWS_REGION:-eu-central-1}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ARTIFACT_BUCKET="${STACK}-artifacts-${ACCOUNT_ID}-${REGION}"
SITE_BUCKET="${STACK}-site-${ACCOUNT_ID}-${REGION}"

# CloudFormation will not delete a non-empty S3 bucket, so empty the site bucket
# (declared in the template) before the stack delete.
if aws s3api head-bucket --bucket "$SITE_BUCKET" 2>/dev/null; then
  echo ">> emptying site bucket $SITE_BUCKET"
  aws s3 rm "s3://$SITE_BUCKET/" --recursive --only-show-errors
fi

echo ">> delete-stack $STACK"
aws cloudformation delete-stack --stack-name "$STACK" --region "$REGION"

echo ">> wait stack-delete-complete (this can take a few minutes)"
if ! aws cloudformation wait stack-delete-complete --stack-name "$STACK" --region "$REGION"; then
  echo "!! stack delete did not complete cleanly - check the CloudFormation console" >&2
fi

# The dedicated artifact bucket is created by deploy.sh, not the template, so
# remove it here (no versioning -> --force empties it in one pass).
if aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" 2>/dev/null; then
  echo ">> removing artifact bucket $ARTIFACT_BUCKET"
  aws s3 rb "s3://$ARTIFACT_BUCKET" --force
fi

echo ">> verifying no tagged resources remain"
REMAINING=$(aws resourcegroupstaggingapi get-resources \
  --region "$REGION" \
  --tag-filters "Key=Project,Values=aws-community-day-demo" "Key=Demo,Values=fleet" \
  --query "ResourceTagMappingList[].ResourceARN" --output text)

if [ -n "$REMAINING" ]; then
  echo "!! LEFTOVER RESOURCES still tagged Demo=fleet:" >&2
  echo "$REMAINING" | tr '\t' '\n' >&2
  echo "   (most likely a non-empty S3 bucket or an out-of-band log group - remove manually)" >&2
  exit 1
fi

echo "OK - stack deleted and zero tagged resources remain."
