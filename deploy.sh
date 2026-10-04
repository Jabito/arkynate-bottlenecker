#!/bin/bash
# Deploys dist/ to S3 + CloudFront. Used by .github/workflows/deploy.yml and
# for manual deploys. The bucket and distribution come from the environment.
#
#   S3_BUCKET=... CF_DISTRIBUTION_ID=... ./deploy.sh [--skip-build]
set -euo pipefail

: "${S3_BUCKET:?set S3_BUCKET to the site bucket name}"
: "${CF_DISTRIBUTION_ID:?set CF_DISTRIBUTION_ID to the CloudFront distribution id}"
REGION="${AWS_DEFAULT_REGION:-ap-southeast-1}"

if [[ "${1:-}" != "--skip-build" ]]; then
  echo "Building..."
  npm run build
fi

# Hashed bundles: cache forever (#37). No --delete: routes are lazy-loaded, so a
# tab opened before this deploy must still find its old chunks (#77).
echo "Uploading hashed assets..."
aws s3 sync dist/assets/ "s3://$S3_BUCKET/assets/" \
  --region "$REGION" \
  --cache-control "public, max-age=31536000, immutable"

# Prune old chunks that are not part of this build and older than ASSET_RETENTION_DAYS.
RETENTION_DAYS="${ASSET_RETENTION_DAYS:-30}"
CUTOFF=$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null \
  || date -u -v-"${RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%S)
echo "Pruning assets/ objects older than $CUTOFF that this build doesn't use..."
aws s3api list-objects-v2 --bucket "$S3_BUCKET" --prefix assets/ \
  --query "Contents[].[LastModified, Key]" --output text \
  | while IFS=$'\t' read -r modified key; do
      [[ -z "${key:-}" || "$modified" == "None" || -e "dist/$key" ]] && continue
      [[ "$modified" < "$CUTOFF" ]] || continue  # ISO-8601 strings compare lexically
      aws s3 rm "s3://$S3_BUCKET/$key" --region "$REGION"
    done

# Prerendered routes (scripts/prerender.mjs): dist/<route>/index.html. The S3 REST
# origin looks up /lessons as the key `lessons`, never `lessons/index.html`, so each
# route is uploaded to its extension-less key below.
ROUTES=()
for f in dist/*/index.html; do
  [[ -e "$f" ]] || continue
  route="${f#dist/}"
  ROUTES+=("${route%/index.html}")
done
[[ ${#ROUTES[@]} -gt 0 ]] || { echo "No prerendered routes in dist/ — run npm run build" >&2; exit 1; }

# Root files (favicon, robots.txt, sitemap.xml, llms.txt, ...): short TTL so
# they can be refreshed. --delete never touches the excluded paths, which keeps
# the route keys from being deleted (they have no same-named file in dist/).
echo "Uploading root files..."
ROUTE_EXCLUDES=()
for route in "${ROUTES[@]}"; do ROUTE_EXCLUDES+=(--exclude "$route" --exclude "$route/*"); done
aws s3 sync dist/ "s3://$S3_BUCKET/" \
  --delete \
  --region "$REGION" \
  --exclude "assets/*" \
  --exclude "index.html" \
  "${ROUTE_EXCLUDES[@]}" \
  --cache-control "public, max-age=3600"

# HTML last, so it never points at bundles that aren't uploaded yet. No caching:
# a deploy must reach visitors (and AdSense's crawler) at once.
for route in "${ROUTES[@]}"; do
  echo "Uploading /$route..."
  aws s3 cp "dist/$route/index.html" "s3://$S3_BUCKET/$route" \
    --region "$REGION" \
    --content-type "text/html; charset=utf-8" \
    --cache-control "no-cache, no-store, must-revalidate"
done

# Home last: it is also CloudFront's answer for unknown paths (403/404 → /index.html).
echo "Uploading index.html..."
aws s3 cp dist/index.html "s3://$S3_BUCKET/index.html" \
  --region "$REGION" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache, no-store, must-revalidate"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*"

echo "Deployed to https://bottlenecker.arkynate.com"
