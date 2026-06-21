#!/usr/bin/env bash
# templates/scripts/check-coverage-floors.sh — per-target iOS line-coverage floor enforcement.
#
# Skeleton. Adapt PRIMARY_SCHEMES + MIN values for your project's iOS targets.
# See keel playbook 06-testing-cadence.md § "Sub-pattern: per-target iOS coverage floors".
#
# Usage:
#   bash apple/scripts/check-coverage-floors.sh <merged-coverage-report.json>
#
# Behavior:
#   - For each target, requires the PRIMARY_SCHEMES set to ALL have run.
#   - If a primary scheme didn't run, SKIP that target's floor with a clear log line.
#   - If all primary schemes ran AND coverage < MIN, FAIL with the recipe to investigate.
#
# Partial-mode SKIP semantics matter — pre-push path-filtering only runs the schemes
# that touch changed files, so most pushes skip most floors. `npm run test:ios`
# (full sweep) is the only invocation that enforces every floor.

set -euo pipefail

REPORT="${1:?merged coverage report json path required}"

# ---- TODO: adapt these maps for your project ----
# Per-target floor (line coverage %)
declare -A TARGET_MIN=(
  ["<APP>_APP"]=62        # apple/<App>/<App>/ — main app target
  ["<APP>_UI"]=97         # packages/<Core>UI/ — UI atom + element coverage
  ["<APP>_CORE"]=93       # packages/<Core>/ — core SDK protocols + helpers
  # ["<APP>_TV"]=94       # apple/<App>TV/ — uncomment when tvOS lands
)

# Per-target primary contributing schemes. Floor is SKIPPED unless ALL listed
# schemes ran in this invocation.
declare -A PRIMARY_SCHEMES=(
  ["<APP>_APP"]="<App>"
  ["<APP>_UI"]="<App>,<App>UI"
  ["<APP>_CORE"]="<App>,<Core>-Package,<Core>HostTests"
  # ["<APP>_TV"]="<App>TV"
)

# Schemes actually run this invocation. Caller pipes a comma-separated list:
#   bash check-coverage-floors.sh report.json --ran=<App>,<App>UI
RAN="${2#--ran=}"
[[ "$RAN" == "${2:-}" ]] && RAN=""  # no --ran flag = empty

# ---- Check each target ----
FAILED=0
for target in "${!TARGET_MIN[@]}"; do
  required="${PRIMARY_SCHEMES[$target]}"
  min="${TARGET_MIN[$target]}"

  # Verify every required scheme ran.
  missing=""
  IFS=',' read -ra REQ_ARRAY <<<"$required"
  for scheme in "${REQ_ARRAY[@]}"; do
    if [[ ! ",$RAN," == *",$scheme,"* ]]; then
      missing+="$scheme,"
    fi
  done

  if [[ -n "$missing" ]]; then
    echo "SKIP: $target floor — requires schemes [$required], missing [${missing%,}]"
    continue
  fi

  # TODO: parse $REPORT (e.g., merged xccov JSON) and extract per-target line %.
  # Example placeholder:
  pct="0"  # TODO: jq -r ".targets[\"$target\"].lineCoveragePct" "$REPORT"

  if (( $(echo "$pct < $min" | bc -l) )); then
    echo "FAIL: $target at ${pct}% (floor ${min}%). Investigate: <recipe URL>"
    FAILED=1
  else
    echo "OK:   $target at ${pct}% (floor ${min}%)"
  fi
done

exit "$FAILED"
