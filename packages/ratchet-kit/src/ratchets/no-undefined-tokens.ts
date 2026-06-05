// Every `var(--xyz)` reference in any consumer CSS file MUST resolve to a
// custom property name DEFINED in the configured token source files. Catches
// the bug class where a feature CSS references `var(--colr-danger)` (typo)
// or `var(--color-some-token)` (token never added to the source) — both
// render transparent / fallback in production while passing every other gate.
//
// SHAPE
//   Pure `fs` + regex — no CSS parser, zero new deps. Sufficient for a
//   disciplined design-system pipeline where the token source files are the
//   declared single point of truth.
//
// SCOPE
//   - Scans all files matching `consumerExtensions` under `consumerScanRoot`.
//   - Matches `var(--name)` AND `var(--name, fallback)` syntax (fallback is
//     ignored — it's NOT a token reference).
//   - Matches nested usages inside `color-mix()`, `rgb()`, `calc()`, etc.
//   - Excludes the token source files themselves (they DEFINE, they don't
//     CONSUME).
//
// OUT OF SCOPE (deliberate)
//   - `.tsx` / `.ts` files with inline `style={{ color: 'var(--...)' }}` —
//     extend `consumerExtensions` if you want to cover them.
//   - CSS comment stripping — by convention any token named in a comment is
//     also a real token elsewhere. Add a comment-strip pre-pass if your
//     pipeline ever introduces commented-token false-positives.
//
// RUNTIME-INJECTED PREFIXES
//   Some frameworks inject custom properties at runtime (Tailwind: `--tw-*`,
//   future plugins: `--theme-*`). Pass these via `runtimeInjectedPrefixes`
//   so they short-circuit the defined-set check.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface NoUndefinedTokensConfig {
  /** Absolute path to walk for consumer CSS files. */
  consumerScanRoot: string;
  /**
   * Absolute paths to files that DEFINE custom properties. Typically a token
   * codegen output + an additive overrides layer.
   */
  tokenSourceFiles: string[];
  /**
   * File extensions to scan as consumers. Default `['.css']` (covers both
   * `foo.css` AND `foo.module.css` since both end in `.css`).
   */
  consumerExtensions?: string[];
  /**
   * Directory basenames to skip during the walk. Default
   * `['node_modules', '__tests__', '__mocks__', 'test-utils']`.
   */
  ignoredDirs?: ReadonlySet<string>;
  /**
   * Relative-from-`consumerScanRoot` paths to exclude. Typically the token
   * source files themselves (they DEFINE, they don't CONSUME).
   */
  ignoredFiles?: ReadonlySet<string>;
  /**
   * Custom-property prefixes injected at runtime by frameworks (e.g.,
   * Tailwind `--tw-*`). References starting with these prefixes are
   * allow-listed regardless of the defined-set. Default `[]`.
   */
  runtimeInjectedPrefixes?: string[];
}

/**
 * Extract every CSS custom-property DEFINITION from a CSS source string.
 * Matches `  --color-primary: #f53d6b;` regardless of enclosing selector
 * (`:root`, `.dark`, component-scoped, etc.).
 *
 * Returns names INCLUDING the leading `--` for lossless comparison against
 * `extractReferencedTokens` output.
 */
export function extractDefinedTokens(source: string): Set<string> {
  const out = new Set<string>();
  const re = /^\s*(--[a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    out.add(match[1]!);
  }
  return out;
}

/**
 * Extract every `var(--name)` REFERENCE from a CSS source string. Matches
 * both `var(--x)` and `var(--x, fallback)`. Fallback strings are ignored
 * (they are NOT token references). Returns occurrences in source order
 * with the 1-indexed line number for stable diagnostics.
 */
export function extractReferencedTokens(
  source: string,
): Array<{ name: string; line: number }> {
  const out: Array<{ name: string; line: number }> = [];
  const re = /var\(\s*(--[a-zA-Z_][a-zA-Z0-9_-]*)\s*[,)]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const line = source.slice(0, match.index).split('\n').length;
    out.push({ name: match[1]!, line });
  }
  return out;
}

function walkConsumers(
  dir: string,
  extensions: string[],
  ignoredDirs: ReadonlySet<string>,
  out: string[] = [],
): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (ignoredDirs.has(entry)) continue;
      walkConsumers(full, extensions, ignoredDirs, out);
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * No-undefined-tokens ratchet.
 *
 * @example
 *   noUndefinedTokens({
 *     consumerScanRoot: path.join(__dirname, '..'),
 *     tokenSourceFiles: [
 *       path.join(__dirname, '..', 'ui', 'tokens.generated.css'),
 *       path.join(__dirname, '..', 'ui', 'tokens.css'),
 *     ],
 *     ignoredFiles: new Set(['ui/tokens.generated.css', 'ui/tokens.css']),
 *   });
 */
export function noUndefinedTokens(config: NoUndefinedTokensConfig): void {
  const {
    consumerScanRoot,
    tokenSourceFiles,
    consumerExtensions = ['.css'],
    ignoredDirs = new Set(['node_modules', '__tests__', '__mocks__', 'test-utils']),
    ignoredFiles = new Set<string>(),
    runtimeInjectedPrefixes = [],
  } = config;

  if (tokenSourceFiles.length === 0) {
    throw new Error(
      'no-undefined-tokens: tokenSourceFiles must contain at least one file.',
    );
  }

  // 1. Build defined-set from every token source file.
  const defined = new Set<string>();
  for (const file of tokenSourceFiles) {
    const src = readFileSync(file, 'utf-8');
    for (const name of extractDefinedTokens(src)) {
      defined.add(name);
    }
  }

  if (defined.size === 0) {
    throw new Error(
      `no-undefined-tokens: tokenSourceFiles (${tokenSourceFiles
        .map((f) => `'${f}'`)
        .join(', ')}) contained zero --token-name: declarations. ` +
        `Either the source-of-truth files are wrong or empty.`,
    );
  }

  // 2. Walk consumers + collect violations.
  const consumers = walkConsumers(
    consumerScanRoot,
    consumerExtensions,
    ignoredDirs,
  ).filter((f) => !ignoredFiles.has(relative(consumerScanRoot, f)));

  const violations: string[] = [];
  for (const file of consumers) {
    const rel = relative(consumerScanRoot, file);
    const content = readFileSync(file, 'utf-8');
    for (const { name, line } of extractReferencedTokens(content)) {
      if (runtimeInjectedPrefixes.some((p) => name.startsWith(p))) continue;
      if (!defined.has(name)) {
        violations.push(`${rel}:${line}: references undefined token ${name}`);
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `no-undefined-tokens ratchet violated.\n\n` +
        `Every var(--xyz) reference must resolve to a name defined in:\n` +
        tokenSourceFiles.map((f) => `  • ${f}`).join('\n') +
        `\n\nViolations:\n` +
        violations.map((v) => `  ${v}`).join('\n'),
    );
  }
}
