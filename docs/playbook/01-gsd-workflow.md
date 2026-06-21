# 01 — GSD Workflow

**Status:** 🟢 drafted

---

## The principle

Long-running engineering work spans more sessions than any one context window can hold. Without structured scaffolding, the project state lives in someone's head — and that head goes home at 5pm or hits compaction at message 200. GSD (Get Shit Done) is the discipline of pushing project state into versioned filesystem artifacts so any agent (human or AI) can resume cold and pick up exactly where the prior session left off.

The discipline has three properties that earn their keep:

- **Goal-backward verification** — every phase ends with an audit against the original goal, not just task completion. Tasks can be marked done without the goal being achieved.
- **Atomic commits per task** — no batched "WIP" commits. Each completed task is one commit on the phase branch. This lets the verifier walk git history one task at a time.
- **Subagents respect the gates** — `.githooks/pre-commit` runs even for agent commits. No `--no-verify` shortcuts; if a hook fails, fix the underlying issue.

---

## What you must satisfy

- `.planning/` at repo root with the layout described in § 2.
- `docs/GSD_PLAN.md` (primary roadmap) and `docs/ACTIVE_TASKS.md` (current milestone state) at repo root.
- `docs/CHANGELOG.md` capturing shipped phases with date + summary.
- Atomic commits per task; commit messages reference the phase + task (e.g., `quick(260603-pii): PII floor lockdown`).
- Subagents never use `git commit --no-verify`. Locked structurally by a user-level memory rule + project-level enforcement.
- Phase numbering follows the convention in § 3 — XXXX-slug for primary, XX.Y for inserted-urgent, 999.x for backlog.

---

## 2. The `.planning/` directory shape

```
.planning/
├── ROADMAP.md                          — high-level roadmap snapshot
├── STATE.md                            — current GSD state (which phase, which wave, blockers)
├── phases/
│   └── <NNNN>-<slug>/
│       ├── PHASE.md                    — phase goal + REQUIREMENTS.md + UAT criteria
│       ├── RESEARCH.md                 — (optional) gsd-phase-researcher output
│       ├── PLAN.md                     — task breakdown, wave structure, dependency graph
│       ├── VERIFICATION.md             — goal-backward audit at phase end
│       └── <task-N-artifacts>          — any task-specific files (sub-plans, audits, fixtures)
├── seeds/                              — captured ideas with trigger conditions (gsd:plant-seed)
├── todos/                              — gsd:add-todo capture (lighter-weight than phase)
├── stitch-specs/                       — UI design-spec inputs (gsd:ui-phase)
└── handoffs/                           — context-handoff docs at session boundaries
```

