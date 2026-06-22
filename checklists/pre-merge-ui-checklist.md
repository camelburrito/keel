# Pre-Merge UI Checklist

For any PR that touches a visual surface.

## Visual proof

- [ ] PR description includes real-app screenshots (not DOM replicas).
- [ ] Screenshots hosted in the sibling private repo (`<org>/<app>-screenshots/pr-<NNN>/`).
- [ ] Image URLs use `github.com/.../raw/...` (session auth), not `raw.githubusercontent.com`.
- [ ] One screenshot per scenario: happy path + each meaningful state variant (loading, empty, error, etc.).

## Design system compliance

- [ ] No bare hex literals in `.tsx` / `.css` / `.swift` outside the documented carve-outs (defended by `no-bare-hex-in-*` ratchets).
- [ ] No bare `Npx` literals in `.css` (defended by `no-bare-px-in-css`).
- [ ] No inline `style={{}}` in JSX (defended by `no-inline-style`).
- [ ] No `!important` in CSS (defended by `no-important-css`).
- [ ] No bare `<button|select|input|dialog>` JSX or `TextField|Toggle|Picker` Swift in features (defended by `no-bare-{,-swiftui-}primitive-in-features`).
- [ ] All new user-facing strings flow through `t()` and exist in `shared/strings/catalogs/en-US.json` (defended by `no-bare-user-facing-string-in-features`).
- [ ] Off-grid constants carry `// Design-intent constant — <reason> (see GH #<issue>)` comments.

## Cross-platform parity (if applicable)

- [ ] If the change affects a `ChoreCardPresentation`-style projector, the matching cross-platform contract fixtures are refreshed and both runners pass byte-identical.
- [ ] Swift atoms in `packages/<Core>UI/` are updated in parallel with web counterparts.
- [ ] Snapshot tests refreshed atomically.

## Tests

- [ ] Mandate 1 — `seedPermutations.ts` extended with any new data-shape variant; `EXPECTED_TOTAL_SEEDED` updated atomically.
- [ ] Mandate 2 — Cross-page E2E spec under `e2e/cross-page/` covers the new feature on every rendering surface, with positive-absence assertions where intentional.
- [ ] All ratchets green via `bash scripts/ci-local.sh --skip-native` (or full mirror if iOS/Android touched).

## Architecture docs

- [ ] If the change affects a documented system, `docs/architecture/<system>.md` is updated in this same PR (not deferred).
- [ ] "Last updated" footer re-anchored.

## Related playbook

- [02-design-system.md](../docs/playbook/02-design-system.md)
- [06-testing-cadence.md](../docs/playbook/06-testing-cadence.md)
- [10-screenshot-workflow.md](../docs/playbook/10-screenshot-workflow.md)
