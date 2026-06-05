// Defends against the `dorny/paths-filter@v*` + shallow-clone trap. paths-filter
// diffs `github.event.before..github.sha` on push events. `actions/checkout@v4`
// defaults to `fetch-depth: 1` (shallow). On large multi-commit pushes (release
// cuts), `event.before` is unreachable in the shallow clone and paths-filter
// silently falls back to "0 changed files" — every gated job skips with success.
//
// This ratchet fails if any `.github/workflows/*.yml` job uses
// `dorny/paths-filter@*` without a preceding `actions/checkout@*` step that
// sets `fetch-depth: 0`. Job-scoped lookback (bounded by top-level workflow
// key OR a new job's first nesting indent).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface NoPathsFilterWithoutFetchDepthZeroConfig {
  /** Absolute path to the repo root. */
  repoRoot: string;
  /**
   * Relative path from repoRoot to the workflows dir.
   * Defaults to `.github/workflows`.
   */
  workflowsDir?: string;
}

interface Offender {
  file: string;
  pathsFilterLine: number;
  checkoutLine: number | null;
  reason: string;
}

const PATHS_FILTER_RE = /^\s*-\s*uses:\s*dorny\/paths-filter@/;
const CHECKOUT_RE = /^(\s*)-\s*uses:\s*actions\/checkout@/;
const FETCH_DEPTH_ZERO_RE = /^\s*fetch-depth:\s*0\b/;

/**
 * Scan a single workflow file's text for offending paths-filter usages.
 * Exposed for unit tests.
 */
export function findOffendersInWorkflow(text: string, relPath: string): Offender[] {
  const lines = text.split('\n');
  const offenders: Offender[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!PATHS_FILTER_RE.test(lines[i]!)) continue;

    // Walk backwards within the same `steps:` block to find the most recent
    // actions/checkout step.
    let checkoutLine: number | null = null;
    let checkoutIndent = 0;
    for (let j = i - 1; j >= 0; j--) {
      // Stop at a top-level workflow key (e.g. `jobs:`, `on:`, `name:`).
      if (/^[a-z_-]+:\s*$/.test(lines[j]!)) break;
      const m = CHECKOUT_RE.exec(lines[j]!);
      if (m) {
        checkoutLine = j;
        checkoutIndent = m[1]!.length;
        break;
      }
    }

    if (checkoutLine === null) {
      offenders.push({
        file: relPath,
        pathsFilterLine: i + 1,
        checkoutLine: null,
        reason: 'paths-filter usage with no preceding actions/checkout in the same job',
      });
      continue;
    }

    // Scan forward from checkout for `fetch-depth: 0`, staying inside the
    // checkout's `with:` block (indent strictly greater than the `- uses:` line).
    let foundDepthZero = false;
    for (let k = checkoutLine + 1; k < lines.length; k++) {
      const ln = lines[k]!;
      if (ln.trim() === '') continue;
      const indent = (ln.match(/^(\s*)/) ?? ['', ''])[1]!.length;
      if (indent <= checkoutIndent) break;
      if (FETCH_DEPTH_ZERO_RE.test(ln)) {
        foundDepthZero = true;
        break;
      }
    }

    if (!foundDepthZero) {
      offenders.push({
        file: relPath,
        pathsFilterLine: i + 1,
        checkoutLine: checkoutLine + 1,
        reason: 'preceding actions/checkout does not set fetch-depth: 0',
      });
    }
  }

  return offenders;
}

/**
 * No-paths-filter-without-fetch-depth-zero ratchet. Throws if any workflow
 * uses `dorny/paths-filter@*` without a preceding `actions/checkout@*`
 * setting `fetch-depth: 0`.
 *
 * @example
 *   noPathsFilterWithoutFetchDepthZero({ repoRoot: process.cwd() });
 */
export function noPathsFilterWithoutFetchDepthZero(
  config: NoPathsFilterWithoutFetchDepthZeroConfig,
): void {
  const { repoRoot, workflowsDir = '.github/workflows' } = config;
  const absWorkflowsDir = join(repoRoot, workflowsDir);

  let workflowFiles: string[];
  try {
    workflowFiles = readdirSync(absWorkflowsDir)
      .filter((entry) => entry.endsWith('.yml') || entry.endsWith('.yaml'))
      .map((entry) => join(absWorkflowsDir, entry))
      .filter((full) => statSync(full).isFile());
  } catch {
    // Workflows dir doesn't exist — nothing to scan. Not a violation.
    return;
  }

  const allOffenders: Offender[] = [];
  for (const file of workflowFiles) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(repoRoot, file);
    allOffenders.push(...findOffendersInWorkflow(text, rel));
  }

  if (allOffenders.length > 0) {
    const report = allOffenders
      .map(
        (o) =>
          `  ${o.file}:${o.pathsFilterLine} (paths-filter) — checkout at line ` +
          `${o.checkoutLine ?? 'NONE'}: ${o.reason}`,
      )
      .join('\n');
    throw new Error(
      `no-paths-filter-without-fetch-depth-zero ratchet violated.\n\n${report}\n\n` +
        `Fix: add 'with: fetch-depth: 0' to the actions/checkout step that ` +
        `precedes the paths-filter step in the same job. Without it, ` +
        `paths-filter cannot diff event.before..github.sha on large multi-commit ` +
        `pushes (release cuts) and silently falls back to "0 changed files", ` +
        `skipping all downstream deploy jobs.`,
    );
  }
}
