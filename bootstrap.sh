#!/usr/bin/env bash
# keel bootstrap — initialize a new project from the keel baseline.
#
# Usage:
#   bash bootstrap.sh <project-name> [target-dir]
#
# What this does:
#   1. Creates <target-dir>/<project-name>/ (defaults to CWD)
#   2. Copies templates/ into the new project (dotfiles included)
#   3. chmod +x .githooks scripts
#   4. Initializes git + wires core.hooksPath -> .githooks
#   5. Writes .npmrc bound to $GITHUB_PACKAGES_PAT
#   6. Installs @camelburrito/cf-utils + @camelburrito/ratchet-kit
#   7. Prints next-step TODOs
#
# Prerequisites:
#   - $GITHUB_PACKAGES_PAT set to a personal access token with `read:packages`
#     scope on github.com/camelburrito
#   - npm >= 9, node >= 20
#   - git

set -euo pipefail

PROJECT_NAME="${1:?usage: bootstrap.sh <project-name> [target-dir]}"
TARGET_DIR="${2:-$PWD}"

# Locate the keel repo (this script's directory)
KEEL_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

PROJECT_DIR="$TARGET_DIR/$PROJECT_NAME"

# Pre-flight: project name must be sed-safe / shell-safe. Lowercase letters,
# digits, hyphens; must start with a letter. Rejects `/`, `&`, `\`, `$`, and
# whitespace that would break the sed substitution downstream.
if [[ ! "$PROJECT_NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo "ERROR: project-name must match ^[a-z][a-z0-9-]*\$ (lowercase letters, digits, hyphens; starts with a letter)." >&2
  echo "  Got: $PROJECT_NAME" >&2
  exit 1
fi

# Pre-flight: PAT required for npm install of @camelburrito/* packages.
if [[ -z "${GITHUB_PACKAGES_PAT:-}" ]]; then
  echo "ERROR: GITHUB_PACKAGES_PAT env var is not set." >&2
  echo "" >&2
  echo "Create a GitHub personal access token with 'read:packages' scope at" >&2
  echo "  https://github.com/settings/tokens" >&2
  echo "then export it:" >&2
  echo "  export GITHUB_PACKAGES_PAT=ghp_xxxxxxxxxxxx" >&2
  exit 1
fi

if [[ -e "$PROJECT_DIR" ]]; then
  echo "ERROR: $PROJECT_DIR already exists. Refusing to overwrite." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "ERROR: node is required (>= 20)" >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm is required (>= 9)"  >&2; exit 1; }
command -v git  >/dev/null 2>&1 || { echo "ERROR: git is required"         >&2; exit 1; }

echo "[keel] Bootstrapping $PROJECT_NAME at $PROJECT_DIR"

# 1. Create project dir + copy templates (dotfiles included via `.` glob trick)
mkdir -p "$PROJECT_DIR"
# Use rsync if available for clean dotfile handling; fall back to cp.
if command -v rsync >/dev/null 2>&1; then
  rsync -a "$KEEL_ROOT/templates/" "$PROJECT_DIR/"
else
  cp -R "$KEEL_ROOT/templates/." "$PROJECT_DIR/"
fi

# 2. chmod +x hooks and scripts so they're executable on the new clone
chmod +x "$PROJECT_DIR/.githooks/pre-commit" 2>/dev/null || true
chmod +x "$PROJECT_DIR/.githooks/pre-push"   2>/dev/null || true
chmod +x "$PROJECT_DIR/scripts/"*.sh         2>/dev/null || true
chmod +x "$PROJECT_DIR/scripts/"*.mjs        2>/dev/null || true
chmod +x "$PROJECT_DIR/scripts/"*.py         2>/dev/null || true

# 3. Replace <APP> placeholders in templates with the project name.
# Extensions: every file type in templates/ that currently carries <APP>.
# `.py` covers scripts/merge-coverage.py.
echo "[keel] Replacing <APP> placeholders with '$PROJECT_NAME'"
find "$PROJECT_DIR" -type f \
  \( -name '*.md' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' \
     -o -name '*.sh' -o -name '*.example' -o -name '*.template' \
     -o -name '*.html' -o -name '*.tsx' -o -name '*.ts' -o -name '*.py' \) \
  -exec sed -i.bak "s/<APP>/$PROJECT_NAME/g" {} +
find "$PROJECT_DIR" -name '*.bak' -delete

# 4. Initialize git + wire core.hooksPath
cd "$PROJECT_DIR"
git init -b main >/dev/null

# Stage everything and create an initial commit so the hook wire-up takes
# effect on the NEXT commit. The initial commit itself uses --no-verify
# because the template pre-commit hook runs `npm run tokens:check` etc.,
# and `node_modules/` doesn't exist yet (npm install runs below). All
# subsequent commits run hooks normally.
git add .
git config core.hooksPath .githooks
git commit -m "Initial bootstrap from keel" --no-verify >/dev/null

# 5. Write .npmrc bound to the PAT
cat > .npmrc <<EOF
@camelburrito:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=$GITHUB_PACKAGES_PAT
EOF

# 6. Install the agnostic packages
echo "[keel] Installing @camelburrito/cf-utils + @camelburrito/ratchet-kit"
npm install \
  --save '@camelburrito/cf-utils@^0.1.0' \
  --save-dev '@camelburrito/ratchet-kit@^0.1.0' 2>&1 | tail -5 || {
    echo "" >&2
    echo "WARN: npm install of @camelburrito packages failed." >&2
    echo "If you see 404, the packages may not be published yet — check:" >&2
    echo "  https://github.com/camelburrito/keel/packages" >&2
    echo "You can re-run npm install after publishing." >&2
  }

# 7. Print next-step TODOs
echo ""
echo "[keel] Done. Project ready at: $PROJECT_DIR"
echo ""
echo "Next steps:"
echo "  cd $PROJECT_DIR"
echo "  1. Fill in .env.${PROJECT_NAME}-staging + .env.${PROJECT_NAME}-prod from templates"
echo "  2. Create your two Firebase projects (${PROJECT_NAME}-staging + ${PROJECT_NAME}-prod)"
echo "  3. Review docs/architecture/README.md and write your first arch doc when first subsystem stabilizes"
echo "  4. Browse the playbook at https://github.com/camelburrito/keel/tree/main/docs/playbook"
echo "  5. Pick your first phase via /gsd:new-project (or your equivalent)"
echo ""
echo "Note: .npmrc was written with your GITHUB_PACKAGES_PAT. .npmrc is gitignored."
echo "      In CI, set the secret as GITHUB_PACKAGES_PAT and recreate .npmrc per-build."
