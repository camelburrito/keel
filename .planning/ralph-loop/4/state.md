---
target: 4
branch: chore/genericize-keel-baseline
iteration: 8
last_run: 2026-06-21
status: in_progress
clean_reviews_in_row: 0
max_iterations: 12
depth: deep
last_commit: pending-iter-07
last_finding_count: 4
last_finding_fingerprint: iter07-iflag-narrowing+stale-followup+dead-path+nits
stuck_iterations: 0
last_fixes_applied:
  - "NIT: shared-cf-utils chorz dir name -> packages/cf-utils (gen-strings, pre-commit, test-coverage, _deploy templates)"
  - "NIT: lockfile-sync JSDoc functions-calendar/calendar -> functions-secondary/secondary"
  - "NIT: README recipes list now includes upstream-an-improvement.md"
  - "NIT: ratchet-kit CHANGELOG roll-up 0.4.0->0.7.3 (was stale at 0.3.0)"
---
# Ralph state for PR #4 (genericize keel baseline — floor)

## Iteration log
- iter-01: 2 deep reviewers, 8 findings, all fixed. 152 tests green.
- iter-02: 2 independent deep reviewers, 5 findings (2 SHOULD-FIX truthfulness + leak + NITs), all fixed. 152 green.
- iter-03: 2 independent deep reviewers. **0 BLOCKER + 0 SHOULD-FIX (clean #1)**; 3 NITs closed in-loop per the NITs-are-merge-gates rule (shared-cf-utils/functions-calendar structure-term leaks, README recipes list, stale ratchet-kit CHANGELOG). 152 green.
- iter-04: deep reviewer, **fully clean (clean #2)** — 0 BLOCKER/SHOULD-FIX/NIT. ratchet-kit 152 + cf-utils 132 green.
- iter-05: independent deep reviewer found **1 SHOULD-FIX** — `scripts/ci-local.sh:60` still had `shared-cf-utils` (the lone straggler missed by iter-03's batch; my own grep sweeps had silently dropped it because the RTK bash-output hook compresses grep stdout — caught via direct file read). Fixed → `packages/cf-utils`. Streak RESET to 0. Re-verified with a file-redirected (RTK-bypassing) exhaustive sweep: **0 in-scope stragglers** (all 188 remaining repo hits are documented out-of-scope tranches).

- iter-06 (final convergence): **3 INDEPENDENT deep reviewers in parallel** on the fixed commit f62e17d, distinct lenses (leak-sweep RTK-proof / factual+tests / prose+links). **ALL THREE returned 0 BLOCKER + 0 SHOULD-FIX + 0 NIT.** Leak reviewer: zero in-scope chorz identifiers (file-redirect method; all 188 repo hits in documented out-of-scope tranches). Facts reviewer: every claim accurate, ratchet-kit 152 + cf-utils 132 green. Prose reviewer: consistent narrative, all links resolve, markdown well-formed.

## Last review summary
CONVERGED. After the iter-05 one-line fix, 3 independent parallel deep reviews of the final commit all clean (plus iter-03 clean + iter-04 fully-clean earlier). 9 reviewer passes across 6 iterations. In-scope surface deterministically verified free of clearly-chorz identifiers.

## Stop conditions
REOPENED for the depth pass (user: "don't defer anything"). PR #4 now does the COMPLETE genericization, not just the floor:
- Tranche C: all 13 `docs/playbook/01-13-*.md` BODY docs rewritten to self-contained generic via 13 parallel agents (Reference-impl headers + chorz path footers removed; war-stories anonymized; domain examples neutralized). Verified strict-chorz-token sweep = 0 (file-redirect, RTK-proof).
- Tranche B: cf-utils FUNCTIONAL genericization — `LABELED_ID_RE` now matches generic `<word>Id`/`uid`/token labels (case-sensitive `…Id`, no app nouns); `firestoreCollectionNames` default → `['users','audit']`; test fixtures neutralized (households/chores→tenants/items, CHORE_*→ITEM_*, member/household field names→user/tenant). cf-utils bumped 0.3.0→0.3.1 + CHANGELOG + README/version mentions. cf-utils 132 + ratchet-kit 152 green; cf-utils tsc clean.
- Tranche A: i18n resolver vocabulary abstracted to tier ROLES (per-user → group/scope → device → fallback) in add-a-locale.md + catalog _comment + playbook 08 — NO entity names (Member/Household/Tenant all gone).
Remaining chorz/domain hits repo-wide: 1 (the intentional "strip this" example in upstream-an-improvement.md). Mermaid render check on playbook docs: clean.

## iter-07 — 3 partitioned reviewers (docs / cf-utils-functional / i18n+cross-cutting)
0 BLOCKER. Closed: (1) SHOULD-FIX privacy narrowing — dropping the regex `i` flag also dropped case-insensitivity for the FIXED token labels (`UID`/`WatchToken`/`FCMToken` leaked); fixed by making `uid`/`watchToken`/`fcmToken` case-insensitive via char-classes while keeping `[A-Za-z]+Id` case-sensitive (so "android"/"valid" still don't false-match) + 2 new locking tests (134 total) + CHANGELOG/comment precision. (2)+(3) SHOULD-FIX stale "follow-up" framing in README:9 + 00-index:3 (the depth pass COMPLETED what they called pending) → updated to done. (4) SHOULD-FIX dead path `templates/scripts/ci-local.sh` in 03 → fixed. NITs: GH #309→#<issue> (02), dangling D-01 tags (05 ×2), strings.gen.ts→strings.generated.ts + footer (08), member/name→user/name (validation.ts), package-lock self-version 0.1.0→0.3.1, footer dates normalized (01/10/11). Reviewer B verified the regex generalization is CORRECT (empirical side-by-side); reviewer C verified resolver chain is entity-name-free + repo chorz-free except the documented example + version mentions consistent. cf-utils 134 + ratchet-kit 152 green; tsc clean.

Need 3 consecutive clean deep reviews on the post-iter-07 commit. Out-of-scope by design (surfaced to user): cf-utils logger/config domain-label defaults + tests; i18n Member→Household vocabulary; 13 playbook body docs (PR2+).
