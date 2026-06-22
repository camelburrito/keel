// Detects bare `Color(red: <numeric>...)` constructor calls in Swift.
// Defends the color-token mandate: all SwiftUI `Color` instances should come
// from a generated `Colors.*` token struct, never from a literal RGB/RGBA
// constructor in feature code.
//
// Counts the OPENING of the call site (one per Color(red:...) instance).
// Doesn't try to count individual channels — that's the byte-channel pattern
// caught by noBareHexInSwift's HEX_BYTE_255_RE.

import {
  stripSwiftCommentsAndDebugBlocks,
  stripSwiftPreviewBlocks,
  runRatchet,
  type RatchetConfig,
} from '../helpers';

// Match `Color(red: <digit>` — the bare-numeric constructor call.
// Excludes `Color(red: someVar, ...)` by requiring a digit after `red:`.
const PATTERN = /\bColor\(red:\s*[0-9]/g;

export function countBareColorConstructorInSwift(source: string): number {
  let stripped = stripSwiftCommentsAndDebugBlocks(source);
  stripped = stripSwiftPreviewBlocks(stripped);
  return (stripped.match(PATTERN) ?? []).length;
}

/**
 * No-bare-color-constructor-in-swift ratchet.
 *
 * @example
 *   noBareColorConstructorInSwift({
 *     root: path.join(__dirname, '..', '..'),
 *     extensions: ['.swift'],
 *     ignoredPrefixes: ['packages/<Core>/Sources/<Core>/Tokens/'],
 *     expectedCounts: {},
 *   });
 */
export function noBareColorConstructorInSwift(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-color-constructor-in-swift',
    countMatches: countBareColorConstructorInSwift,
    repairRecipe:
      'Replace the bare `Color(red: ..., green: ..., blue: ...)` constructor ' +
      'with a generated token reference (`Colors.Accent.primary`, etc.). ' +
      'The Tokens/Colors.generated.swift file is the only legitimate home ' +
      'for `Color(red:green:blue:)` literals.',
  });
}
