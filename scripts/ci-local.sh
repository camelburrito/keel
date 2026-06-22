#!/usr/bin/env bash
# scripts/ci-local.sh — full local CI mirror.
# Pass here ≈ pass on CI. Drift defended by ci-local-mirrors-workflow ratchet.
# See keel playbook 03-ci-cd.md.
#
# Usage:
#   bash scripts/ci-local.sh             # full mirror including native (iOS/Android)
#   bash scripts/ci-local.sh --skip-native
#
# STATUS: skeleton. Fill in step bodies as your project surfaces appear.

set -euo pipefail

SKIP_NATIVE=false
for arg in "$@"; do
  case "$arg" in
    --skip-native) SKIP_NATIVE=true ;;
    *) echo "unknown flag: $arg"; exit 2 ;;
  esac
done

STEPS=(
  "STEP 1: Design System Ratchets"
  "STEP 2: Frontend Coverage"
  "STEP 3: CF Coverage (chained buckets)"
  "STEP 3.5: Deploy-Shape Verification"
  "STEP 4: Functions Integration (emulator)"
  "STEP 5: Native Coverage (iOS/Android)"
  "STEP 6: Summary"
)

echo "[ci-local] Starting full local CI mirror"
echo "[ci-local] Skip native: $SKIP_NATIVE"
echo

for step in "${STEPS[@]}"; do
  echo "==> $step"
done
echo

# STEP 1
echo "==> STEP 1: Design System Ratchets"
# TODO: list ratchet test files here; keep in sync with .githooks/pre-commit + workflow.
# npx vitest run --no-coverage src/__tests__/no-*.test.ts
npm run tokens:check
npm run strings:check
npx tsc --noEmit
# Authoritative mermaid render check (complements the archDocIntegrity heuristic).
# Uncomment once you've wired it: `npm i -D mermaid jsdom` + a `check:mermaid`
# script (see playbook 04-architecture-docs.md § Tier 3 + scripts/check-mermaid-render.mjs).
# npm run check:mermaid

# STEP 2
echo "==> STEP 2: Frontend Coverage"
./node_modules/.bin/vitest run --coverage

# STEP 3
echo "==> STEP 3: CF Coverage (chained buckets)"
# TODO: add buckets as workspaces appear:
# (cd packages/cf-utils && ./node_modules/.bin/vitest run --coverage)
# (cd functions && ./node_modules/.bin/vitest run --coverage)

# STEP 3.5
echo "==> STEP 3.5: Deploy-Shape Verification"
# TODO: bash scripts/verify-deploy-shape.sh

# STEP 4
echo "==> STEP 4: Functions Integration (emulator)"
# TODO: firebase emulators:exec --only functions,firestore,auth \
#   "(cd functions && npm run test:integration)"

# STEP 5
if [ "$SKIP_NATIVE" = "true" ]; then
  echo "==> STEP 5: SKIPPED (--skip-native)"
else
  echo "==> STEP 5: Native Coverage"
  # TODO: xcodebuild / gradle invocations
fi

# STEP 6
echo "==> STEP 6: Summary"
echo "[ci-local] OK"
