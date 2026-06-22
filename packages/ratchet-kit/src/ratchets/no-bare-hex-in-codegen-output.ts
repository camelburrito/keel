// Codegen regression gate. Scans designated generator-EMITTED files for bare
// hex literals and pins each occurrence count via a baseline. Catches the
// drift class where a generator script regresses and starts emitting `#hex`
// strings instead of `var(--color-*)` references or typed-Color symbols.
//
// SCOPE
//   This ratchet does NOT scan all generated files — only the ones the
//   project explicitly designates as guarded. Token source-of-truth files
//   (e.g., `tokens.generated.css`, `Colors.generated.swift`) are NOT
//   scanned; hex literals there are intentional.
//
// DETECTION
//   /#[0-9a-fA-F]{3,8}\b/g — matches 3-, 4-, 6-, 8-char hex literals
//   (`#abc`, `#abcd`, `#aabbcc`, `#aabbccdd`). Generator-emitted files
//   never contain GitHub-issue references (`#338`), so the 3-char minimum
//   is safe.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface NoBareHexInCodegenOutputConfig {
  /** Absolute path to the repo root. */
  repoRoot: string;
  /**
   * Map of relative-file-path → expected baseline hex count for that file.
   * Files NOT in this map are NOT scanned (deliberate carve-out, not a
   * gitignore-style scan exclusion).
   */
  expectedCounts: Record<string, number>;
}

export function countBareHexInCodegenOutput(source: string): number {
  return (source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
}

/**
 * No-bare-hex-in-codegen-output ratchet.
 *
 * @example
 *   noBareHexInCodegenOutput({
 *     repoRoot: process.cwd(),
 *     expectedCounts: {
 *       'src/ui/icons.generated.ts': 291,
 *       'packages/Tokens/IconCategoryColors.generated.swift': 291,
 *     },
 *   });
 */
export function noBareHexInCodegenOutput(
  config: NoBareHexInCodegenOutputConfig,
): void {
  const { repoRoot, expectedCounts } = config;
  const actual: Record<string, number> = {};

  for (const rel of Object.keys(expectedCounts)) {
    const full = join(repoRoot, rel);
    if (!existsSync(full)) {
      throw new Error(
        `no-bare-hex-in-codegen-output: scanned codegen output is missing: ${rel}. ` +
          `Either the generator was deleted, or the expectedCounts entry is stale. ` +
          `Remove the entry from expectedCounts if the file was intentionally retired.`,
      );
    }
    actual[rel] = countBareHexInCodegenOutput(readFileSync(full, 'utf-8'));
  }

  const violations: string[] = [];
  for (const [file, expected] of Object.entries(expectedCounts)) {
    const count = actual[file] ?? 0;
    if (count > expected) {
      violations.push(
        `GROWTH in ${file}: baseline ${expected} → now ${count}. A generator ` +
          `emitted ${count - expected} new bare hex literal(s). Fix the generator ` +
          `to emit token references instead, OR if the hex-map legitimately grew, ` +
          `update expectedCounts['${file}'] to ${count}.`,
      );
    } else if (count < expected) {
      if (count === 0) {
        violations.push(
          `RATCHET: ${file} now has 0 bare hex sites (baseline: ${expected}). ` +
            `The cross-platform hex-map contract appears to have retired. ` +
            `REMOVE this entry from expectedCounts.`,
        );
      } else {
        violations.push(
          `RATCHET: ${file} now has ${count} bare hex site(s) (baseline: ${expected}). ` +
            `The hex-map shrank — update expectedCounts['${file}'] to ${count}.`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `no-bare-hex-in-codegen-output ratchet violated.\n\n` +
        `Violations:\n` +
        violations.map((v) => `  • ${v}`).join('\n'),
    );
  }
}
