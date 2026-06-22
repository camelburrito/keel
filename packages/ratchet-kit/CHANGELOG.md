# Changelog

All notable changes to `@camelburrito/ratchet-kit` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver.

## [0.7.4] — 2026-06-22

### Changed
- Relicensed from PolyForm Noncommercial 1.0.0 to **MIT** (`license` field + bundled `LICENSE` file). No code or public-API change.

## [0.7.3]

### Added (consolidated 0.4.0 → 0.7.3)
- **0.4.x:** `noBareFontPropertyInCss`, `noBareViewportEmInCss`, `noStaleE2eSelectors`, `noPathsFilterWithoutFetchDepthZero`.
- **0.5.x:** `noBareHexInCodegenOutput`, `lockfileSyncWithPackageJson`, `ratchetListPrecommitVsWorkflow`.
- **0.6.x:** `noUndefinedTokens`.
- **0.7.x:** `archDocIntegrity` (link/anchor/cited-path resolution + mermaid render-trap + classDef contrast + footer checks), `noAdaptiveFgOnKeptLightIsland` (dark-mode foreground-on-island polarity; adaptive set self-derived from `tokens.json` `darkColor`).

Total ratchet templates: 13 → 23.

_(Per-version dates between 0.3.0 and 0.7.3 were not recorded individually; this entry consolidates the additions in that range.)_

## [0.3.0] — 2026-06-05

### Added — Swift design-system completeness pack
- `noBareSizeInSwift` — detects bare numeric size literals across 6 Swift API surfaces: `.padding(N)`, `.padding(.horizontal, N)`, `.cornerRadius(N)`, `.frame(width:height:)`, `.offset(x:y:)`, `Spacing.custom(N)`, and bare `let X: CGFloat = N` declarations. Honors the Mandate-3 `// Design-intent constant — <reason> (see GH #<issue>)` escape on the same line or preceding line.
- `noBareDurationInSwift` — detects bare numeric duration literals across 7 surfaces: `duration: N`, `.seconds(N)`, `.milliseconds(N)`, `.delay(N)`, `asyncAfter(deadline: .now() + N)`, `withTimeInterval: N`, `.spring(response: N, ...)`.
- `noBareFontSizeInSwift` — detects bare numeric font sizes: `.system(size: N)`, `.custom("...", size: N)`, `UIFont.systemFont(ofSize: N)`, `UIFont(name:..., size: N)`.
- `noBareColorConstructorInSwift` — detects bare `Color(red: <numeric> ...)` constructor calls. Use generated `Colors.*` tokens instead.

Together these complete the Swift side of the design-system token mandate — Swift is now the same strict-token-only surface as web. Total ratchet exports: 9 → 13. 48 → 73 test cases.

## [0.2.0] — 2026-06-05

### Added
- `noImportantCss` — detects `!important` declarations in CSS. Defends against specificity escalation that papers over real cascade bugs.
- `no3CharHexInTsx` — detects 3-char hex shorthand inside string literals (`'#F00'`, `"#abc"`). Companion to `noBareHexInTsx` (which catches 6/8-char).
- `noBareRgbaInCss` — detects bare `rgba(...)` call sites in CSS. Closes the alpha-channel blind spot in `noBareHexInCss`. Each call site counts independently (a multi-shadow declaration with 2 rgbas = 2 violations).
- `noBareHexInSwift` — detects bare `#hex` color literals + `0xNN / 255` byte-channel constructors in Swift source. Cross-platform parity with `noBareHexInTsx` + `noBareHexInCss`. Honors `stripSwiftCommentsAndDebugBlocks` (skips `//` + `#if DEBUG`) and `stripSwiftPreviewBlocks` (skips `#Preview { ... }` canvas blocks).

Total ratchet exports: 5 → 9. Helpers + types unchanged. 33 → 48 test cases.

## [0.1.0] — 2026-06-05

### Added
- Initial extraction. Helpers (`stripTsLineAndBlockComments`, `stripSwiftCommentsAndDebugBlocks`, `stripSwiftPreviewBlocks`, `countMatchesIgnoringBrands`, `checkDeferralCount`, `walkFiles`, `runRatchet`) + 5 most-portable structural ratchet templates: `noInlineStyle`, `noBareHexInTsx`, `noBareHexInCss`, `noBarePxInCss`, `noConsoleInSource`. 33 smoke-test cases.
