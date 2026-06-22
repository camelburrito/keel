// Detects bare viewport units (`vh`, `vw`, `vmin`, `vmax`) and `em` values in
// CSS modules — the alpha-channel-free siblings to `noBarePxInCss`. These
// bypass the spacing / sizing token system in the same way bare `Npx` does.
//
// DETECTION:
//   /:\s*-?[0-9]+(?:\.[0-9]+)?(?:vh|vw|vmin|vmax|em)\b/g
//   Leading `:\s*` anchors to declaration values (not media-query parens).
//   `-?` catches negative letter-spacing values (e.g. `-0.05em`).
//
// CSS block comments are stripped before scanning so `/* example: 100vh */`
// doesn't false-positive.

import { runRatchet, type RatchetConfig } from '../helpers';

export function countBareViewportEmInCss(source: string): number {
  // Strip CSS block comments first.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return (
    stripped.match(/:\s*-?[0-9]+(?:\.[0-9]+)?(?:vh|vw|vmin|vmax|em)\b/g) ?? []
  ).length;
}

/**
 * No-bare-viewport-em-in-css ratchet. Companion to noBarePxInCss for the
 * viewport-unit + em axis.
 *
 * @example
 *   noBareViewportEmInCss({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.css'],
 *     ignoredFiles: new Set(['ui/tokens.generated.css']),
 *     expectedCounts: {},
 *   });
 */
export function noBareViewportEmInCss(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-viewport-em-in-css',
    countMatches: countBareViewportEmInCss,
    repairRecipe:
      'Replace the bare viewport/em literal with a token reference. If the ' +
      'value is intentionally off-scale (e.g., a viewport-fill page-shell ' +
      '`100vh`), extract a named CSS custom property with an inline ' +
      'rationale comment.',
  });
}
