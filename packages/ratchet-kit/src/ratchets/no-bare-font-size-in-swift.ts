// Detects bare numeric font-size literals in Swift typography call sites.
// Defends the typography-token mandate: font sizes should come from
// generated `Typography.*` tokens, not bare `.system(size: N)`.

import {
  stripSwiftCommentsAndDebugBlocks,
  stripSwiftPreviewBlocks,
  runRatchet,
  type RatchetConfig,
} from '../helpers';

// SwiftUI: `.system(size: 16)`, `.font(.system(size: 14))`.
const RE_SYS = /\b\.?system\(\s*size:\s*(\d+(?:\.\d+)?)\b/g;
// SwiftUI custom font: `.custom("Inter", size: 16)`.
const RE_CUST = /\bcustom\(\s*"[^"]*"\s*,\s*size:\s*(\d+(?:\.\d+)?)\b/g;
// UIKit: `UIFont.systemFont(ofSize: 14)`, `UIFont(name:size:)`.
const RE_UIFONT = /\bUIFont(?:\.(?:systemFont|boldSystemFont|italicSystemFont)\(\s*ofSize:|\(\s*name:\s*"[^"]*"\s*,\s*size:)\s*(\d+(?:\.\d+)?)\b/g;

export function countBareFontSizeInSwift(source: string): number {
  let stripped = stripSwiftCommentsAndDebugBlocks(source);
  stripped = stripSwiftPreviewBlocks(stripped);

  let count = 0;
  count += (stripped.match(RE_SYS) ?? []).length;
  count += (stripped.match(RE_CUST) ?? []).length;
  count += (stripped.match(RE_UIFONT) ?? []).length;
  return count;
}

/**
 * No-bare-font-size-in-swift ratchet.
 *
 * @example
 *   noBareFontSizeInSwift({
 *     root: path.join(__dirname, '..', '..'),
 *     extensions: ['.swift'],
 *     ignoredPrefixes: ['packages/<Core>/Sources/<Core>/Fonts/'],
 *     expectedCounts: {},
 *   });
 */
export function noBareFontSizeInSwift(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-font-size-in-swift',
    countMatches: countBareFontSizeInSwift,
    repairRecipe:
      'Replace the bare numeric font-size with a generated typography ' +
      'token (`Typography.body`, `Typography.heading`, etc.). The Fonts/ ' +
      'directory is the only legitimate home for raw numeric font sizes.',
  });
}
