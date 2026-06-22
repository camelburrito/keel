// Detects bare numeric duration literals in Swift animation / timing call
// sites. Defends the motion-token mandate: durations should come from
// generated `Motion.*` tokens, not bare seconds/milliseconds.

import {
  stripSwiftCommentsAndDebugBlocks,
  stripSwiftPreviewBlocks,
  runRatchet,
  type RatchetConfig,
} from '../helpers';

// `duration: 0.3` (SwiftUI Animation, AnimationCurve, etc.)
const RE_DURATION_LABEL = /\bduration:\s*(-?\d+(?:\.\d+)?)\b/g;
// `.seconds(3)` / `.milliseconds(120)` (DispatchTimeInterval).
const RE_SECONDS = /\.seconds\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;
const RE_MS = /\.milliseconds\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;
// `.delay(0.2)` (SwiftUI animation modifier).
const RE_DELAY = /\.delay\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;
// `DispatchQueue.asyncAfter(deadline: .now() + 0.5)`.
const RE_ASYNC_AFTER = /asyncAfter\(\s*deadline:\s*\.now\(\)\s*\+\s*(-?\d+(?:\.\d+)?)/g;
// `Timer.scheduledTimer(withTimeInterval: 1.0, ...)`.
const RE_TIMER_INTERVAL = /withTimeInterval:\s*(-?\d+(?:\.\d+)?)\b/g;
// `.spring(response: 0.4, ...)`.
const RE_SPRING_RESP = /\bresponse:\s*(-?\d+(?:\.\d+)?)\b/g;

export function countBareDurationInSwift(source: string): number {
  let stripped = stripSwiftCommentsAndDebugBlocks(source);
  stripped = stripSwiftPreviewBlocks(stripped);

  let count = 0;
  for (const re of [
    RE_DURATION_LABEL,
    RE_SECONDS,
    RE_MS,
    RE_DELAY,
    RE_ASYNC_AFTER,
    RE_TIMER_INTERVAL,
    RE_SPRING_RESP,
  ]) {
    count += (stripped.match(re) ?? []).length;
  }
  return count;
}

/**
 * No-bare-duration-in-swift ratchet.
 *
 * @example
 *   noBareDurationInSwift({
 *     root: path.join(__dirname, '..', '..'),
 *     extensions: ['.swift'],
 *     ignoredPrefixes: ['packages/<Core>/Sources/<Core>/Tokens/'],
 *     expectedCounts: {},
 *   });
 */
export function noBareDurationInSwift(config: RatchetConfig): void {
  runRatchet({
    ...config,
    ratchetName: 'no-bare-duration-in-swift',
    countMatches: countBareDurationInSwift,
    repairRecipe:
      'Replace the bare numeric duration with a generated motion token — ' +
      '`Motion.fast` / `Motion.normal` / `Motion.slow`. For one-off durations ' +
      'tied to user-research outcomes, declare as a named TimeInterval constant ' +
      'with the Mandate-3 comment shape.',
  });
}
