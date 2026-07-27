#!/usr/bin/env bash
# Smoke tests for Alex Tong's Toolkit.
#
# These validate the structural contract of each plugin — JSON schema,
# gold-spec SKILL.md sections, and deterministic reference files. Full
# behavioral testing of a skill would require running Claude against
# fixtures, which is not feasible in CI; the bet is that if every plugin
# follows the same structural contract, the behavioral bar is met.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ parse all JSON"
node scripts/parse-all-json.js

echo "→ validate marketplace schema"
node scripts/validate-marketplace.js

echo "→ validate skill gold spec"
node scripts/validate-skills.js

echo "→ safety scan (secrets, ex-employer internals, personal identifiers)"
node scripts/scan-safety.js

echo "→ fixture: pr-summary example contains required sections"
node tests/fixture-pr-example.js

echo "→ fixture: worksheet base-template.html passes print-CSS checks"
node tests/fixture-worksheet-template.js

echo
echo "All tests passed."
