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

// Future versions graduate more ratchets as patterns prove portable across
// downstream products. Project-specific ratchets (e.g., `no-legacy-kid-cta-token`
// in chorz) live in the project's own src/__tests__/ — see
// recipes/add-a-ratchet.md.
