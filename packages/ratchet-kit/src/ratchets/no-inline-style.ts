// Detects inline `style={{...}}` JSX props + `createElement(<tag>, { style: {...} })`
// variants. The createElement form closes the bypass that JSX-only regex misses.

import { stripTsLineAndBlockComments, runRatchet, type RatchetConfig } from '../helpers';

export function countInlineStyles(source: string): number {
  const stripped = stripTsLineAndBlockComments(source);
  const jsxMatches = stripped.match(/style=\{\{/g) ?? [];
  const createElementMatches =
    stripped.match(
      /(?:React\.)?createElement\s*\(\s*[\s\S]*?,\s*\{[\s\S]{0,300}?style\s*:\s*\{/g,
    ) ?? [];
  return jsxMatches.length + createElementMatches.length;
}

/**
 * No-inline-style ratchet. Defends the design-system token mandate by
 * blocking inline `style={{...}}` in feature code.
 *
 * @example
 *   noInlineStyle({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.tsx', '.ts'],
 *     ignoredPrefixes: ['ui/', '__tests__/', 'screenshot-harness/'],
 *     ignoredFiles: new Set(['pages/ComponentsPage.tsx']),
 *     expectedCounts: {}, // strict zero — or grandfather legacy files
 *   });
 */
export function noInlineStyle(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-inline-style',
    countMatches: countInlineStyles,
    repairRecipe:
      'Move the inline styles into a co-located .module.css. If unavoidable (rare), ' +
      'add the file to expectedCounts with a written justification.',
  });
}
