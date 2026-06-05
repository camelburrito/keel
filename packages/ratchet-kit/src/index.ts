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

// v0.1 ratchet templates (5 of the ~22 chorz ratchets — the most-portable
// agnostic structural defenders). Future versions add the rest as patterns
// prove portable across downstream products.
export { noInlineStyle, countInlineStyles } from './ratchets/no-inline-style';
export { noBareHexInTsx, countBareHexInTsx } from './ratchets/no-bare-hex-in-tsx';
export { noBareHexInCss, countBareHexInCss } from './ratchets/no-bare-hex-in-css';
export { noBarePxInCss, countBarePxInCss } from './ratchets/no-bare-px-in-css';
export { noConsoleInSource, countConsoleInSource } from './ratchets/no-console-in-source';
