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
#   5. Installs @camelburrito/cf-utils + @camelburrito/ratchet-kit (from npmjs)
#   6. Prints next-step TODOs
#
# Prerequisites:
#   - npm >= 9, node >= 20
#   - git
#
# The @camelburrito/* packages are public on npmjs.org, so no auth or token is
# needed to install them. (They're also mirrored to GitHub Packages; see the
# README if you prefer to consume from there instead.)

set -euo pipefail

# Parse args: project-name [target-dir] [--no-install]
NO_INSTALL=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --no-install) NO_INSTALL=1 ;;
    *) ARGS+=("$arg") ;;
  esac
done

PROJECT_NAME="${ARGS[0]:?usage: bootstrap.sh <project-name> [target-dir] [--no-install]}"
TARGET_DIR="${ARGS[1]:-$PWD}"

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

# No auth pre-flight needed — the @camelburrito/* packages are public on npmjs,
# so `npm install` pulls them anonymously. `--no-install` still lets you skip
# the install step entirely (e.g. offline bootstrap or the CI regression test).

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

# Set a local-repo git identity ONLY if no identity is configured globally.
# Lets the initial commit succeed on machines where the user hasn't run
# `git config --global user.email/user.name` yet (fresh CI runners, fresh
# Linux dev environments). The user's first real commit later will override
# this placeholder naturally via their own global config.
if ! git config user.email >/dev/null 2>&1; then
  git config user.email "bootstrap@keel.local"
  git config user.name "Keel Bootstrap"
fi

git commit -m "Initial bootstrap from keel" --no-verify >/dev/null

if [[ "$NO_INSTALL" -eq 1 ]]; then
  echo "[keel] --no-install: skipping npm install."
  echo "       Run \`npm install @camelburrito/cf-utils @camelburrito/ratchet-kit\`"
  echo "       yourself when ready — they're public on npmjs, no token needed."
else
  # 5. Install the agnostic packages from npmjs (public — no auth needed).
  # Unversioned → installs the current published release of each (npm saves a
  # caret range of whatever resolved, so the new project is reproducible after).
  # Don't pin a fixed minor here: the packages are pre-1.0, and a `^0.1.0`-style
  # pin both excludes every later 0.x (npm caret on 0.x is locked to that minor)
  # and goes stale on the next bump.
  echo "[keel] Installing @camelburrito/cf-utils + @camelburrito/ratchet-kit (latest)"
  npm install \
    --save '@camelburrito/cf-utils' \
    --save-dev '@camelburrito/ratchet-kit' 2>&1 | tail -5 || {
      echo "" >&2
      echo "WARN: npm install of @camelburrito packages failed." >&2
      echo "If you see 404, the packages may not be published yet — check:" >&2
      echo "  https://www.npmjs.com/package/@camelburrito/ratchet-kit" >&2
      echo "You can re-run npm install after fixing." >&2
    }
fi

# 6. Print next-step TODOs
echo ""
echo "[keel] Done. Project ready at: $PROJECT_DIR"
echo ""
echo "Next steps:"
echo "  cd $PROJECT_DIR"
echo "  1. Review CLAUDE.md — workflow rules (Ralph loop, PR conventions, screenshots,"
echo "     branch+PR, ratchet inventory) shipped from keel templates. Customize the"
echo "     'Project-specific commands' + 'Ratchet inventory' sections as the project grows."
echo "  2. Fill in .env.${PROJECT_NAME}-staging + .env.${PROJECT_NAME}-prod from templates"
echo "  3. Create your two Firebase projects (${PROJECT_NAME}-staging + ${PROJECT_NAME}-prod)"
echo "  4. Review docs/architecture/README.md and write your first arch doc when first subsystem stabilizes"
echo "  5. Browse the playbook at https://github.com/camelburrito/keel/tree/main/docs/playbook"
echo "  6. Pick your first phase via /gsd:new-project (or your equivalent)"
