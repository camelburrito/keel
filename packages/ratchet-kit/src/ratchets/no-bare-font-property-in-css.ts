// Detects bare `letter-spacing`, `line-height`, `font-weight` values in CSS
// modules that don't route through the `--letter-spacing-*` / `--line-height-*`
// / `--font-weight-*` tokens. Pairs with noBarePxInCss for the size axis and
// noBareViewportEmInCss for the viewport-unit axis.
//
// DETECTION:
//   /(?:letter-spacing|line-height|font-weight):\s*-?[0-9]/g
//   Anchors at declaration value (after `:`); matches `-?` to catch negative
//   letter-spacing. `var(--token)` and keyword values (`inherit`, `normal`)
//   are NOT caught.

import { runRatchet, type RatchetConfig } from '../helpers';

export function countBareFontPropertyInCss(source: string): number {
  // Strip CSS block comments first.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return (
    stripped.match(/(?:letter-spacing|line-height|font-weight):\s*-?[0-9]/g) ?? []
  ).length;
}

/**
 * No-bare-font-property-in-css ratchet. Locks letter-spacing / line-height /
 * font-weight values through the typography token system.
 *
 * @example
 *   noBareFontPropertyInCss({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.css'],
 *     ignoredFiles: new Set([
 *       'ui/reset.css',
 *       'ui/tokens.css',
 *       'ui/tokens.generated.css',
 *     ]),
 *     expectedCounts: {},
 *   });
 */
export function noBareFontPropertyInCss(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-font-property-in-css',
    countMatches: countBareFontPropertyInCss,
    repairRecipe:
      'Replace the bare letter-spacing / line-height / font-weight value with ' +
      'a `var(--letter-spacing-*)` / `var(--line-height-*)` / `var(--font-weight-*)` ' +
      'reference. If the value is design-intentionally off the type scale, ' +
      'extract a named CSS custom property with a one-line rationale comment.',
  });
}
