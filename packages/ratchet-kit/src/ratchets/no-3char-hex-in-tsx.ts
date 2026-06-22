// Detects 3-char hex shorthand inside string literals in .tsx/.ts source
// (e.g., `'#F00'`, `"#abc"`). Parallel coverage with noBareHexInTsx (which
// catches 6/8-char), since the regex shapes are distinct enough to warrant
// separate scans — 3-char tends to slip past the broader pattern.

import { stripTsLineAndBlockComments, runRatchet, type RatchetConfig } from '../helpers';

// Only matches QUOTED 3-char hex — un-quoted would false-positive on
// length-3 hex prefixes inside longer identifiers / paths.
const PATTERN = /['"]#[0-9a-fA-F]{3}['"]/g;

export function count3CharHexInTsx(source: string): number {
  const stripped = stripTsLineAndBlockComments(source);
  return (stripped.match(PATTERN) ?? []).length;
}

/**
 * No-3-char-hex-in-tsx ratchet. Companion to noBareHexInTsx for the
 * shorthand variant `'#F00'` which the broader hex pattern can miss.
 *
 * @example
 *   no3CharHexInTsx({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.tsx', '.ts'],
 *     ignoredPrefixes: ['ui/', '__tests__/'],
 *     expectedCounts: {},
 *   });
 */
export function no3CharHexInTsx(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-3char-hex-in-tsx',
    countMatches: count3CharHexInTsx,
    repairRecipe:
      'Replace the 3-char hex shorthand with the matching token reference ' +
      '(`var(--color-*)`). Tokens defined in shared/tokens/tokens.json never ' +
      'use 3-char shorthand.',
  });
}
