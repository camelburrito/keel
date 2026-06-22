// Detects bare `#hex` color literals + `0x..../255` byte-channel constructors
// in Swift source. Defends the token mandate cross-platform — same invariant
// as noBareHexInTsx + noBareHexInCss but applied to apple/<App>/ + packages/.
// Text-scans Swift; no SwiftLint / SwiftSyntax dependency.
//
// Comment-strip uses stripSwiftCommentsAndDebugBlocks to skip // line comments
// + `#if DEBUG` blocks. SwiftUI `#Preview { ... }` blocks are also stripped
// via stripSwiftPreviewBlocks since preview content is dev-only canvas
// material, not production UI.

import {
  stripSwiftCommentsAndDebugBlocks,
  stripSwiftPreviewBlocks,
  runRatchet,
  type RatchetConfig,
} from '../helpers';

// 6-char or 8-char hex (with optional alpha). 3-char shorthand isn't a Swift
// idiom for color literals so isn't matched.
const HEX_RE = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g;

// Byte-channel constructor convention: `Color(red: 0x33 / 255, green: 0x55 / 255, ...)`.
// Each `0xNN / 255` literal is one channel; a 3-channel color = 3 matches.
const HEX_BYTE_255_RE = /\b0x[0-9a-fA-F]{2}\s*\/\s*255(?:\.0)?\b/g;

export function countBareHexInSwift(source: string): number {
  let stripped = stripSwiftCommentsAndDebugBlocks(source);
  stripped = stripSwiftPreviewBlocks(stripped);
  const hex = (stripped.match(HEX_RE) ?? []).length;
  const byte = (stripped.match(HEX_BYTE_255_RE) ?? []).length;
  return hex + byte;
}

/**
 * No-bare-hex-in-swift ratchet. Defends the design-system token mandate
 * for the iOS side: any color literal in apple/<App>/ or packages/<Core>UI/
 * must come from a generated Swift token struct.
 *
 * @example
 *   noBareHexInSwift({
 *     root: path.join(__dirname, '..', '..'),  // repo root (Swift lives outside src/)
 *     extensions: ['.swift'],
 *     ignoredPrefixes: ['packages/<Core>/Sources/<Core>/Tokens/', 'apple/<App>/<App>/Tokens/'],
 *     expectedCounts: {},
 *   });
 */
export function noBareHexInSwift(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-hex-in-swift',
    countMatches: countBareHexInSwift,
    repairRecipe:
      'Replace the bare `#hex` (or `0xNN / 255`) literal with a generated ' +
      'token reference — e.g., `Colors.Accent.primary` from the Tokens/ ' +
      'generated Swift struct. The Tokens/*.generated.swift files are the ' +
      'only legitimate home for raw hex.',
  });
}
