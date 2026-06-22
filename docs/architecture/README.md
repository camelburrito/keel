# keel architecture

Canonical references for how the **keel baseline itself** is built. Read the doc for a part of keel before reverse-engineering it from the tree.

These docs are authored under keel's own [architecture-doc convention](../playbook/04-architecture-docs.md) and [authoring contract](../../templates/_AUTHORING.md) — keel **dogfoods** the same structural gate it ships for consuming projects: `scripts/check-arch-docs.mjs` runs `archDocIntegrity` (from `@camelburrito/ratchet-kit`) over the docs below, and `scripts/check-mermaid-render.mjs` renders every diagram through the real mermaid engine.

| Doc | What it covers | Status | Last updated |
|-----|----------------|--------|--------------|
| [baseline-and-upstreaming.md](baseline-and-upstreaming.md) | keel's artifact layers, how a project consumes them (copy vs. publish), and the upstreaming loop that flows patterns back app-agnostically | stable | 2026-06-21 |

## These docs vs. the playbook

The [playbook](../playbook/00-index.md) documents patterns for a **consuming project** to adopt — how to do auth, design systems, CI, observability, and so on. The docs here document **keel itself** — what the baseline is made of, how it distributes, and how it evolves. A consuming project keeps its own `docs/architecture/` describing that project's subsystems, seeded from [the template](../../templates/docs/architecture/README.md) (not from these).
