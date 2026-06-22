// Detects bare numeric size literals in Swift design-system call sites
// (`.padding(N)`, `.cornerRadius(N)`, `.frame(width: N, height: N)`,
// `.offset(x: N, y: N)`, `Spacing.custom(N)`, `let X: CGFloat = N`).
// Defends the token mandate for Swift sizes: every size value should come
// from a generated `Spacing.*` / `Radii.*` token.
//
// Comment-strip uses stripSwiftCommentsAndDebugBlocks + stripSwiftPreviewBlocks.

import {
  stripSwiftCommentsAndDebugBlocks,
  stripSwiftPreviewBlocks,
  runRatchet,
  type RatchetConfig,
} from '../helpers';

// `.padding(N)` and `.padding(.horizontal, N)` etc.
const PAD = /\.padding\(\s*(?:\.[a-zA-Z]+\s*,\s*)?(-?\d+(?:\.\d+)?)\s*\)/g;

// `.cornerRadius(N)`.
const CORNER = /\.cornerRadius\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;

// `.frame(width: N, height: N)` — count each numeric inside the args.
const FRAME = /\.frame\(([^)]*)\)/g;
const FRAME_N = /\b(?:width|height|minWidth|maxWidth|minHeight|maxHeight|idealWidth|idealHeight):\s*(-?\d+(?:\.\d+)?)\b/g;

// `.offset(x: N, y: N)`.
const OFFSET = /\.offset\(([^)]*)\)/g;
const OFFSET_N = /\b(?:x|y):\s*(-?\d+(?:\.\d+)?)\b/g;

// `Spacing.custom(N)` (one-off escape valve).
const SPACING = /\bSpacing\.custom\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;

// `let varName: CGFloat = N` — catches bare-numeric sizes declared as
// downstream variables that then get consumed by frame/padding/etc.
// Skips named-constant escape valves carrying the Mandate-3 comment shape
// (`// Design-intent constant — <reason> (see GH #<issue>)`) on the same
// line or the immediately-preceding line.
const LET_CGFLOAT = /\blet\s+(\w+):\s*CGFloat\s*=\s*(-?\d+(?:\.\d+)?)\b/g;
const DESIGN_INTENT = /Design-intent constant/;

export function countBareSizeInSwift(source: string): number {
  let stripped = stripSwiftCommentsAndDebugBlocks(source);
  stripped = stripSwiftPreviewBlocks(stripped);

  let count = 0;
  count += (stripped.match(PAD) ?? []).length;
  count += (stripped.match(CORNER) ?? []).length;
  count += (stripped.match(SPACING) ?? []).length;

  // FRAME: re-scan inside each .frame(...) for the numeric labeled args.
  for (const m of stripped.matchAll(FRAME)) {
    count += (m[1]?.match(FRAME_N) ?? []).length;
  }

  // OFFSET: same for .offset(...).
  for (const m of stripped.matchAll(OFFSET)) {
    count += (m[1]?.match(OFFSET_N) ?? []).length;
  }

  // LET_CGFLOAT: count unless line carries Design-intent escape valve.
  // We have to re-scan in line context (helpers already stripped comments
  // generically; for LET_CGFLOAT we want to preserve the comment that
  // signals legitimacy).
  const linesWithComments = source.split('\n');
  for (let i = 0; i < linesWithComments.length; i++) {
    const line = linesWithComments[i] ?? '';
    if (!LET_CGFLOAT.test(line)) {
      LET_CGFLOAT.lastIndex = 0;
      continue;
    }
    LET_CGFLOAT.lastIndex = 0;
    // Check this line + previous line for the escape directive.
    const prev = linesWithComments[i - 1] ?? '';
    if (DESIGN_INTENT.test(line) || DESIGN_INTENT.test(prev)) continue;
    const matches = line.match(LET_CGFLOAT) ?? [];
    count += matches.length;
  }

  return count;
}

/**
 * No-bare-size-in-swift ratchet.
 *
 * @example
 *   noBareSizeInSwift({
 *     root: path.join(__dirname, '..', '..'),
 *     extensions: ['.swift'],
 *     ignoredPrefixes: ['packages/<Core>/Sources/<Core>/Tokens/'],
 *     expectedCounts: {},
 *   });
 */
export function noBareSizeInSwift(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-size-in-swift',
    countMatches: countBareSizeInSwift,
    repairRecipe:
      'Replace the bare numeric size with a generated token reference — ' +
      '`Spacing.md`, `Radii.sm`, etc. For genuine off-grid values, declare ' +
      'as `let X: CGFloat = N // Design-intent constant — <reason> (see GH #<issue>)` ' +
      '(Mandate-3 escape valve).',
  });
}
