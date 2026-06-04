# 01 — GSD Workflow

**Status:** 🟡 outlined
**Reference impl:** `chorz/.planning/`, `chorz/docs/GSD_PLAN.md`, `chorz/docs/ACTIVE_TASKS.md`

## Why this exists

Every project ships through structured phases (discuss → plan → execute → verify) tracked in a versioned `.planning/` directory. The discipline keeps long-running work coherent across context resets and lets Claude Code (or any agent) resume cold without reconstructing intent. Phases get numbered, plans get verified before execution, and verification happens against the phase goal, not just task completion.

## What you must satisfy

- A `.planning/` directory at repo root with `phases/<NNNN>-<slug>/` subdirectories per phase.
- Each phase carries `PHASE.md` (goal + reqs), `PLAN.md` (task breakdown), `VERIFICATION.md` (goal-backward audit), and optional `RESEARCH.md`.
- A `docs/GSD_PLAN.md` (primary roadmap) and `docs/ACTIVE_TASKS.md` (current milestone) live at repo root.
- Atomic commits per task; no batched "WIP" commits in phase branches.
- Subagents never use `git commit --no-verify` (locked by user-level memory rule).

## Sections (TODO when drafted)

1. `.planning/` directory shape
2. Phase numbering convention (XXXX-slug; 999.x for backlog; XX.Y for inserted urgent work)
3. The phase lifecycle: discuss → plan → execute → verify → ship → audit
4. Wave + plan model inside a phase
5. Roadmap vs. milestone vs. backlog
6. GSD slash commands (reference, not vendored — see `claude-code-guide`)
7. How GSD interacts with the other playbook entries (testing, architecture docs, ratchets)

## Reference reading

- `chorz/.planning/phases/1078-i18n-ios-drain/` — recent end-to-end phase example
- `chorz/docs/GSD_PLAN.md` — primary roadmap shape
- `chorz/CLAUDE.md § gsd-rules` — project-level GSD enforcement
