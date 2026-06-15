// no-adaptive-fg-on-kept-light-island — dark-mode polarity ratchet.
//
// THE BUG CLASS (what nothing else catches): every other design-system ratchet
// checks that colors flow through TOKENS, but none check that the RIGHT token is
// used for the context. Dark mode (when implemented as a token-value swap — see
// keel playbook 02 § "Dark mode as a token-value swap") re-themes a small set of
// STRUCTURAL "adaptive" tokens (`tokens.json` → `darkColor`: text/surface/border/
// ink) under `[data-theme="dark"]`. Every OTHER color token is a KEPT-LIGHT
// ISLAND — a pastel/brand that does NOT invert.
//
// Painting an ADAPTIVE foreground ON a kept-light island background makes the
// content VANISH specifically in dark (near-white text on a light pastel). Both
// directions reduce to ONE rule: an adaptive fg on a non-adaptive (island) bg.
// The fix is a "STAYS-*" foreground token that is #-identical to its adaptive
// twin in light but carries no dark override (so light goldens never churn).
//
// SELF-MAINTAINING: the adaptive set is DERIVED from `tokens.json` `darkColor`
// (keys + their `color.*` aliases). Add/remove a dark override → the ratchet's
// notion of "adaptive" updates automatically. No hardcoded token list, and the
// web + Swift scanners can never disagree on what "adaptive" means.
//
// ESCAPE VALVE: a translucent island over an adaptive surface can legitimately
// carry adaptive ink. `/* dark-ok: <reason> */` (CSS) or `// dark-ok: <reason>`
// (Swift) exempts the rule/run — the rationale is REQUIRED (bare `dark-ok` does
// NOT exempt; mirrors the no-console rationale convention).
//
// HONEST CEILING: this catches the CO-LOCATED case (bg + fg in the same CSS rule
// / same SwiftUI modifier run), the majority of real sites. It CANNOT see a
// JS-computed inline background, a cross-rule cascade (bg on parent, fg on
// child), `background-image` gradients, or non-`color`/`foreground` props.
// Those are covered by dark-render snapshot goldens + an auto-run dark-mode e2e
// spec, not static analysis. Document the ceiling so the next contributor knows
// what the gate does and does not catch.
//
// Token-shape contract (the keel design-system token convention):
//   { color: { <name>: { alias?: string[] } },
//     darkColor: { <name>: { platforms?: string[] } } }
// `darkColor` keys are the adaptive tokens. A `platforms` array (when present)
// gates which platforms the dark override reaches — a key without `"ios"` is a
// web-only adaptive token and is excluded from the Swift adaptive set.

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface NoAdaptiveFgOnKeptLightIslandConfig {
  /** Absolute path to the source-of-truth tokens.json. */
  tokensJsonPath: string;
  /** Absolute root to scan for `*.module.css` files (web polarity check). */
  cssRoot?: string;
  /** Directory basenames to skip while walking `cssRoot`. */
  cssIgnoredDirs?: ReadonlySet<string>;
  /** Absolute roots to scan for `*.swift` files (iOS polarity check). */
  swiftRoots?: string[];
  /** Directory basenames to skip while walking `swiftRoots`. */
  swiftIgnoredDirs?: ReadonlySet<string>;
  /** CSS custom-property prefix for color tokens. Default `--color-`. */
  varPrefix?: string;
  /** Swift color-enum reference prefix, e.g. `Colors.`. Default matches `(Namespace.)?Colors.`. */
  swiftColorPattern?: RegExp;
}

