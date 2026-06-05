// Detects bare `Npx` literals in CSS — defends the spacing-token mandate.
// Spacing values should be `var(--spacing-*)` references or design-intent
// off-grid named constants.

import { runRatchet, type RatchetConfig } from '../helpers';

// Bare Npx literal NOT preceded by a `--` token-decl prefix or inside a
// `var()` reference. The negative-lookbehind `(?<!--[\w-]*)` skips
// `--my-token: 16px` declarations. The leading `\b` + non-token character
// class avoids matching inside other unit tokens.
const BARE_PX_RE = /\b\d+(?:\.\d+)?px\b/g;

export function countBarePxInCss(source: string): number {
  // Strip CSS block comments.
  let stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip `--token: ...px` declaration RHS — those are token definitions.
  // Keep it simple: drop everything between `--<token>:` and the next `;`.
  stripped = stripped.replace(/--[\w-]+\s*:\s*[^;]+;/g, '');
  return (stripped.match(BARE_PX_RE) ?? []).length;
}

/**
 * No-bare-px-in-css ratchet.
 *
 * @example
 *   noBarePxInCss({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.css'],
 *     ignoredFiles: new Set(['ui/tokens.generated.css']),
 *     expectedCounts: {},
 *   });
 */
export function noBarePxInCss(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-px-in-css',
    countMatches: countBarePxInCss,
    repairRecipe:
      'Replace the bare `Npx` literal with the matching CSS custom property ' +
      '(`var(--spacing-*)`). For genuine off-grid values, extract a named ' +
      'constant with the Mandate-3 comment shape.',
  });
}
