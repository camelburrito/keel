#!/usr/bin/env bash
# scripts/test-bootstrap.sh — regression test for bootstrap.sh.
#
# Runs bootstrap.sh --no-install in a sandboxed temp dir and asserts:
#   - Exit code 0
#   - Templates land (>= 20 files copied)
#   - <APP> placeholders fully substituted (0 residual)
#   - .githooks/* are executable
#   - git init succeeded (initial commit exists)
#   - Project-name validation rejects bad shapes
#
# Wired into .github/workflows/test-bootstrap.yml so any PR that touches
# bootstrap.sh, templates/, or this script is gated by it. Locks the 3
# bugs surfaced in the post-publish audit (PROJECT_NAME unvalidated,
# pre-commit hook fires before npm install, find pattern missed *.py).

set -euo pipefail

KEEL_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &> /dev/null && pwd)"
SANDBOX="$(mktemp -d -t keel-bootstrap-test.XXXXXX)"
trap 'rm -rf "$SANDBOX"' EXIT

PROJECT_NAME="test-proof"

echo "[test-bootstrap] keel root: $KEEL_ROOT"
echo "[test-bootstrap] sandbox:   $SANDBOX"
echo

# ─── Case 1: happy path with --no-install ─────────────────────────────────────
echo "[case 1] happy path bootstrap.sh $PROJECT_NAME --no-install"
bash "$KEEL_ROOT/bootstrap.sh" "$PROJECT_NAME" "$SANDBOX" --no-install >/dev/null

PROJECT_DIR="$SANDBOX/$PROJECT_NAME"

# Asserts
[[ -d "$PROJECT_DIR" ]]                || { echo "FAIL: project dir not created"; exit 1; }
FILE_COUNT=$(find "$PROJECT_DIR" -type f -not -path '*/\.git/*' | wc -l | tr -d ' ')
[[ "$FILE_COUNT" -ge 20 ]]             || { echo "FAIL: expected >= 20 files, got $FILE_COUNT"; exit 1; }
[[ -x "$PROJECT_DIR/.githooks/pre-commit" ]] || { echo "FAIL: pre-commit hook not executable"; exit 1; }
[[ -x "$PROJECT_DIR/.githooks/pre-push"   ]] || { echo "FAIL: pre-push hook not executable"; exit 1; }
[[ -d "$PROJECT_DIR/.git" ]]           || { echo "FAIL: git not initialized"; exit 1; }
(cd "$PROJECT_DIR" && git log -1 --oneline >/dev/null) || { echo "FAIL: no initial commit"; exit 1; }

# No residual <APP> placeholders anywhere.
RESIDUAL=$(grep -rl '<APP>' "$PROJECT_DIR" 2>/dev/null | grep -v '/\.git/' || true)
if [[ -n "$RESIDUAL" ]]; then
  echo "FAIL: residual <APP> placeholders found:"
  echo "$RESIDUAL" | sed 's/^/  /'
  exit 1
fi

# Verify <APP> was actually replaced (sample-check: package.json should have name).
grep -q "\"name\": \"$PROJECT_NAME\"" "$PROJECT_DIR/package.json" || { echo "FAIL: package.json name not substituted"; exit 1; }
grep -q "$PROJECT_NAME-staging" "$PROJECT_DIR/.github/workflows/staging-deploy.yml" || { echo "FAIL: staging workflow not substituted"; exit 1; }
grep -q "$PROJECT_NAME-prod" "$PROJECT_DIR/.github/workflows/prod-deploy.yml" || { echo "FAIL: prod workflow not substituted"; exit 1; }

# --no-install: bootstrap no longer writes any .npmrc — assert it stays absent.
[[ ! -f "$PROJECT_DIR/.npmrc" ]] || { echo "FAIL: .npmrc unexpectedly written under --no-install"; exit 1; }

# --no-install: node_modules must NOT exist.
[[ ! -d "$PROJECT_DIR/node_modules" ]] || { echo "FAIL: node_modules unexpectedly populated under --no-install"; exit 1; }

echo "[case 1] PASS — $FILE_COUNT files, 0 residual placeholders, hooks executable, git initialized"

# ─── Case 2: PROJECT_NAME validation rejects bad shapes ───────────────────────
echo
echo "[case 2] PROJECT_NAME validation"

for BAD_NAME in "My-App" "my_app" "my/app" "1app" "" "my app"; do
  if bash "$KEEL_ROOT/bootstrap.sh" "$BAD_NAME" "$SANDBOX/reject-$RANDOM" --no-install 2>/dev/null; then
    echo "FAIL: bootstrap accepted invalid name '$BAD_NAME'"
    exit 1
  fi
done
echo "[case 2] PASS — 6 invalid names rejected"

# ─── Case 3: existing project dir refuses overwrite ───────────────────────────
echo
echo "[case 3] existing-dir guard"

if bash "$KEEL_ROOT/bootstrap.sh" "$PROJECT_NAME" "$SANDBOX" --no-install 2>/dev/null; then
  echo "FAIL: bootstrap overwrote existing dir"
  exit 1
fi
echo "[case 3] PASS — refused to overwrite existing project dir"

echo
echo "[test-bootstrap] ALL CASES PASS"
