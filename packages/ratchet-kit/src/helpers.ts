// Shared helpers for the strict-zero-with-carve-outs ratchet pattern.
// Hoisted from chorz's src/__tests__/_ratchetHelpers.ts. Consumers import these
// rather than redefining inline so all ratchets stay in sync on the
// count-tracked deferral semantics.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Documented carve-out for a strict-zero ratchet.
 *
 * - `count` — exact number of legitimate violations in the deferred file.
 *   Adding sites OR migrating without updating count BOTH break the gate.
 * - `rationale` — non-empty justification for why the file is deferred
 *   instead of migrated. Same bar as adding a `// eslint-disable`.
 */
export interface DeferralEntry {
  readonly count: number;
  readonly rationale: string;
}

/**
 * Strip TypeScript / TSX line comments (`//...\n`) and block comments
 * from source text. Use in regex-based ratchets that need to scan code
 * WITHOUT false-positives from explanatory comment text mentioning the
 * very pattern they're meant to catch.
 *
 * Caveat: does NOT honor string-literal boundaries — `//` inside a single-line
 * string like `'https://x'` is consumed to end-of-line. Acceptable for the
 * ratchet use case because (a) the only consequence is the scan misses content
 * INSIDE the string from the `//` onward, and (b) the patterns these ratchets
 * enforce don't legitimately live inside URL-string trailers.
 */
export function stripTsLineAndBlockComments(src: string): string {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/[^\n]*/g, '');
  return out;
}

/**
 * Strip Swift line comments (`//...\n`) and `#if DEBUG ... #endif` blocks.
 * The DEBUG-block strip ensures debug-only source paths aren't scanned.
 */
