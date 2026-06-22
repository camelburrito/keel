// Detects bare `rgba(...)` call sites in CSS — closes the alpha-channel
// blind spot in noBareHexInCss (hex literals are caught there, but
// rgba/rgb constructors aren't). Defends the same token mandate.
//
// Counts every call site — a single `box-shadow: ..., rgba(...), ..., rgba(...)`
// declaration counts as 2 because each rgba is independent drift.

import { runRatchet, type RatchetConfig } from '../helpers';

export function countBareRgbaInCss(source: string): number {
  // Strip CSS block comments first.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return (stripped.match(/\brgba\s*\(/g) ?? []).length;
}

/**
 * No-bare-rgba-in-css ratchet. Companion to noBareHexInCss for the
 * `rgba(...)` constructor variant.
 *
 * @example
 *   noBareRgbaInCss({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.css'],
 *     ignoredFiles: new Set(['ui/tokens.generated.css']),
 *     expectedCounts: {},
 *   });
 */
export function noBareRgbaInCss(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-rgba-in-css',
    countMatches: countBareRgbaInCss,
    repairRecipe:
      'Replace the `rgba(...)` literal with a token reference. If the alpha ' +
      'channel is the intent, define an alpha-bearing token in tokens.json ' +
      '(e.g., --color-overlay-scrim with hex8 #RRGGBBAA) and reference it.',
  });
}
