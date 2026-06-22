#!/usr/bin/env python3
"""
templates/scripts/merge-coverage.py — merge per-scheme iOS coverage into one report.

Skeleton. See keel playbook 06-testing-cadence.md § "Sub-pattern: per-target iOS coverage floors".

Usage:
    python3 apple/scripts/merge-coverage.py \\
      --scheme-report <App>:./build/<App>.xccovreport \\
      --scheme-report <App>UI:./build/<App>UI.xccovreport \\
      --scheme-report <Core>HostTests:./build/<Core>HostTests.xccovreport \\
      --output ./build/merged.json

Behavior:
    - Loads each scheme's xccov report.
    - For every file path, takes the MAX coverage across all schemes that cover it.
      Rationale: one scheme might exercise a file with 60% coverage but another
      scheme's test set hits 90% of the same file. The MAX is the truthful
      "what's covered by SOMETHING in the test suite" answer.
    - Computes per-target rollup (lineCoveragePct, executableLines, coveredLines).
    - Emits a merged JSON consumed by check-coverage-floors.sh.

Pitfall — the MAX is per-file, not per-target. Don't avg over targets.
"""

import argparse
import json
import subprocess
from pathlib import Path
from collections import defaultdict


def load_scheme_report(report_path: Path) -> dict:
    """Parse an Xcode xccovreport file via xcrun xccov view --json."""
    # TODO: shell out to `xcrun xccov view --json <report>`
    result = subprocess.run(
        ["xcrun", "xccov", "view", "--json", str(report_path)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def merge_per_file_max(scheme_reports: dict[str, dict]) -> dict[str, dict]:
    """For each file, take the MAX coverage across all schemes that cover it."""
    merged: dict[str, dict] = {}
    for scheme_name, report in scheme_reports.items():
        # TODO: iterate report['files'] (or equivalent) and update merged[path]
        # only if the scheme's per-file coverage > current merged value.
        pass
    return merged


def rollup_by_target(merged_files: dict[str, dict], target_paths: dict[str, list[str]]) -> dict[str, dict]:
    """Sum executable + covered lines per target, compute percentage."""
    targets: dict[str, dict] = {}
    for target_name, path_patterns in target_paths.items():
        # TODO: match merged_files keys against path_patterns and sum.
        targets[target_name] = {
            "executableLines": 0,
            "coveredLines": 0,
            "lineCoveragePct": 0.0,
        }
    return targets


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scheme-report", action="append", required=True,
                        help="Format: <scheme-name>:<path-to-xccovreport>")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    scheme_reports: dict[str, dict] = {}
    for entry in args.scheme_report:
        scheme_name, report_path = entry.split(":", 1)
        scheme_reports[scheme_name] = load_scheme_report(Path(report_path))

    merged = merge_per_file_max(scheme_reports)

    # TODO: define your per-target path patterns (e.g., apple/<App>/<App>/** -> <APP>_APP).
    TARGET_PATHS = {
        # "<APP>_APP":  ["apple/<App>/<App>/"],
        # "<APP>_UI":   ["packages/<Core>UI/Sources/"],
        # "<APP>_CORE": ["packages/<Core>/Sources/"],
    }
    targets = rollup_by_target(merged, TARGET_PATHS)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({
        "schemes": list(scheme_reports.keys()),
        "files": merged,
        "targets": targets,
    }, indent=2))

    print(f"[merge-coverage] wrote {args.output} from {len(scheme_reports)} scheme reports")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
