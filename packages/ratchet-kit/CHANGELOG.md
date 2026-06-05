# Changelog

All notable changes to `@camelburrito/ratchet-kit` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver.

## [0.2.0] — 2026-06-05

### Added
- `noImportantCss` — detects `!important` declarations in CSS. Defends against specificity escalation that papers over real cascade bugs.
- `no3CharHexInTsx` — detects 3-char hex shorthand inside string literals (`'#F00'`, `"#abc"`). Companion to `noBareHexInTsx` (which catches 6/8-char).
- `noBareRgbaInCss` — detects bare `rgba(...)` call sites in CSS. Closes the alpha-channel blind spot in `noBareHexInCss`. Each call site counts independently (a multi-shadow declaration with 2 rgbas = 2 violations).
- `noBareHexInSwift` — detects bare `#hex` color literals + `0xNN / 255` byte-channel constructors in Swift source. Cross-platform parity with `noBareHexInTsx` + `noBareHexInCss`. Honors `stripSwiftCommentsAndDebugBlocks` (skips `//` + `#if DEBUG`) and `stripSwiftPreviewBlocks` (skips `#Preview { ... }` canvas blocks).

Total ratchet exports: 5 → 9. Helpers + types unchanged. 33 → 48 test cases.

## [0.1.0] — 2026-06-05

### Added
- Initial extraction from chorz/src/__tests__. Helpers (`stripTsLineAndBlockComments`, `stripSwiftCommentsAndDebugBlocks`, `stripSwiftPreviewBlocks`, `countMatchesIgnoringBrands`, `checkDeferralCount`, `walkFiles`, `runRatchet`) + 5 most-portable structural ratchet templates: `noInlineStyle`, `noBareHexInTsx`, `noBareHexInCss`, `noBarePxInCss`, `noConsoleInSource`. 33 smoke-test cases.
