# @camelburrito/ratchet-kit

Configurable strict-zero ratchet templates for keel-derived projects.

**Status:** stable — 23 ratchets extracted from `chorz/src/__tests__/`. See [keel playbook 07-ratchet-framework.md](../../docs/playbook/07-ratchet-framework.md).

## What this package provides

**Helpers** (shared utilities for any ratchet):
- `stripTsLineAndBlockComments(src: string)`
- `stripSwiftCommentsAndDebugBlocks(src: string)`
- `stripSwiftPreviewBlocks(src: string)`
- `countMatchesIgnoringBrands(matches, brands)`
- `DeferralEntry` shape + `checkDeferralCount(actual, deferred)`

**Ratchet templates** — each exported as a configurable function that takes a `RatchetConfig` (`{ root, extensions, expectedCounts?, ignoredDirs?, ignoredPrefixes?, ignoredFiles? }`). Available as of **v0.2.0**:

| Export | Since | Defends |
|--------|-------|---------|
| `noInlineStyle` | v0.1 | inline `style={{}}` in `.tsx` (incl. `createElement` variant) |
| `noBareHexInTsx` | v0.1 | bare `#hex` (3/6/8-char) in `.tsx` / `.ts` |
| `noBareHexInCss` | v0.1 | bare `#hex` in `.css` outside tokens |
| `noBarePxInCss` | v0.1 | bare `Npx` in `.css` (skips `--token:` declarations) |
| `noConsoleInSource` | v0.1 | `console.*` calls with `-- <rationale>` disable-directive support |
| `noImportantCss` | v0.2 | `!important` declarations |
| `no3CharHexInTsx` | v0.2 | 3-char hex shorthand in `.tsx` / `.ts` (companion to `noBareHexInTsx`) |
| `noBareRgbaInCss` | v0.2 | `rgba(...)` call sites in `.css` (each counts independently) |
| `noBareHexInSwift` | v0.2 | bare `#hex` + `0xNN / 255` in `.swift` (skips `//`, `#if DEBUG`, `#Preview {}`) |
| `noBareSizeInSwift` | v0.3 | `.padding(N)` / `.cornerRadius(N)` / `.frame(width:height:)` / `.offset(x:y:)` / `Spacing.custom(N)` / `let X: CGFloat = N` (Design-intent escape supported) |
| `noBareDurationInSwift` | v0.3 | `duration: N`, `.seconds/.milliseconds(N)`, `.delay(N)`, `asyncAfter`, `withTimeInterval:`, `.spring(response:)` |
| `noBareFontSizeInSwift` | v0.3 | `.system(size: N)`, `.custom(..., size: N)`, `UIFont.systemFont(ofSize: N)`, `UIFont(name:size:)` |
| `noBareColorConstructorInSwift` | v0.3 | bare `Color(red: <numeric>, ...)` constructor calls |
| `noBareFontPropertyInCss` | v0.4 | bare `font:` shorthand / `font-family` literals in `.css` |
| `noBareViewportEmInCss` | v0.4 | bare viewport (`vw`/`vh`) + `em` literals in `.css` |
| `noStaleE2eSelectors` | v0.4 | testid literals in `e2e/**` specs that no longer exist in production source |
| `noPathsFilterWithoutFetchDepthZero` | v0.4 | `dorny/paths-filter` usage without a preceding `fetch-depth: 0` checkout |
| `noBareHexInCodegenOutput` | v0.5 | bare `#hex` in named codegen-output files (var()-reference regression gate) |
| `lockfileSyncWithPackageJson` | v0.5 | per-codebase `package-lock.json` carries every `package.json` dependency |
| `ratchetListPrecommitVsWorkflow` | v0.5 | the pre-commit hook + CI workflow run the same ratchet set (drift gate) |
| `noUndefinedTokens` | v0.6 | `var(--xyz)` references in consumer CSS resolve to declared tokens |
| `archDocIntegrity` | v0.7 | every `docs/architecture/*.md`: links/anchors resolve (GitHub-exact slug), fully-qualified cited paths exist (incl. `file:line`), mermaid renders, footer present. Config: `{ archDir, repoRoot, topLevelDirs, ephemeralPrefixes? }`. |
| `noAdaptiveFgOnKeptLightIsland` | v0.7 | dark-mode polarity: fails a CSS rule / SwiftUI modifier-run that paints an adaptive foreground on a kept-light island background. Adaptive set self-derived from `tokens.json` `darkColor`. Config: `{ tokensJsonPath, cssRoot?, swiftRoots? }`. |

**On the roadmap (graduate from chorz as patterns prove portable):**

`noBareFirebaseUidInLogger`, `cfUtilsTarballsCommitted`.

## Usage

```ts
// my-project/src/__tests__/ratchets.test.ts
import {
  noInlineStyle,
  noConsoleInSource,
  noBareHexInTsx,
} from '@camelburrito/ratchet-kit';

noInlineStyle({
  paths: ['src/**/*.tsx', '!src/__tests__/**'],
  expectedCounts: {}, // strict-zero
});

noConsoleInSource({
  paths: ['src/**/*.{ts,tsx}', 'functions/**/*.ts'],
  allowDisableDirectives: true, // require -- <rationale> segment
});

noBareHexInTsx({
  paths: ['src/**/*.tsx'],
  expectedCounts: {
    'src/legacy/OldComponent.tsx': { count: 3, rationale: 'pre-migration baseline' },
  },
});
```

## What this package does NOT provide

Project-specific ratchets (e.g., `no-legacy-kid-cta-token` in chorz) — those are not portable. Use `_ratchetHelpers` to author them; see [recipes/add-a-ratchet.md](../../recipes/add-a-ratchet.md).

## Versioning

Semver. Breaking changes require a major bump.

## Publishing

Publishes to GitHub Packages on tag push (`v*.*.*`) via `.github/workflows/publish.yml` in the keel repo.
