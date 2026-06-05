// Detects `console.{log,info,warn,error,debug,...}` call sites in source.
// Defense-in-depth pair with the ESLint `no-console: error` rule. ESLint
// catches at write-time; this ratchet catches `git commit --no-verify`
// bypasses at pre-push/CI time.
//
// Disable directives are allowed IFF they carry an `-- <rationale>` segment:
//   // eslint-disable-next-line no-console -- bootstrap-time, no PII
// Empty disables (`// eslint-disable-next-line no-console`) FAIL the ratchet —
// prevents mass-disable without justification.
//
// File-level disables via a top-of-file `/* eslint-disable no-console -- <rationale> */`
// block are also accepted.

import { runRatchet, type RatchetConfig } from '../helpers';

const CONSOLE_RE =
  /\bconsole\.(log|info|warn|error|debug|dir|trace|table|group|groupCollapsed|groupEnd|count|countReset|assert|profile|profileEnd|time|timeEnd|timeLog|timeStamp)\s*\(/g;

const FILE_DISABLE_RE = /\/\*\s*eslint-disable\s+no-console\s+--\s+\S/;
const LINE_DISABLE_RE = /\/\/\s*eslint-disable-next-line\s+no-console\s+--\s+\S/;

/**
 * Count `console.*` call sites NOT covered by a valid disable directive.
 * - File-level disable (`eslint-disable no-console -- <rationale>` in a block
 *   comment) suppresses all sites in the file.
 * - Line-level disable on the IMMEDIATELY preceding line suppresses that site.
 * - Disables WITHOUT a `-- <rationale>` segment are NOT honored.
 */
export function countConsoleInSource(source: string): number {
  // File-level disable: scan whole file once.
  if (FILE_DISABLE_RE.test(source)) return 0;

  const lines = source.split('\n');
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!CONSOLE_RE.test(line)) {
      CONSOLE_RE.lastIndex = 0;
      continue;
    }
    CONSOLE_RE.lastIndex = 0;

    // Check the previous non-empty line for a valid disable directive.
    let prev: string | undefined;
    for (let j = i - 1; j >= 0; j--) {
      const candidate = lines[j];
      if (!candidate || candidate.trim() === '') continue;
      prev = candidate;
      break;
    }
    if (prev && LINE_DISABLE_RE.test(prev)) continue;

    // Each console.* call on this line counts. Re-scan the line to count
    // (test() only tells us at least one match).
    const matches = line.match(CONSOLE_RE) ?? [];
    count += matches.length;
  }

  return count;
}

/**
 * No-console-in-source ratchet. Defends the PII floor by blocking `console.*`
 * call sites that would bypass the redact pipeline (Sentry's `beforeSend` on
 * web; `@camelburrito/cf-utils` logger on CF).
 *
 * Disable directives require a `-- <rationale>` segment — prevents mass
 * disable. Strict zero from day 1.
 *
 * @example
 *   noConsoleInSource({
 *     root: path.join(__dirname, '..'),
 *     extensions: ['.ts', '.tsx', '.mjs', '.cjs', '.js'],
 *     ignoredPrefixes: ['__tests__/', '__mocks__/'],
 *     expectedCounts: {},
 *   });
 */
export function noConsoleInSource(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-console-in-source',
    countMatches: countConsoleInSource,
    repairRecipe:
      'On CF: route through @camelburrito/cf-utils `logger.{info,warn,error}` ' +
      '(runs the 7-layer redact pipeline). On web: route through Sentry ' +
      '(`Sentry.captureException(err, { tags: { ... } })` for errors; ' +
      '`Sentry.captureMessage` for diagnostics). If the call site is truly ' +
      'static-string + no-PII, add `// eslint-disable-next-line no-console ' +
      '-- <rationale>` immediately above the line. Empty disables fail.',
  });
}
