---
target: 4
branch: chore/genericize-keel-baseline
iteration: 2
last_run: 2026-06-21
status: in_progress
clean_reviews_in_row: 0
max_iterations: 10
depth: deep
last_commit: pending-iter-01
last_finding_count: 8
last_finding_fingerprint: iter01-cfutils-status+playbook-entry-reframe+overclaim+domain-slugs
stuck_iterations: 0
last_fixes_applied:
  - "cf-utils status falsely 'scaffold' (actually impl v0.3.0)"
  - "index/README overclaim 'app-agnostic, no app paths' false for body docs"
  - "add-a-playbook-entry.md still 'reference project' + Reference-impl template fields"
  - "add-a-ratchet.md chorz Phase 1078/1080 numbers"
  - "upstream recipe archDocIntegrity no-op on docs/playbook"
  - "domain slugs chore-card-body / chore.conflict / choreId / perm-recurring / kid-finger"
  - "test comment ungrammatical fragment"
  - "keel-refresh naming drift"
---
# Ralph state for PR #4 (genericize keel baseline — floor)

## Iteration log
- iter-01: 2 parallel independent deep reviewers. 0 BLOCKER, 8 SHOULD-FIX/NIT (reconciled), ALL fixed in-loop. 152 ratchet-kit tests green. Two deeper tranches explicitly surfaced to the user (NOT silently deferred): cf-utils functional domain defaults + i18n Member/Household vocabulary + the 13 playbook body docs (planned PR2+).

## Last review summary
Core goal met: code + packages + framing + recipes are free of clearly-chorz tokens (verified by grep). Fixed: cf-utils status accuracy, index/README overclaim softened to truthful, add-a-playbook-entry reframed to "consuming project" + dropped Reference-impl template fields, phase numbers / domain slugs / kid-finger genericized, recipe archDocIntegrity + keel-refresh corrected, test comment grammar.

## Stop conditions
Active. Will mark complete at clean_reviews_in_row >= 3. Out-of-scope by design (tracked, surfaced to user): cf-utils logger/config domain-label defaults + tests (functional change to a PII lib — own PR); i18n Member→Household vocabulary; 13 playbook body docs (PR2+ depth pass).