export function stripSwiftCommentsAndDebugBlocks(src: string): string {
  // Strip `#if DEBUG` blocks (multi-line). Handle nested #if by tracking depth.
  let out = src;
  while (true) {
    const match = out.match(/#if\s+DEBUG[\s\S]*?#endif/);
    if (!match) break;
    out = out.slice(0, match.index) + out.slice((match.index ?? 0) + match[0].length);
  }
  // Strip `//` line comments.
  out = out.replace(/\/\/[^\n]*/g, '');
  // Strip `/* ... */` block comments.
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  return out;
}

/**
 * Strip SwiftUI `#Preview { ... }` canvas blocks from source. Preview blocks
 * are dev-only canvas content that shouldn't be scanned by user-facing-string
 * or design-system ratchets.
 */
export function stripSwiftPreviewBlocks(src: string): string {
  // Simple bracket-matching for `#Preview ... { ... }` (single brace depth).
  let out = src;
  while (true) {
    const startIdx = out.search(/#Preview\b/);
    if (startIdx === -1) break;
    // Find the opening `{` after #Preview.
    const braceIdx = out.indexOf('{', startIdx);
    if (braceIdx === -1) break;
    // Match braces forward.
    let depth = 1;
    let i = braceIdx + 1;
    while (i < out.length && depth > 0) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') depth--;
      i++;
    }
    if (depth !== 0) break; // malformed source; bail
    out = out.slice(0, startIdx) + out.slice(i);
  }
  return out;
}

/**
 * Check the actual count for a deferred file against the expected count.
 * Returns a violation message or `null` if the count matches.
 *
 * Four failure branches:
 *  0. Rationale empty / whitespace → fail.
 *  1. Expected entry exists but file produced no count → file doesn't exist
 *     or is outside the scan scope (carve-out went stale).
 *  2. actual > expected → new violation introduced; migrate or update count.
 *  3. actual < expected → a site was migrated; decrement count or drop the
 *     entry entirely.
 */
export function checkDeferralCount(
  relPath: string,
  expected: DeferralEntry,
  actual: number | undefined,
  mapName: string,
): string | null {
  if (typeof expected.rationale !== 'string' || expected.rationale.trim() === '') {
    return (
      `  • ${mapName} entry '${relPath}' has an empty rationale. Each ` +
      `deferral must document WHY the migration is deferred (same bar as ` +
      `// eslint-disable). Add a one-line justification.`
    );
  }
  if (actual === undefined) {
    return (
      `  • ${mapName} entry '${relPath}' references a file that does not ` +
      `exist or is outside the scan scope`
    );
  }
  if (actual === expected.count) return null;
  const verb = actual > expected.count ? 'grew' : 'shrunk';
  const directive =
    actual > expected.count
      ? `New site introduced — migrate or update ${mapName} count.`
      : `A site was migrated — decrement ${mapName} count or remove the entry.`;
  return (
    `  • ${relPath}: deferred carve-out ${verb} (expected ${expected.count}, ` +
    `found ${actual}). ${directive}`
  );
}

/**
 * Count matches in a string, second-pass-filtering matches whose value
 * appears in the brand-string allowlist (e.g., `'Google'`, `'Apple'`,
 * `'iOS'` — strings that legitimately appear in source but aren't a
 * translation/redaction target).
 *
 * Caller's regex must use capture group 1 for the value to check; this
 * helper takes the regex matches via `matchAll` and runs `brands.has(match[1])`.
 */
export function countMatchesIgnoringBrands(
  source: string,
  pattern: RegExp,
  brands: ReadonlySet<string>,
): number {
  let count = 0;
  for (const m of source.matchAll(pattern)) {
    const value = m[1];
    if (value && brands.has(value)) continue;
    count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// File walker used by every ratchet
// ─────────────────────────────────────────────────────────────────────────────

export interface WalkOptions {
  /** Absolute root directory to walk from. */
  root: string;
  /** File-extension filter; matches `.ts`, `.tsx`, `.css`, `.swift`, etc. */
  extensions: string[];
  /** Directory names (basename match) to skip entirely. */
  ignoredDirs?: ReadonlySet<string>;
  /** Relative-path prefixes to skip (e.g., `'ui/'`, `'__tests__/'`). */
  ignoredPrefixes?: readonly string[];
  /** Exact relative-path matches to skip. */
  ignoredFiles?: ReadonlySet<string>;
}

/**
 * Walk `root` recursively, yielding `{ rel, full, source }` for every file
 * matching `extensions` and not excluded by `ignoredDirs`/`ignoredPrefixes`/
 * `ignoredFiles`. The relative path is normalized to forward slashes.
 */
export function* walkFiles(opts: WalkOptions): Generator<{ rel: string; full: string; source: string }> {
  const {
    root,
    extensions,
    ignoredDirs = new Set(['node_modules']),
    ignoredPrefixes = [],
    ignoredFiles = new Set<string>(),
  } = opts;

  function* recurse(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (ignoredDirs.has(entry)) continue;
        yield* recurse(full);
      } else {
        if (extensions.some((ext) => entry.endsWith(ext))) {
          yield full;
        }
      }
    }
  }

  for (const full of recurse(root)) {
    const rel = relative(root, full).split('\\').join('/');
    if (ignoredPrefixes.some((p) => rel.startsWith(p))) continue;
    if (ignoredFiles.has(rel)) continue;
    const source = readFileSync(full, 'utf-8');
    yield { rel, full, source };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic ratchet runner
// ─────────────────────────────────────────────────────────────────────────────

export interface RatchetConfig {
  /** Root directory of the project (typically `src/`). */
  root: string;
  /** File extensions to scan, e.g., `['.ts', '.tsx']` or `['.css']`. */
  extensions: string[];
  /** Baseline counts per relative path. Empty = strict zero. */
  expectedCounts?: Record<string, number>;
  /** Directory basenames to skip entirely. */
  ignoredDirs?: ReadonlySet<string>;
  /** Relative-path prefixes to skip. */
  ignoredPrefixes?: readonly string[];
  /** Exact relative-path matches to skip. */
  ignoredFiles?: ReadonlySet<string>;
}

export interface RatchetRunOptions extends RatchetConfig {
  /** Human-friendly name for failure messages, e.g., `'no-inline-style'`. */
  ratchetName: string;
  /** Per-file match counter. */
  countMatches: (source: string) => number;
  /** Repair-recipe text appended to the failure message. */
  repairRecipe: string;
}

/**
 * Generic ratchet runner. Walks files, counts matches per file, compares to
 * `expectedCounts`, and throws an Error with the violation list + repair
 * recipe if any drift detected.
 *
 * Violations:
 *   - NEW file with matches not in baseline → fail.
 *   - Baseline file count grew → fail.
 *   - Baseline file count shrunk → fail (please update baseline).
 */
export function runRatchet(opts: RatchetRunOptions): void {
  const {
    root,
    extensions,
    expectedCounts = {},
    ignoredDirs,
    ignoredPrefixes,
    ignoredFiles,
    ratchetName,
    countMatches,
    repairRecipe,
  } = opts;

  const actual: Record<string, number> = {};
  for (const { rel, source } of walkFiles({
    root,
    extensions,
    ignoredDirs,
    ignoredPrefixes,
    ignoredFiles,
  })) {
    const n = countMatches(source);
    if (n > 0) actual[rel] = n;
  }

  const violations: string[] = [];

  for (const [file, count] of Object.entries(actual)) {
    if (!(file in expectedCounts)) {
      violations.push(
        `NEW ${ratchetName} site: ${file} (${count} occurrence${count > 1 ? 's' : ''}).`,
      );
      continue;
    }
    const expected = expectedCounts[file] ?? 0;
    if (count > expected) {
      violations.push(
        `GROWTH in ${file}: baseline ${expected} → now ${count}.`,
      );
    }
  }

  for (const [file, expected] of Object.entries(expectedCounts)) {
    const count = actual[file] ?? 0;
    if (count < expected) {
      if (count === 0) {
        violations.push(
          `RATCHET: ${file} now has 0 ${ratchetName} sites (baseline: ${expected}). ` +
            `Please REMOVE it from expectedCounts.`,
        );
      } else {
        violations.push(
          `RATCHET: ${file} now has ${count} ${ratchetName} site${count > 1 ? 's' : ''} (baseline: ${expected}). ` +
            `Please update expectedCounts['${file}'] to ${count}.`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `${ratchetName} ratchet violated.\n\n${repairRecipe}\n\nViolations:\n` +
        violations.map((v) => `  • ${v}`).join('\n'),
    );
  }
}
