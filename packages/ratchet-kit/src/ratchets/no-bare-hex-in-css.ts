// Detects bare `#hex` color literals in `.css` / `.module.css` source —
// defends the token mandate. CSS hex literals should be `var(--color-*)`
// references; the only place hex literals legitimately appear is the
// generated tokens CSS file itself.

import { runRatchet, type RatchetConfig } from '../helpers';

const BARE_HEX_RE = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g;

export function countBareHexInCss(source: string): number {
  // Strip CSS block comments only — `//` is not a CSS comment.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return (stripped.match(BARE_HEX_RE) ?? []).length;
}

/**
 * No-bare-hex-in-css ratchet.
 *
 * @example
 *   noBareHexInCss({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.css'],
 *     ignoredFiles: new Set(['ui/tokens.generated.css', 'ui/tokens.css']),
 *     expectedCounts: {},
 *   });
 */
export function noBareHexInCss(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-hex-in-css',
    countMatches: countBareHexInCss,
    repairRecipe:
      'Replace the `#hex` literal with the matching CSS custom property ' +
      '(`var(--color-*)`). The generated `tokens.generated.css` file is the ' +
      'only legitimate home for raw hex.',
  });
}
