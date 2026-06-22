// Drift catcher for E2E specs — scans every e2e spec file for testid literals
// (`getByTestId('foo')`, `data-testid="foo"`, `[data-testid="foo"]`,
// `[data-testid^="foo-"]`) and asserts each literal appears at least once in
// the project's production source.
//
// Catches the drift class where a UX revision deletes a `data-testid=` attr
// from production source but a spec keeps the assertion, silently passing
// via fallback selectors (e.g., `.or(page.locator('body'))` escape valves).
//
// SHAPE NOTES
//   - Spec files are listed via `git ls-files` so untracked ad-hoc specs are
//     ignored. Set `e2eGlobs` to the patterns the project uses for e2e.
//   - Production source haystack: concatenate all files matching the
//     `sourceGlobs` patterns, excluding test files. Caller controls scope.
//   - Tolerates runtime-templated testids: when a spec asserts on a CSS
//     prefix selector (`[data-testid^="foo-"]`), match against source-side
//     template literals (`` `foo-${id}` ``) and string-literal prefixes.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface NoStaleE2eSelectorsConfig {
  /** Absolute path to the repo root. */
  repoRoot: string;
  /**
   * `git ls-files` patterns for E2E spec files. Defaults to
   * `['e2e/**\/*.spec.ts', 'e2e/**\/*.spec.tsx']`.
   */
  e2eGlobs?: string[];
  /**
   * `git ls-files` patterns for production-source files. Defaults to
   * common web + iOS scope.
   */
  sourceGlobs?: string[];
  /**
   * File-name fragments that mark a file as a test (excluded from
   * production-source haystack). Defaults to `['__tests__/', '.test.ts', '.test.tsx', '.test.swift']`.
   */
  testFragments?: string[];
}

interface TestidUsage {
  literal: string;
  isPrefixMatch: boolean;
}

function extractTestidLiterals(content: string): TestidUsage[] {
  const usages = new Map<string, TestidUsage>();
  const add = (lit: string, isPrefix: boolean): void => {
    const prev = usages.get(lit);
    if (!prev || (isPrefix && !prev.isPrefixMatch)) {
      usages.set(lit, { literal: lit, isPrefixMatch: isPrefix });
    }
  };
  for (const m of content.matchAll(/getByTestId\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    add(m[1]!, false);
  }
  for (const m of content.matchAll(/data-testid\s*=\s*"([^"]+)"/g)) {
    add(m[1]!, false);
  }
  for (const m of content.matchAll(/\[data-testid\s*=\s*"([^"]+)"\]/g)) {
    add(m[1]!, false);
  }
  for (const m of content.matchAll(/\[data-testid\s*\^=\s*"([^"]+)"\]/g)) {
    add(m[1]!, true);
  }
  return Array.from(usages.values());
}

function existsInHaystack(usage: TestidUsage, haystack: string): boolean {
  const { literal, isPrefixMatch } = usage;
  if (isPrefixMatch) {
    return (
      haystack.includes(`\`${literal}`) ||
      haystack.includes(`"${literal}`) ||
      haystack.includes(`'${literal}`)
    );
  }
  if (haystack.includes(`"${literal}"`) || haystack.includes(`'${literal}'`)) {
    return true;
  }
  // Tolerate runtime-templated emitters: if production code builds the testid
  // via template (`` `foo-${id}` ``) and the spec asserts a CONCRETE rendered
  // value, look for the prefix template.
  const prefixMatch = literal.match(/^([a-z][a-z0-9-]*-)[a-zA-Z0-9_]+$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    if (
      haystack.includes(`\`${prefix}`) ||
      haystack.includes(`"${prefix}`) ||
      haystack.includes(`'${prefix}`)
    ) {
      return true;
    }
  }
  return false;
}

/** Build the production-source haystack by concatenating all matching files. */
export function buildProductionHaystack(config: NoStaleE2eSelectorsConfig): string {
  const {
    repoRoot,
    sourceGlobs = [
      'src/**/*.tsx',
      'src/**/*.ts',
      'apple/**/*.swift',
      'packages/**/*.swift',
      'packages/**/*.tsx',
      'packages/**/*.ts',
    ],
    testFragments = ['__tests__/', '.test.ts', '.test.tsx', '.test.swift'],
  } = config;

  const globsArg = sourceGlobs.map((g) => `'${g}'`).join(' ');
  const out = execSync(`git ls-files ${globsArg}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const files = out
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .filter((f) => !testFragments.some((frag) => f.includes(frag)));

  const chunks: string[] = [];
  for (const f of files) {
    try {
      chunks.push(readFileSync(join(repoRoot, f), 'utf8'));
    } catch {
      /* skip unreadable */
    }
  }
  return chunks.join('\n');
}

/**
 * No-stale-e2e-selectors ratchet. Throws if any testid asserted in an E2E
 * spec doesn't appear in production source.
 *
 * @example
 *   noStaleE2eSelectors({ repoRoot: process.cwd() });
 */
export function noStaleE2eSelectors(config: NoStaleE2eSelectorsConfig): void {
  const {
    repoRoot,
    e2eGlobs = ['e2e/**/*.spec.ts', 'e2e/**/*.spec.tsx'],
  } = config;

  const specsRaw = execSync(
    `git ls-files ${e2eGlobs.map((g) => `'${g}'`).join(' ')}`,
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const specs = specsRaw.split('\n').filter((l) => l.trim().length > 0);
  if (specs.length === 0) {
    throw new Error(
      `no-stale-e2e-selectors: no E2E spec files found matching ${JSON.stringify(e2eGlobs)} in ${repoRoot}. ` +
        `Either the project has no e2e suite yet (drop this ratchet) or e2eGlobs needs updating.`,
    );
  }

  const haystack = buildProductionHaystack(config);

  const orphans: Array<{ spec: string; testid: string; isPrefixMatch: boolean }> = [];
  for (const spec of specs) {
    const content = readFileSync(join(repoRoot, spec), 'utf8');
    for (const usage of extractTestidLiterals(content)) {
      if (!existsInHaystack(usage, haystack)) {
        orphans.push({ spec, testid: usage.literal, isPrefixMatch: usage.isPrefixMatch });
      }
    }
  }

  if (orphans.length > 0) {
    const detail = orphans
      .map(
        (o) =>
          `  • ${o.spec}: ${o.isPrefixMatch ? `[data-testid^="${o.testid}"]` : `getByTestId('${o.testid}')`}`,
      )
      .join('\n');
    throw new Error(
      `no-stale-e2e-selectors ratchet violated.\n\n` +
        `Found ${orphans.length} stale testid(s) in e2e specs — production source no longer emits them:\n${detail}\n\n` +
        `Fix: update the e2e spec to use the current testid, OR add the missing ` +
        `testid to production source.`,
    );
  }
}

// Exported for unit tests.
export const _internal = { extractTestidLiterals, existsInHaystack };
