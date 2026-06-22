// Drift detector — the local pre-commit hook and the CI workflow MUST run
// the same set of ratchet test files. Catches the silent class where a new
// ratchet ships only in pre-commit but not CI (or vice versa), letting
// `git push --no-verify` slip violations past CI.
//
// SHAPE
//   Caller supplies two file paths (typically `.githooks/pre-commit` and
//   `.github/workflows/<ci>.yml`) plus the regex used to extract ratchet
//   paths from BOTH. The default regex matches `src/__tests__/<name>.test.ts`
//   tokens, which is the common convention.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RatchetListPrecommitVsWorkflowConfig {
  /** Absolute path to the repo root. */
  repoRoot: string;
  /** Relative path to the pre-commit hook (or any local script that runs ratchets). */
  preCommitPath: string;
  /** Relative path to the CI workflow file (or any second file that should mirror). */
  workflowPath: string;
  /**
   * Regex used to extract ratchet test paths from BOTH files. Default matches
   * `src/__tests__/<name>.test.ts`. Must use the global flag.
   */
  ratchetPathRegex?: RegExp;
  /**
   * Sanity-floor minimum count of ratchet paths. If the pre-commit hook lists
   * fewer than this, the test fails — guards against a refactor that
   * accidentally wipes the ratchet list. Defaults to 1.
   */
  minCount?: number;
}

/**
 * Extract every match of `regex` in `text` as a unique set.
 * Exposed for unit tests.
 */
export function extractRatchetPaths(text: string, regex: RegExp): Set<string> {
  if (!regex.flags.includes('g')) {
    throw new Error(
      'ratchet-list-precommit-vs-workflow: ratchetPathRegex must have the `g` flag for global matching.',
    );
  }
  return new Set(text.match(regex) ?? []);
}

/**
 * Ratchet-list-precommit-vs-workflow ratchet. Throws on any drift between
 * the two file's ratchet-path sets, or if pre-commit lists fewer than
 * `minCount` paths.
 *
 * @example
 *   ratchetListPrecommitVsWorkflow({
 *     repoRoot: process.cwd(),
 *     preCommitPath: '.githooks/pre-commit',
 *     workflowPath: '.github/workflows/test-coverage.yml',
 *   });
 */
export function ratchetListPrecommitVsWorkflow(
  config: RatchetListPrecommitVsWorkflowConfig,
): void {
  const {
    repoRoot,
    preCommitPath,
    workflowPath,
    ratchetPathRegex = /src\/__tests__\/[\w-]+\.test\.ts/g,
    minCount = 1,
  } = config;

  const preCommit = readFileSync(join(repoRoot, preCommitPath), 'utf-8');
  const workflow = readFileSync(join(repoRoot, workflowPath), 'utf-8');

  const preCommitPaths = extractRatchetPaths(preCommit, ratchetPathRegex);
  const workflowPaths = extractRatchetPaths(workflow, ratchetPathRegex);

  const onlyInPrecommit = [...preCommitPaths]
    .filter((p) => !workflowPaths.has(p))
    .sort();
  const onlyInWorkflow = [...workflowPaths]
    .filter((p) => !preCommitPaths.has(p))
    .sort();

  const messages: string[] = [];
  if (onlyInPrecommit.length > 0) {
    messages.push(
      `Tests in ${preCommitPath} but NOT in ${workflowPath}:\n` +
        onlyInPrecommit.map((p) => `  - ${p}`).join('\n') +
        `\n  → Add them to the workflow's ratchet step.`,
    );
  }
  if (onlyInWorkflow.length > 0) {
    messages.push(
      `Tests in ${workflowPath} but NOT in ${preCommitPath}:\n` +
        onlyInWorkflow.map((p) => `  - ${p}`).join('\n') +
        `\n  → Add them to ${preCommitPath}.`,
    );
  }
  if (preCommitPaths.size < minCount) {
    messages.push(
      `${preCommitPath} lists ${preCommitPaths.size} ratchet path(s) — below the minCount floor of ${minCount}. ` +
        `Sanity check: was the ratchet list accidentally wiped by a refactor?`,
    );
  }

  if (messages.length > 0) {
    throw new Error(
      `ratchet-list-precommit-vs-workflow ratchet violated.\n\n` + messages.join('\n\n'),
    );
  }
}
