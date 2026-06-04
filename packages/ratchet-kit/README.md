# @camelburrito/ratchet-kit

Configurable strict-zero ratchet templates for keel-derived projects.

**Status:** scaffold. Extraction from `chorz/src/__tests__/no-*.test.ts` planned. See [keel playbook 07-ratchet-framework.md](../../docs/playbook/07-ratchet-framework.md).

## What this package provides

**Helpers** (shared utilities for any ratchet):
- `stripTsLineAndBlockComments(src: string)`
- `stripSwiftCommentsAndDebugBlocks(src: string)`
- `stripSwiftPreviewBlocks(src: string)`
- `countMatchesIgnoringBrands(matches, brands)`
- `DeferralEntry` shape + `checkDeferralCount(actual, deferred)`

**Ratchet templates** — each exported as a configurable function that takes `{ paths, expectedCounts?, deferrals?, allowDisableDirectives? }`:

| Export | Defends |
|--------|---------|
| `noInlineStyle` | inline `style={{}}` in `.tsx` |
| `noBareHexInTsx` | bare `#hex` in `.tsx` |
| `noBareHexInCss` | bare `#hex` in `.css` outside tokens |
| `noBareHexInSwift` | bare `#hex` in `.swift` |
| `noBarePxInCss` | bare `Npx` in `.css` |
| `noBareRgbaInCss` | `rgba(...)` outside tokens |
| `noBareSizeInSwift` | bare `: CGFloat = N` declarations |
| `noBareDurationInSwift` | bare `Duration` literals |
| `noBareFontSizeInSwift` | bare `.font(.system(size: N))` |
| `noBareColorConstructorInSwift` | bare `Color(red:green:blue:)` |
| `noBareFontPropertyInCss` | bare `font:` shorthand |
| `noBareViewportEmInCss` | bare `vh/vw/em/rem` |
| `noImportantCss` | `!important` declarations |
| `noUndefinedTokens` | CSS custom-prop refs to undefined tokens |
| `no3CharHexInTsx` | 3-char hex shorthand |
| `noBareHexInCodegenOutput` | hex literals in generator-emitted files |
| `noConsoleInSource` | `console.*` calls in source |
| `noBareFirebaseUidInLogger` | 28-char UID redaction in CF logger |
| `noStaleE2eSelectors` | orphan `data-testid` references in specs |
| `ratchetListPrecommitVsWorkflow` | pre-commit vs CI drift |
| `lockfileSyncWithPackageJson` | per-codebase lockfile drift |
| `noPathsFilterWithoutFetchDepthZero` | shallow-clone trap in GHA paths-filter |
| `cfUtilsTarballsCommitted` | committed-tarball integrity vs lockfile sha512 |

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
