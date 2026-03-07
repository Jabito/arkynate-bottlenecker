#!/bin/bash
set -e

BUCKET="bottlenecker-app.arkynate.com"
DIST_ID="E26OMXWJ6166C0"
REGION="ap-southeast-1"

echo "Building..."
npm run build

echo "Uploading assets..."
aws s3 sync dist/ s3://$BUCKET/ \
  --delete \
  --region $REGION \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

echo "Uploading index.html..."
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --region $REGION \
  --cache-control "no-cache, no-store, must-revalidate"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"

echo "Deployed to https://bottlenecker.arkynate.com"
