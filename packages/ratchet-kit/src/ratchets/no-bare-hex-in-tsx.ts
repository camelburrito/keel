// Detects bare `#hex` color literals in `.tsx` / `.ts` source — defends the
// token mandate. Hex literals belong in `shared/tokens/tokens.json`, accessed
// via the generated CSS-var / Swift-literal output, never inline.

import { stripTsLineAndBlockComments, runRatchet, type RatchetConfig } from '../helpers';

// 3-char or 6-char or 8-char hex, with word boundaries.
const BARE_HEX_RE = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g;

export function countBareHexInTsx(source: string): number {
  const stripped = stripTsLineAndBlockComments(source);
  return (stripped.match(BARE_HEX_RE) ?? []).length;
}

/**
 * No-bare-hex-in-tsx ratchet. Defends the design-system token mandate by
 * blocking inline `#hex` color literals in feature code.
 *
 * @example
 *   noBareHexInTsx({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.tsx', '.ts'],
 *     ignoredPrefixes: ['ui/', '__tests__/'],
 *     expectedCounts: {},
 *   });
 */
export function noBareHexInTsx(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-hex-in-tsx',
    countMatches: countBareHexInTsx,
    repairRecipe:
      'Replace the `#hex` literal with a design-system token reference (e.g., ' +
      '`var(--color-accent-primary)`). If a one-off off-grid color is genuinely ' +
      'needed, extract it to a named constant with the Mandate-3 comment shape: ' +
      '`// Design-intent constant — <reason> (see GH #<issue>)`.',
  });
}
