# Recipe: Upstream an Improvement to keel

keel is the app-agnostic baseline. Consuming projects are where patterns get *exercised* — a real bug gets fixed, a ratchet gets sharpened, a script grows a flag. When that improvement is portable, it flows back here so the next project gets it for free.

This is a **continuous process**: every consuming project is expected to upstream the generic core of what it learns. The one hard rule is **agnosticism** — nothing app-specific lands in keel, ever.

## When to upstream

You changed something in a consuming project. Ask: *Would the next project, in a different domain, want this exact thing?*

- **Yes, verbatim** → it belongs in `packages/` (published code) or `templates/` (copied scaffolds, e.g. `templates/scripts/`).
- **Yes, as a pattern** → it belongs in `docs/playbook/` as methodology + the portable shape.
- **No — it only makes sense for this app** → it stays in the consuming project. (A ratchet that locks one product's renamed token; a CF specific to one domain.)

If it's portable, upstream it. Don't let the baseline rot behind the projects built on it.

## The agnosticism gate (non-negotiable)

Before a keel PR merges, the change must contain **zero app-specific identifiers**. Strip every one of these:

| Strip this | Replace with |
|---|---|
| App / product names (`AcmeApp`, `Widgetly`, …) | the generic role: `<app>`, "the consuming project", "a production project" |
| App-specific file paths (`apple/AcmeApp/…`, `functions-billing/…`) | a generic path (`scripts/…`, `packages/…`) or the in-keel artifact, or drop it |
| Domain types/fields (`Household`, `Chore`, `invoiceId`) | a neutral stand-in (`Tenant`, `Item`, `recordId`) or describe the shape abstractly |
| Internal references (PR #, phase #, ticket IDs, war-story dates) | the **lesson itself**, stated generically ("a CF wrote `status:done` without `completedAt`") |
| Private repo links (`github.com/org/private-app/…`) | remove — readers of keel may not have access |
| Env/project IDs, domains, account aliases | placeholders (`<staging-project>`, `<your-domain>`) |

A war-story keeps its teaching value **without** the name attached. "One project hit a release-cut that silently no-op'd because a `paths-filter` job used a shallow clone" is portable. An internal reference like "quick 260602-fpd" or "PR #642 of the billing app" is not.

## Where it goes

| Kind of improvement | Lands in |
|---|---|
| Reusable runtime/code utility | `packages/<pkg>/src/` (+ CHANGELOG entry, semver bump) |
| Build / CI / audit script | `scripts/<name>` (parametrized, no hardcoded paths) |
| Copy-at-bootstrap scaffold | `templates/<path>` |
| A pattern, principle, or structural assertion | `docs/playbook/<NN>-<system>.md` |
| A new "how to add X" guide | `recipes/<name>.md` |

## Checklist

- [ ] Generalized: ran the agnosticism gate above — every app name, path, and internal reference is gone.
- [ ] `grep -rin '<your-app-name>' .` over the keel tree returns **zero** hits from your change.
- [ ] If you touched `packages/`: CHANGELOG updated, semver bumped, tests pass (`npm test` in the package).
- [ ] If you touched `docs/`: links/anchors resolve and mermaid renders — run `node scripts/check-mermaid-render.mjs` (it scans `docs/playbook/` + `docs/architecture/`), and point `@camelburrito/ratchet-kit`'s `archDocIntegrity` at your docs dir (its `archDir` config) if your project has arch docs.
- [ ] If you added a playbook entry: row added to `docs/playbook/00-index.md` (see [add-a-playbook-entry.md](add-a-playbook-entry.md)).
- [ ] The change reads as if keel had always had it — not as a port *from* somewhere.

## Re-consuming

After the keel PR merges, the originating project (and every other consumer) picks the change up the normal way:

- **Packages** → bump the `@camelburrito/<pkg>` version in the project's `package.json` and `npm install`.
- **Templates** → copied at bootstrap, after which the project owns them and may drift; re-pull a later keel change by diffing the relevant `templates/` file against keel by hand.
- **Playbook, recipes, checklists, top-level scripts** → reference, not stamped into a project; read them in place or browse them on GitHub, copying a specific piece by hand only if you adapt it.

The loop closes: the project that learned the lesson now consumes the generalized version it contributed.
