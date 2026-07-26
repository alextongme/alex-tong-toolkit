#!/usr/bin/env bash
# Install telemetry for Alex Tong's Toolkit.
#
# `/plugin marketplace add alextongme/alex-tong-toolkit` does a git
# clone under the hood, so GitHub's traffic API is a zero-code signal
# for roughly how many people actually installed the toolkit. Numbers
# are a 14-day rolling window — run weekly if you want history.
#
# Usage: bash scripts/stats.sh
# Requires: gh CLI authenticated with traffic read permission (repo admin).

set -euo pipefail

REPO="alextongme/alex-tong-toolkit"

echo "→ clones (install proxy, 14-day window)"
gh api "repos/$REPO/traffic/clones" \
  --jq '{total: .count, uniques: .uniques, recent: .clones[-7:]}'

echo
echo "→ referrers (where traffic comes from)"
gh api "repos/$REPO/traffic/popular/referrers" \
  --jq '.[] | "\(.referrer)\t\(.count)\t\(.uniques)"' || true

echo
echo "→ top paths (which pages visitors land on)"
gh api "repos/$REPO/traffic/popular/paths" \
  --jq '.[] | "\(.path)\t\(.count)\t\(.uniques)"' || true
