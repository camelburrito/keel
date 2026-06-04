#!/usr/bin/env bash
# scripts/predeploy-pack-cf-utils.sh — deterministic packing of @camelburrito/cf-utils
# into each CF codebase before `firebase deploy`. Fast path skips regeneration when
# the committed tarball's sha512 already matches the lockfile integrity field.
# See keel playbook 09-firebase-stack.md and chorz's predeploy-pack-cf-utils.sh
# for the reference implementation.
#
# Usage:
#   bash scripts/predeploy-pack-cf-utils.sh             # fast path
#   bash scripts/predeploy-pack-cf-utils.sh --force     # always regenerate
#
# STATUS: skeleton. Implement when the first CF codebase + cf-utils package land
# in a downstream project.

set -euo pipefail

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

# TODO:
#   1. Read firebase.json -> functions[].source list
#   2. For each <source>:
#      a. Compute sha512(<source>/cf-utils.tgz) base64
#      b. Read package-lock.json#packages["<source>/node_modules/@camelburrito/cf-utils"].integrity
#      c. If FORCE=false AND sha matches lockfile -> fast path (skip)
#      d. Else: cd packages/cf-utils && npm pack -> copy .tgz to <source>/cf-utils.tgz
# Reference: chorz's scripts/predeploy-pack-cf-utils.sh (quick 260603-cdt)

echo "[predeploy-pack] TODO: implement"
exit 0