The `phases/<NNNN>-<slug>/` directory is the load-bearing unit. Once a phase is verified + shipped, the directory persists as the historical record (it's the only artifact that captures "why did we do this, what did we research, what was the goal vs what was delivered").

---

## 3. Phase numbering convention

| Pattern | Meaning | Example |
|---------|---------|---------|
| `XXXX-slug` | Primary phase, sequential | `1078-i18n-ios-drain` |
| `XX.Y-slug` | Inserted urgent work between existing phases | `72.1-emergency-rule-fix` |
| `999.x-slug` | Backlog / parking lot (not on active roadmap yet) | `999.5-ratchet-blind-spot-closure` |
| `quick(<YYMMDD>-<slug>)` | Sub-phase work that doesn't need a full phase dir | `quick(260603-pii)` |

Phase numbers are monotonically increasing within their range. Don't renumber once a phase is shipped — the historical record breaks.

---

## 4. The phase lifecycle

```
discuss → plan → execute → verify → ship → audit
   │        │        │         │        │       │
   │        │        │         │        │       └─ gsd:audit-milestone (per milestone, not per phase)
   │        │        │         │        └─ gsd:ship (PR, review, merge)
   │        │        │         └─ gsd:verify-work (goal-backward audit)
   │        │        └─ gsd:execute-phase (waves of parallel work)
   │        └─ gsd:plan-phase (task breakdown + dependency graph)
   └─ gsd:discuss-phase (gather context, surface assumptions)
```

Each gate produces a versioned artifact:
- **discuss** → updates `PHASE.md` with assumptions table + decisions
- **plan** → writes `PLAN.md` + `RESEARCH.md`
- **execute** → atomic commits per task on the phase branch
- **verify** → writes `VERIFICATION.md` (goal-backward audit, not task-completion audit)
- **ship** → opens PR, runs review, merges to main
- **audit** (milestone-level) → archives shipped phases, prepares next milestone

---

## 5. Wave + plan model inside a phase

A phase decomposes into **waves**. Waves are sequential. Within a wave, **plans** can execute in parallel (independent code paths, no shared file edits). A typical phase has 3–5 waves of 1–8 plans each.

The wave model lets you batch parallelizable work without losing the dependency invariants. Wave N must complete before Wave N+1 starts; within Wave N, plans run concurrently (often as parallel subagents in `gsd-executor` instances).

Between waves, run `gsd-tools verify key-links` to catch stranded worktree commits or missing artifacts. One project learned this the hard way when a parallel wave left commits stranded in a worktree that the final verifier never saw — the inter-wave key-link check now catches that class before it compounds.

---

## 6. Roadmap vs milestone vs backlog vs todos

- **Roadmap** (`docs/GSD_PLAN.md`) — sequence of phases, grouped by milestone. Lives in `docs/`.
- **Milestone** — a coherent product cut (`v1`, `v1.1`, `v2`). Phases group under milestones. Audited at milestone boundary.
- **Backlog** (`.planning/phases/999.x-*`) — captured ideas not yet promoted to an active milestone. Reviewed via `gsd:review-backlog`.
- **Todos** (`.planning/todos/`) — lighter-weight than phases; captured via `gsd:add-todo` from conversation context. Promote to phases when scope clarifies.
- **Seeds** (`.planning/seeds/`) — forward-looking ideas with trigger conditions (`gsd:plant-seed`). Surface automatically when the trigger fires.

---

## 7. GSD slash commands (reference)

Don't memorize the catalog; `/gsd:help` lists them. The mental model:
- **Project lifecycle:** `/gsd:new-project`, `/gsd:new-milestone`, `/gsd:complete-milestone`
- **Phase lifecycle:** `/gsd:discuss-phase`, `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work`, `/gsd:ship`
- **Capture:** `/gsd:add-todo`, `/gsd:add-backlog`, `/gsd:plant-seed`, `/gsd:note`
- **Navigation:** `/gsd:progress`, `/gsd:next`, `/gsd:resume-work`, `/gsd:pause-work`, `/gsd:manager`
- **Quick paths:** `/gsd:quick` (atomic commits + GSD guarantees, skip optional agents), `/gsd:fast` (trivial inline task, no agents at all)

The commands write to `.planning/` and the user-memory system; the artifacts are the source of truth, the commands are convenience wrappers.

---

## 8. The atomic-commit discipline

One task → one commit. Commit message format:
```
phase(<NNNN>-<slug>): <one-line summary>

<body — what changed, why, follow-ups>

Co-Authored-By: <your AI agent attribution line>
```

For quicks: `quick(<YYMMDD>-<slug>): <summary>`. The shape lets `git log --oneline` scan the entire phase or quick history at a glance.

**Anti-patterns:** batched "WIP" commits at end of day; "merge main into phase branch" commits without context; `--no-verify` to skip pre-commit. Each of these costs you the goal-backward audit's ability to reconstruct what shipped.

---

## 9. Adopting this playbook

- [ ] `.planning/` skeleton (`bootstrap.sh` copies from `templates/.planning/`).
- [ ] `docs/GSD_PLAN.md` with first milestone outline.
- [ ] `docs/ACTIVE_TASKS.md` for current milestone state.
- [ ] `docs/CHANGELOG.md` (empty header is fine).
- [ ] User-memory rule `feedback_subagent_no_verify` already loads at session start; verify it's present.
- [ ] First phase: pick something concrete (`gsd:new-project` walks you through).
- [ ] Atomic-commit discipline from day 1 — sets the tone before WIP-commit habits form.

---

**Last updated:** 2026-06-21
