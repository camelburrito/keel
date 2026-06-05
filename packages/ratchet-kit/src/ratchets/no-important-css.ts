// Detects `!important` declarations in CSS — defends against specificity
// escalation that papers over real cascade bugs. A parent rule is wrong;
// fix it upstream rather than override with !important.

import { runRatchet, type RatchetConfig } from '../helpers';

export function countImportants(source: string): number {
  return (source.match(/!important/g) ?? []).length;
}

/**
 * No-important-css ratchet.
 *
 * @example
 *   noImportantCss({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.css'],
 *     ignoredPrefixes: ['__tests__/'],
 *     expectedCounts: {},
 *   });
 */
export function noImportantCss(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-important-css',
    countMatches: countImportants,
    repairRecipe:
      'Fix the underlying specificity issue (parent selector is over-specific, ' +
      'or the override belongs in a primitive prop). Don\'t use !important to ' +
      'paper over cascade bugs.',
  });
}
