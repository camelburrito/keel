---
target: 6
branch: chore/license-and-self-arch-docs
iteration: 6
last_run: 2026-06-21
status: in_progress
clean_reviews_in_row: 0
max_iterations: 10
depth: deep
last_commit: pending
last_finding_count: 1
last_finding_fingerprint: recipe-where-it-goes-script-routing
stuck_iterations: 0
last_fixes_applied:
  - "NIT: recipes 'Where it goes' table routed any build/CI script to top-level scripts/; split into project-scaffold (templates/scripts/, copied) vs keel-internal tooling (scripts/, reference) — full file re-read confirms this was the last distribution seam"
---
# Ralph state for keel PR #6 (LICENSE + self-validated arch docs)

## Iteration log
- iter-01: 3 reviewers; license/agnosticism/dogfood verified. SHOULD-FIX: 'copied at bootstrap'. Fixed.
- iter-02: reviewer-1 caught Core-invariants L79 seam. Fixed.
- iter-03: BOTH clean (exhaustive table-enumeration + gate re-run).
- iter-04: both merge-ready; 2 NITs (stale recipe model + 'six top-level dirs' phrasing). Both fixed.
- iter-05: reviewer-2 clean; reviewer-1 found the recipe 'Where it goes' script-routing seam. Fixed
  (full recipe re-read — last seam). Gate 0 violations.

## Last review summary
Recipe distribution model now fully consistent (When-to-upstream L11, Where-it-goes table, Re-consuming L56-57
all agree: published(packages) / copied(templates incl templates/scripts) / reference(playbook+recipes+checklists+top-level scripts)).

## Stop conditions
Active. status -> complete at a round with 0 of everything (incl NITs), per the full-cleanup rule.
