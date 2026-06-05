// @camelburrito/ratchet-kit — configurable strict-zero ratchet templates for
// keel-derived projects. See keel playbook 07-ratchet-framework.md.

// Shared helpers
export {
  type DeferralEntry,
  type RatchetConfig,
  type RatchetRunOptions,
  type WalkOptions,
  stripTsLineAndBlockComments,
  stripSwiftCommentsAndDebugBlocks,
  stripSwiftPreviewBlocks,
  checkDeferralCount,
  countMatchesIgnoringBrands,
  walkFiles,
  runRatchet,
} from './helpers';

// v0.1 ratchets — most-portable structural defenders.
export { noInlineStyle, countInlineStyles } from './ratchets/no-inline-style';
export { noBareHexInTsx, countBareHexInTsx } from './ratchets/no-bare-hex-in-tsx';
export { noBareHexInCss, countBareHexInCss } from './ratchets/no-bare-hex-in-css';
export { noBarePxInCss, countBarePxInCss } from './ratchets/no-bare-px-in-css';
export { noConsoleInSource, countConsoleInSource } from './ratchets/no-console-in-source';

// v0.2 additions — cross-platform parity (Swift hex) + companion ratchets for
// the most-common drift classes (rgba, 3-char hex shorthand, !important).
export { noImportantCss, countImportants } from './ratchets/no-important-css';
export { no3CharHexInTsx, count3CharHexInTsx } from './ratchets/no-3char-hex-in-tsx';
export { noBareRgbaInCss, countBareRgbaInCss } from './ratchets/no-bare-rgba-in-css';
export { noBareHexInSwift, countBareHexInSwift } from './ratchets/no-bare-hex-in-swift';

// v0.3 additions — Swift design-system completeness pack. Locks size,
// duration, font-size, and color-constructor literals out of Swift feature
// code. Pairs with noBareHexInSwift to make Swift the same strict-token-only
// surface as web.
export { noBareSizeInSwift, countBareSizeInSwift } from './ratchets/no-bare-size-in-swift';
export { noBareDurationInSwift, countBareDurationInSwift } from './ratchets/no-bare-duration-in-swift';
export { noBareFontSizeInSwift, countBareFontSizeInSwift } from './ratchets/no-bare-font-size-in-swift';
export { noBareColorConstructorInSwift, countBareColorConstructorInSwift } from './ratchets/no-bare-color-constructor-in-swift';

// v0.4 additions — CSS pack completeness (font-property + viewport-em sibling
// detectors to noBarePxInCss / noBareHexInCss) plus two structural ratchets
// for cross-cutting infrastructure (E2E selector orphans + paths-filter
// shallow-clone trap).
export { noBareFontPropertyInCss, countBareFontPropertyInCss } from './ratchets/no-bare-font-property-in-css';
export { noBareViewportEmInCss, countBareViewportEmInCss } from './ratchets/no-bare-viewport-em-in-css';
export { noStaleE2eSelectors, buildProductionHaystack } from './ratchets/no-stale-e2e-selectors';
export type { NoStaleE2eSelectorsConfig } from './ratchets/no-stale-e2e-selectors';
export { noPathsFilterWithoutFetchDepthZero, findOffendersInWorkflow } from './ratchets/no-paths-filter-without-fetch-depth-zero';
export type { NoPathsFilterWithoutFetchDepthZeroConfig } from './ratchets/no-paths-filter-without-fetch-depth-zero';

// v0.5 additions — codegen-output regression gate + 2 deploy-shape drift gates.
// Each carries its own configurable shape (not the RatchetConfig template)
// because each scans different surfaces (file lists vs. firebase.json
// manifests vs. two-file text-mirror checks).
export { noBareHexInCodegenOutput, countBareHexInCodegenOutput } from './ratchets/no-bare-hex-in-codegen-output';
export type { NoBareHexInCodegenOutputConfig } from './ratchets/no-bare-hex-in-codegen-output';
export { lockfileSyncWithPackageJson } from './ratchets/lockfile-sync-with-package-json';
export type {
  LockfileSyncWithPackageJsonConfig,
  LockfileSyncCodebase,
} from './ratchets/lockfile-sync-with-package-json';
export { ratchetListPrecommitVsWorkflow, extractRatchetPaths } from './ratchets/ratchet-list-precommit-vs-workflow';
export type { RatchetListPrecommitVsWorkflowConfig } from './ratchets/ratchet-list-precommit-vs-workflow';

// Future versions graduate more ratchets as patterns prove portable across
// downstream products. Project-specific ratchets (e.g., `no-legacy-kid-cta-token`
// in chorz) live in the project's own src/__tests__/ — see
// recipes/add-a-ratchet.md.
