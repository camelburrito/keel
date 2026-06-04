#!/usr/bin/env bash
# keel bootstrap — initialize a new project from the keel baseline.
#
# Usage:
#   bash bootstrap.sh <project-name> [target-dir]
#
# What this does:
#   1. Creates <target-dir>/<project-name>/ (defaults to CWD/<project-name>)
#   2. Copies templates/ into the new project
#   3. Wires .githooks via core.hooksPath
#   4. Writes .npmrc bound to $GITHUB_PACKAGES_PAT env var
#   5. Installs @camelburrito/cf-utils + @camelburrito/ratchet-kit from GitHub Packages
#   6. Prints next-step TODOs
#
# Prerequisites:
#   - $GITHUB_PACKAGES_PAT set to a personal access token with `read:packages` scope
#   - npm >= 9, node >= 20
#
# STATUS: stub. Implement after the first downstream project is being created.

set -euo pipefail

PROJECT_NAME="${1:?project-name required}"
TARGET_DIR="${2:-$PWD}"

echo "STUB: would bootstrap '$PROJECT_NAME' under $TARGET_DIR"
echo "TODO: implement when ready to start project #2"
exit 0