function kebab(camel: string): string {
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

interface TokensShape {
  color: Record<string, { alias?: string[] }>;
  darkColor: Record<string, { platforms?: string[] }>;
}

/**
 * Derive the set of ADAPTIVE `--<prefix>*` CSS var names from tokens.json: every
 * `darkColor` key plus the `color.*` aliases of those keys (aliases are var()
 * refs, so they invert too).
 */
export function deriveAdaptiveVars(tokensJson: string, varPrefix = '--color-'): Set<string> {
  const tokens = JSON.parse(tokensJson) as TokensShape;
  const out = new Set<string>();
  for (const key of Object.keys(tokens.darkColor)) {
    if (key === '_doc') continue;
    out.add(`${varPrefix}${kebab(key)}`);
    for (const alias of tokens.color[key]?.alias ?? []) out.add(`${varPrefix}${kebab(alias)}`);
  }
  return out;
}

/**
 * Swift adaptive token set: the camelCase `Colors.<name>` leaves that re-theme in
 * dark. Same derivation as the web set, but only `darkColor` leaves carrying
 * "ios" in `platforms` emit an adaptive Swift Color (web-only leaves never reach
 * Swift codegen). Includes `color.*` aliases. One shared source of truth.
 */
export function deriveAdaptiveSwiftTokens(tokensJson: string): Set<string> {
  const tokens = JSON.parse(tokensJson) as TokensShape;
  const out = new Set<string>();
  for (const [key, def] of Object.entries(tokens.darkColor)) {
    if (key === '_doc') continue;
    // An absent `platforms` array means "all platforms" (included). A present
    // array that omits "ios" is a web-only dark leaf (excluded — never reaches
    // Swift codegen). NB: the reference chorz impl required `platforms?.includes`
    // (absent → excluded); this generalization is identical on any token set that
    // declares `platforms` on every darkColor leaf, which is the documented convention.
    if (def.platforms && !def.platforms.includes('ios')) continue;
    out.add(key);
    for (const alias of tokens.color[key]?.alias ?? []) out.add(alias);
  }
  return out;
}

// Escape valve: a rule is exempt ONLY by `/* dark-ok: <reason> */` with a
// NON-EMPTY reason. Bare `/* dark-ok */`, empty `/* dark-ok: */`, and accidental
// substrings do NOT exempt — mechanically enforces the required-rationale contract.
const DARK_OK_RE = /\/\*\s*dark-ok:\s*[^\s*][^*]*\*\//;

/**
 * Find CSS rules where an adaptive foreground sits on a kept-light-island
 * background (bg references a color var NOT in `adaptive`; color references one
 * that IS). `dark-ok` in a rule body exempts it.
 */
export function findIslandPolarityViolations(
  css: string,
  adaptive: ReadonlySet<string>,
  varPrefix = '--color-',
): { selector: string; bg: string; fg: string }[] {
  const out: { selector: string; bg: string; fg: string }[] = [];
  const varRe = new RegExp(`var\\(\\s*(${varPrefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\w-]+)`);
  // Innermost `{ ... }` blocks (no nested braces) so @media wrappers don't
  // swallow their child rules. The preceding non-brace run is the selector.
  const ruleRe = /([^{}]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selectorRaw = m[1] ?? '';
    const body = m[2] ?? '';
    if (DARK_OK_RE.test(body)) continue;
    const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
    const bgDecl = clean.match(/background(?:-color)?:\s*([^;]+)/);
    const fgDecl = clean.match(/(?:^|[;{\s])color:\s*([^;]+)/);
    if (!bgDecl || !fgDecl) continue;
    const bgVar = (bgDecl[1] ?? '').match(varRe)?.[1];
    const fgVar = (fgDecl[1] ?? '').match(varRe)?.[1];
    if (!bgVar || !fgVar) continue;
    if (!adaptive.has(bgVar) && adaptive.has(fgVar)) {
      const selector = (selectorRaw.split(/[{}]/).pop() ?? '').trim().replace(/\s+/g, ' ');
      out.push({ selector: selector.slice(-80), bg: bgVar, fg: fgVar });
    }
  }
  return out;
}

// Swift escape valve: `// dark-ok: <reason>` with a NON-EMPTY reason.
const SWIFT_DARK_OK_RE = /\/\/\s*dark-ok:\s*\S/;
const SWIFT_FG_RE = /\.foreground(?:Style|Color)\(/;
const SWIFT_BG_RE = /\.(?:background|fill)\(/;
const DEFAULT_SWIFT_COLOR_RE = /(?:[A-Za-z_]\w*\.)?Colors\.(\w+)/g;

/**
 * Scan contiguous SwiftUI modifier runs (one run = one view) for a run
 * co-locating an adaptive `.foregroundStyle/.foregroundColor(Colors.<adaptive>)`
 * with an island `.background(…Colors.<island>…)`. `// dark-ok: <reason>` in the
 * run exempts it. Conditional modifiers (`?`/`??`) are skipped — their branches
 * correlate in ways static analysis can't resolve (the documented ceiling).
 */
export function findSwiftIslandPolarityViolations(
  swift: string,
  adaptive: ReadonlySet<string>,
  colorPattern: RegExp = DEFAULT_SWIFT_COLOR_RE,
): { line: number; fg: string; bg: string }[] {
  const out: { line: number; fg: string; bg: string }[] = [];
  const lines = swift.split('\n');
  const netDepth = (s: string): number => {
    let d = 0;
    for (const ch of s) {
      if (ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === ')' || ch === ']' || ch === '}') d--;
    }
    return d;
  };
  let i = 0;
  while (i < lines.length) {
    if (!(lines[i] ?? '').trim().startsWith('.')) { i++; continue; }
    // A modifier run continues across interleaved `//` comment lines and
    // continuation lines inside a still-open multi-line modifier arg (tracked
    // by bracket depth). Any other depth-0 line ends the run.
    let j = i;
    let depth = 0;
    while (j < lines.length) {
      const lj = lines[j] ?? '';
      const t = lj.trim();
      if (j === i || depth > 0 || t.startsWith('.') || t.startsWith('//')) {
        depth += netDepth(lj);
        j++;
        continue;
      }
      break;
    }
    const run = lines.slice(i, j);
    if (!run.some((l) => SWIFT_DARK_OK_RE.test(l))) {
      let fg: string | undefined;
      let bg: string | undefined;
      for (const ln of run) {
        if (ln.includes('?')) continue; // conditional → ceiling, skip
        const names = [...ln.matchAll(new RegExp(colorPattern.source, 'g'))]
          .map((mm) => mm[1])
          .filter((x): x is string => x !== undefined);
        if (SWIFT_FG_RE.test(ln)) for (const n of names) if (adaptive.has(n)) fg = n;
        if (SWIFT_BG_RE.test(ln)) for (const n of names) if (!adaptive.has(n)) bg = n;
      }
      if (fg && bg) out.push({ line: i + 1, fg, bg });
    }
    i = j;
  }
  return out;
}

function walk(dir: string, match: (entry: string) => boolean, ignored: ReadonlySet<string>, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (ignored.has(entry)) continue;
      walk(full, match, ignored, out);
    } else if (match(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strict-zero runner. Scans `cssRoot` for `*.module.css` (web) and `swiftRoots`
 * for `*.swift` (iOS), failing if any rule/run paints an adaptive foreground on a
 * kept-light island background. Throws with the offending sites + repair recipe.
 */
export function noAdaptiveFgOnKeptLightIsland(config: NoAdaptiveFgOnKeptLightIslandConfig): void {
  const tokensJson = readFileSync(config.tokensJsonPath, 'utf-8');
  const varPrefix = config.varPrefix ?? '--color-';
  const violations: string[] = [];

  if (config.cssRoot) {
    const adaptive = deriveAdaptiveVars(tokensJson, varPrefix);
    const cssIgnored = config.cssIgnoredDirs ?? new Set(['node_modules', '__tests__', '__mocks__']);
    for (const full of walk(config.cssRoot, (e) => e.endsWith('.module.css'), cssIgnored)) {
      const rel = relative(config.cssRoot, full).split('\\').join('/');
      for (const h of findIslandPolarityViolations(readFileSync(full, 'utf-8'), adaptive, varPrefix)) {
        violations.push(
          `${rel} — rule "${h.selector}" paints adaptive fg ${h.fg} on kept-light island bg ${h.bg} (vanishes in dark).`,
        );
      }
    }
  }

  if (config.swiftRoots?.length) {
    const adaptiveSwift = deriveAdaptiveSwiftTokens(tokensJson);
    const swiftIgnored = config.swiftIgnoredDirs ?? new Set(['Tokens', 'Generated', 'Resources', 'Tests']);
    const isSwift = (e: string) => e.endsWith('.swift') && !e.endsWith('.generated.swift') && !/Tests?\.swift$/.test(e);
    for (const root of config.swiftRoots) {
      for (const full of walk(root, isSwift, swiftIgnored)) {
        for (const h of findSwiftIslandPolarityViolations(readFileSync(full, 'utf-8'), adaptiveSwift, config.swiftColorPattern)) {
          violations.push(
            `${full.replace(/^.*\/((packages|apple|src)\/)/, '$1')}:${h.line} — adaptive fg Colors.${h.fg} co-located with island bg Colors.${h.bg} (vanishes in dark).`,
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `no-adaptive-fg-on-kept-light-island ratchet violated (adaptive foreground on a kept-light island).\n` +
        `Use a STAYS-* foreground token (#-identical to the adaptive twin in light, no dark override), ` +
        `or add a "dark-ok: <reason>" comment if it's a translucent wash over an adaptive surface.\n\n` +
        violations.map((v) => `  • ${v}`).join('\n'),
    );
  }
}
