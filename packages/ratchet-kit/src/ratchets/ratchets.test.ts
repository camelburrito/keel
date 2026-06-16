import { describe, it, expect } from 'vitest';
import { countInlineStyles } from './no-inline-style';
import { countBareHexInTsx } from './no-bare-hex-in-tsx';
import { countBareHexInCss } from './no-bare-hex-in-css';
import { countBarePxInCss } from './no-bare-px-in-css';
import { countConsoleInSource } from './no-console-in-source';
import { countImportants } from './no-important-css';
import { count3CharHexInTsx } from './no-3char-hex-in-tsx';
import { countBareRgbaInCss } from './no-bare-rgba-in-css';
import { countBareHexInSwift } from './no-bare-hex-in-swift';
import { countBareSizeInSwift } from './no-bare-size-in-swift';
import { countBareDurationInSwift } from './no-bare-duration-in-swift';
import { countBareFontSizeInSwift } from './no-bare-font-size-in-swift';
import { countBareColorConstructorInSwift } from './no-bare-color-constructor-in-swift';
import { countBareFontPropertyInCss } from './no-bare-font-property-in-css';
import { countBareViewportEmInCss } from './no-bare-viewport-em-in-css';
import { _internal as e2eInternal } from './no-stale-e2e-selectors';
import { findOffendersInWorkflow } from './no-paths-filter-without-fetch-depth-zero';
import {
  countBareHexInCodegenOutput,
  noBareHexInCodegenOutput,
} from './no-bare-hex-in-codegen-output';
import { lockfileSyncWithPackageJson } from './lockfile-sync-with-package-json';
import {
  extractRatchetPaths,
  ratchetListPrecommitVsWorkflow,
} from './ratchet-list-precommit-vs-workflow';
import {
  extractDefinedTokens,
  extractReferencedTokens,
  noUndefinedTokens,
} from './no-undefined-tokens';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('countInlineStyles', () => {
  it('catches JSX style={{}}', () => {
    expect(countInlineStyles('<div style={{color: "red"}} />')).toBe(1);
  });

  it('catches createElement variant', () => {
    expect(countInlineStyles(`createElement('div', { style: { color: 'red' } })`)).toBe(1);
  });

  it('catches React.createElement variant', () => {
    expect(countInlineStyles(`React.createElement('div', { style: { color: 'red' } })`)).toBe(1);
  });

  it('ignores style={someVar} (variable, not literal)', () => {
    expect(countInlineStyles('<div style={styles.foo} />')).toBe(0);
  });

  it('ignores patterns inside comments', () => {
    expect(countInlineStyles('// example: style={{ color: "red" }}')).toBe(0);
    expect(countInlineStyles('/* style={{ color: "red" }} */')).toBe(0);
  });
});

describe('countBareHexInTsx', () => {
  it('catches 6-char hex', () => {
    expect(countBareHexInTsx("const c = '#FF0000';")).toBe(1);
  });

  it('catches 3-char hex', () => {
    expect(countBareHexInTsx("const c = '#F00';")).toBe(1);
  });

  it('catches 8-char hex (alpha channel)', () => {
    expect(countBareHexInTsx("const c = '#FF0000FF';")).toBe(1);
  });

  it('ignores hex inside comments', () => {
    expect(countBareHexInTsx('// like #FF0000 but tokenized')).toBe(0);
  });
});

describe('countBareHexInCss', () => {
  it('catches hex literals', () => {
    expect(countBareHexInCss('color: #FF0000;')).toBe(1);
  });

  it('ignores hex inside /* */ comments', () => {
    expect(countBareHexInCss('/* example: #FF0000 */ color: var(--red);')).toBe(0);
  });
});

describe('countBarePxInCss', () => {
  it('catches bare Npx values', () => {
    expect(countBarePxInCss('.foo { padding: 16px; margin: 8px; }')).toBe(2);
  });

  it('ignores px inside --token: declarations', () => {
    expect(countBarePxInCss(':root { --spacing-md: 16px; } .foo { padding: var(--spacing-md); }'))
      .toBe(0);
  });

  it('catches decimal px (1.5px)', () => {
    expect(countBarePxInCss('.foo { border-width: 1.5px; }')).toBe(1);
  });
});

describe('countConsoleInSource', () => {
  it('catches bare console.log', () => {
    expect(countConsoleInSource('console.log("hello");')).toBe(1);
  });

  it('catches console.info, .warn, .error, .debug', () => {
    expect(
      countConsoleInSource('console.info(1); console.warn(2); console.error(3); console.debug(4);'),
    ).toBe(4);
  });

  it('honors line-level disable WITH rationale', () => {
    const src = `// eslint-disable-next-line no-console -- bootstrap, no PII
console.log("init");`;
    expect(countConsoleInSource(src)).toBe(0);
  });

  it('REJECTS line-level disable WITHOUT rationale', () => {
    const src = `// eslint-disable-next-line no-console
console.log("init");`;
    expect(countConsoleInSource(src)).toBe(1);
  });

  it('honors file-level disable WITH rationale', () => {
    const src = `/* eslint-disable no-console -- design-system showcase only */
console.log("a"); console.log("b");`;
    expect(countConsoleInSource(src)).toBe(0);
  });

  it('REJECTS file-level disable WITHOUT rationale', () => {
    const src = `/* eslint-disable no-console */
console.log("a"); console.log("b");`;
    expect(countConsoleInSource(src)).toBe(2);
  });
});

describe('countImportants', () => {
  it('catches !important declarations', () => {
    expect(countImportants('.foo { color: red !important; }')).toBe(1);
    expect(countImportants('.a { color: red !important; } .b { width: 1px !important; }')).toBe(2);
  });

  it('returns 0 when none present', () => {
    expect(countImportants('.foo { color: red; }')).toBe(0);
  });
});

describe('count3CharHexInTsx', () => {
  it("catches single-quoted '#F00'", () => {
    expect(count3CharHexInTsx("const c = '#F00';")).toBe(1);
  });

  it('catches double-quoted "#abc"', () => {
    expect(count3CharHexInTsx('const c = "#abc";')).toBe(1);
  });

  it('does NOT catch 6-char hex (noBareHexInTsx covers that)', () => {
    expect(count3CharHexInTsx("const c = '#FF0000';")).toBe(0);
  });

  it('ignores hex inside comments', () => {
    expect(count3CharHexInTsx("// example '#F00' tokenized away")).toBe(0);
  });
});

describe('countBareRgbaInCss', () => {
  it('catches each rgba call site', () => {
    expect(countBareRgbaInCss('.foo { color: rgba(0, 0, 0, 0.5); }')).toBe(1);
  });

  it('counts each rgba in a multi-shadow declaration', () => {
    expect(
      countBareRgbaInCss('.foo { box-shadow: 0 1px 2px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.05); }'),
    ).toBe(2);
  });

  it('ignores rgba inside /* */ comments', () => {
    expect(countBareRgbaInCss('/* example: rgba(0,0,0,0.5) */ color: var(--scrim);')).toBe(0);
  });
});

describe('countBareHexInSwift', () => {
  it('catches 6-char hex literal in Swift source', () => {
    expect(countBareHexInSwift('let red = "#FF0000"')).toBe(1);
  });

  it('catches 8-char hex with alpha', () => {
    expect(countBareHexInSwift('let red = "#FF000080"')).toBe(1);
  });

  it('catches 0xNN / 255 byte-channel literals (one per channel)', () => {
    expect(
      countBareHexInSwift('Color(red: 0x33 / 255, green: 0x55 / 255, blue: 0x77 / 255)'),
    ).toBe(3);
  });

  it('ignores hex inside // line comments', () => {
    expect(countBareHexInSwift('// like #FF0000 but tokenized\nlet c = Colors.accent')).toBe(0);
  });

  it('ignores hex inside #if DEBUG blocks', () => {
    const src = `let prod = Colors.accent
#if DEBUG
let dev = "#FF0000"
#endif`;
    expect(countBareHexInSwift(src)).toBe(0);
  });

  it('ignores hex inside #Preview { } blocks', () => {
    const src = `struct V: View { var body: some View { Text("") } }

#Preview {
  V().background(Color(hex: "#FF0000"))
}

let after = 1`;
    expect(countBareHexInSwift(src)).toBe(0);
  });
});

describe('countBareSizeInSwift', () => {
  it('catches .padding(N)', () => {
    expect(countBareSizeInSwift('Text("").padding(16)')).toBe(1);
  });

  it('catches .padding(.horizontal, N)', () => {
    expect(countBareSizeInSwift('Text("").padding(.horizontal, 24)')).toBe(1);
  });

  it('catches .cornerRadius(N)', () => {
    expect(countBareSizeInSwift('Rectangle().cornerRadius(8)')).toBe(1);
  });

  it('catches .frame labeled width/height args', () => {
    expect(countBareSizeInSwift('Rectangle().frame(width: 100, height: 50)')).toBe(2);
  });

  it('catches .offset(x:y:) labeled args', () => {
    expect(countBareSizeInSwift('Text("").offset(x: 10, y: 20)')).toBe(2);
  });

  it('catches let X: CGFloat = N WITHOUT Design-intent escape', () => {
    expect(countBareSizeInSwift('let pad: CGFloat = 16')).toBe(1);
  });

  it('honors Design-intent escape on same line', () => {
    expect(
      countBareSizeInSwift(
        'let ctaHeight: CGFloat = 64 // Design-intent constant — kid-finger tap target (see GH #309)',
      ),
    ).toBe(0);
  });

  it('honors Design-intent escape on preceding line', () => {
    const src = `// Design-intent constant — focal CTA (see GH #309)
let ctaHeight: CGFloat = 64`;
    expect(countBareSizeInSwift(src)).toBe(0);
  });
});

describe('countBareDurationInSwift', () => {
  it('catches duration: N', () => {
    expect(countBareDurationInSwift('Animation.easeInOut(duration: 0.3)')).toBe(1);
  });

  it('catches .seconds(N) and .milliseconds(N)', () => {
    expect(
      countBareDurationInSwift('DispatchTime.now() + .seconds(2) + .milliseconds(500)'),
    ).toBe(2);
  });

  it('catches .delay(N)', () => {
    expect(countBareDurationInSwift('Animation.default.delay(0.5)')).toBe(1);
  });

  it('catches asyncAfter deadline literals', () => {
    expect(
      countBareDurationInSwift('DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {}'),
    ).toBe(1);
  });

  it('catches Timer withTimeInterval:', () => {
    expect(
      countBareDurationInSwift('Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true)'),
    ).toBe(1);
  });

  it('catches .spring(response: N)', () => {
    expect(countBareDurationInSwift('.spring(response: 0.4, dampingFraction: 0.7)')).toBe(1);
  });
});

describe('countBareFontSizeInSwift', () => {
  it('catches .system(size: N)', () => {
    expect(countBareFontSizeInSwift('.font(.system(size: 14))')).toBe(1);
  });

  it('catches .custom("...", size: N)', () => {
    expect(countBareFontSizeInSwift('.font(.custom("Inter", size: 16))')).toBe(1);
  });

  it('catches UIFont.systemFont(ofSize: N)', () => {
    expect(countBareFontSizeInSwift('UIFont.systemFont(ofSize: 17)')).toBe(1);
  });

  it('catches UIFont(name: ..., size: N)', () => {
    expect(countBareFontSizeInSwift('UIFont(name: "Inter", size: 14)')).toBe(1);
  });
});

describe('countBareColorConstructorInSwift', () => {
  it('catches Color(red: <digit> calls', () => {
    expect(
      countBareColorConstructorInSwift('Color(red: 0.5, green: 0.2, blue: 0.1)'),
    ).toBe(1);
  });

  it('does NOT catch Color(red: someVar, ...)', () => {
    expect(countBareColorConstructorInSwift('Color(red: r, green: g, blue: b)')).toBe(0);
  });

  it('ignores Color() constructor calls inside #if DEBUG', () => {
    const src = `let prod = Colors.accent
#if DEBUG
let dev = Color(red: 0.5, green: 0.2, blue: 0.1)
#endif`;
    expect(countBareColorConstructorInSwift(src)).toBe(0);
  });
});

// v0.4 additions — CSS pack completeness (font-property + viewport-em) and
// structural ratchets (E2E selector orphans + paths-filter shallow-clone trap).

describe('countBareFontPropertyInCss', () => {
  it('catches bare font-weight numeric', () => {
    expect(countBareFontPropertyInCss('.x { font-weight: 700; }')).toBe(1);
  });

  it('catches bare letter-spacing px', () => {
    expect(countBareFontPropertyInCss('.x { letter-spacing: 2px; }')).toBe(1);
  });

  it('catches bare line-height decimal', () => {
    expect(countBareFontPropertyInCss('.x { line-height: 1.4; }')).toBe(1);
  });

  it('catches negative letter-spacing em', () => {
    expect(countBareFontPropertyInCss('.x { letter-spacing: -0.05em; }')).toBe(1);
  });

  it('ignores var(--token) references for all 3 properties', () => {
    expect(
      countBareFontPropertyInCss(
        '.x { font-weight: var(--font-weight-bold); line-height: var(--line-height-tight); letter-spacing: var(--letter-spacing-tight); }',
      ),
    ).toBe(0);
  });

  it('ignores literals inside /* */ comments', () => {
    expect(countBareFontPropertyInCss('/* example: font-weight: 700 */ .x {}')).toBe(0);
  });
});

describe('countBareViewportEmInCss', () => {
  it('catches 100vh', () => {
    expect(countBareViewportEmInCss('.x { min-height: 100vh; }')).toBe(1);
  });

  it('catches negative em', () => {
    expect(countBareViewportEmInCss('.x { letter-spacing: -0.05em; }')).toBe(1);
  });

  it('catches multiple viewport units in one declaration', () => {
    expect(countBareViewportEmInCss('.x { width: 50vw; height: 50vh; }')).toBe(2);
  });

  it('catches vmin/vmax', () => {
    expect(countBareViewportEmInCss('.x { font-size: 5vmin; height: 80vmax; }')).toBe(2);
  });

  it('does NOT catch media-query px values (no leading :)', () => {
    expect(countBareViewportEmInCss('@media (min-width: 1024px) { .x { color: red; } }')).toBe(0);
  });

  it('ignores var(--token) references', () => {
    expect(countBareViewportEmInCss('.x { height: var(--space-4); }')).toBe(0);
  });

  it('ignores literals inside /* */ comments', () => {
    expect(countBareViewportEmInCss('/* example: 100vh */ .x { color: red; }')).toBe(0);
  });
});

describe('no-stale-e2e-selectors helpers', () => {
  describe('extractTestidLiterals', () => {
    it("extracts getByTestId('foo')", () => {
      const usages = e2eInternal.extractTestidLiterals(`page.getByTestId('chore-card-body')`);
      expect(usages).toEqual([{ literal: 'chore-card-body', isPrefixMatch: false }]);
    });

    it('extracts data-testid="foo" attribute literal', () => {
      const usages = e2eInternal.extractTestidLiterals(`render(<div data-testid="foo-bar" />)`);
      expect(usages).toEqual([{ literal: 'foo-bar', isPrefixMatch: false }]);
    });

    it('extracts [data-testid="foo"] CSS selector', () => {
      const usages = e2eInternal.extractTestidLiterals(`page.locator('[data-testid="x"]')`);
      expect(usages).toEqual([{ literal: 'x', isPrefixMatch: false }]);
    });

    it('extracts prefix-match [data-testid^="foo-"] selector', () => {
      const usages = e2eInternal.extractTestidLiterals(`page.locator('[data-testid^="grid-tap-"]')`);
      expect(usages).toEqual([{ literal: 'grid-tap-', isPrefixMatch: true }]);
    });

    it('deduplicates same literal preferring prefix-match flag', () => {
      const content = `getByTestId('foo') ... [data-testid^="foo"]`;
      const usages = e2eInternal.extractTestidLiterals(content);
      // Same literal "foo" exact + prefix → prefix wins (less strict).
      expect(usages).toEqual([{ literal: 'foo', isPrefixMatch: true }]);
    });
  });

  describe('existsInHaystack', () => {
    it('finds exact match in double-quoted source', () => {
      const haystack = `<button data-testid="confirm-btn">Confirm</button>`;
      expect(
        e2eInternal.existsInHaystack({ literal: 'confirm-btn', isPrefixMatch: false }, haystack),
      ).toBe(true);
    });

    it('finds exact match in single-quoted source', () => {
      const haystack = `accessibilityIdentifier('confirm-btn')`;
      expect(
        e2eInternal.existsInHaystack({ literal: 'confirm-btn', isPrefixMatch: false }, haystack),
      ).toBe(true);
    });

    it('returns false when literal is absent', () => {
      const haystack = `<button data-testid="other-btn" />`;
      expect(
        e2eInternal.existsInHaystack({ literal: 'confirm-btn', isPrefixMatch: false }, haystack),
      ).toBe(false);
    });

    it('finds prefix-match against template literal', () => {
      const haystack = 'data-testid={`grid-tap-${id}`}';
      expect(
        e2eInternal.existsInHaystack({ literal: 'grid-tap-', isPrefixMatch: true }, haystack),
      ).toBe(true);
    });

    it('tolerates concrete rendered testid value against template prefix in source', () => {
      // Spec asserts exact 'grid-tap-42', source emits `grid-tap-${id}` — should pass.
      const haystack = 'data-testid={`grid-tap-${id}`}';
      expect(
        e2eInternal.existsInHaystack({ literal: 'grid-tap-42', isPrefixMatch: false }, haystack),
      ).toBe(true);
    });
  });
});

// v0.5 helpers — short-lived tmp dirs for codegen-output / lockfile-sync /
// ratchet-list-drift ratchets that need real files on disk.

function makeTmpRepo(): string {
  return mkdtempSync(join(tmpdir(), 'ratchet-kit-test-'));
}

describe('findOffendersInWorkflow', () => {
  it('flags paths-filter when checkout lacks fetch-depth: 0', () => {
    const yml = `name: Demo
on:
  push:
    branches: [main]
jobs:
  detect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
`;
    const offenders = findOffendersInWorkflow(yml, '.github/workflows/demo.yml');
    expect(offenders).toHaveLength(1);
    expect(offenders[0]!.reason).toContain('does not set fetch-depth: 0');
  });

  it('accepts paths-filter when preceding checkout sets fetch-depth: 0', () => {
    const yml = `name: Demo
jobs:
  detect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: dorny/paths-filter@v3
        id: filter
`;
    const offenders = findOffendersInWorkflow(yml, '.github/workflows/demo.yml');
    expect(offenders).toHaveLength(0);
  });

  it('flags paths-filter usage with no preceding checkout in the same job', () => {
    const yml = `name: Demo
jobs:
  detect:
    runs-on: ubuntu-latest
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
`;
    const offenders = findOffendersInWorkflow(yml, '.github/workflows/demo.yml');
    expect(offenders).toHaveLength(1);
    expect(offenders[0]!.checkoutLine).toBeNull();
    expect(offenders[0]!.reason).toContain('no preceding actions/checkout');
  });

  it('returns no offenders when paths-filter is absent', () => {
    const yml = `name: Test
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`;
    expect(findOffendersInWorkflow(yml, '.github/workflows/test.yml')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.5 additions — noBareHexInCodegenOutput / lockfileSyncWithPackageJson /
// ratchetListPrecommitVsWorkflow
// ─────────────────────────────────────────────────────────────────────────────

describe('countBareHexInCodegenOutput', () => {
  it('catches all 4 hex widths', () => {
    expect(countBareHexInCodegenOutput("'#abc'")).toBe(1);
    expect(countBareHexInCodegenOutput("'#abcd'")).toBe(1);
    expect(countBareHexInCodegenOutput("'#aabbcc'")).toBe(1);
    expect(countBareHexInCodegenOutput("'#aabbccdd'")).toBe(1);
  });

  it('does not match var() / typed-symbol references', () => {
    expect(countBareHexInCodegenOutput("'var(--color-icon-category-cleaning)'")).toBe(0);
    expect(countBareHexInCodegenOutput('ColorsGenerated.iconCategoryCleaning')).toBe(0);
  });

  it('counts every occurrence in a multi-entry map', () => {
    const sample = `'a': '#8BE0FF',\n'b': '#8BE0FF',\n'c': '#FFED99',`;
    expect(countBareHexInCodegenOutput(sample)).toBe(3);
  });
});

describe('noBareHexInCodegenOutput', () => {
  it('passes when file count matches baseline', () => {
    const root = makeTmpRepo();
    try {
      writeFileSync(join(root, 'gen.ts'), `const m = {'a':'#abc','b':'#abc'};`);
      expect(() =>
        noBareHexInCodegenOutput({ repoRoot: root, expectedCounts: { 'gen.ts': 2 } }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws GROWTH when actual > baseline', () => {
    const root = makeTmpRepo();
    try {
      // 3 hex literals; baseline only allows 2.
      writeFileSync(join(root, 'gen.ts'), `const m = {'a':'#abc','b':'#def','c':'#aabbcc'};`);
      expect(() =>
        noBareHexInCodegenOutput({ repoRoot: root, expectedCounts: { 'gen.ts': 2 } }),
      ).toThrow(/GROWTH in gen\.ts/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws RATCHET when actual < baseline (suggests shrink)', () => {
    const root = makeTmpRepo();
    try {
      writeFileSync(join(root, 'gen.ts'), `const m = {'a':'#abc'};`);
      expect(() =>
        noBareHexInCodegenOutput({ repoRoot: root, expectedCounts: { 'gen.ts': 5 } }),
      ).toThrow(/RATCHET: gen\.ts/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when scanned file is missing', () => {
    const root = makeTmpRepo();
    try {
      expect(() =>
        noBareHexInCodegenOutput({
          repoRoot: root,
          expectedCounts: { 'missing.ts': 0 },
        }),
      ).toThrow(/scanned codegen output is missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('lockfileSyncWithPackageJson', () => {
  function seedCodebase(
    root: string,
    source: string,
    pkg: object,
    lock: object,
  ): void {
    mkdirSync(join(root, source), { recursive: true });
    writeFileSync(join(root, source, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(root, source, 'package-lock.json'), JSON.stringify(lock));
  }

  it('passes when lockfile contains every dep at matching version + resolved entry', () => {
    const root = makeTmpRepo();
    try {
      seedCodebase(
        root,
        'fn',
        { name: 'fn', dependencies: { lodash: '^4.17.0' } },
        {
          lockfileVersion: 3,
          packages: {
            '': { dependencies: { lodash: '^4.17.0' } },
            'node_modules/lodash': { version: '4.17.21' },
          },
        },
      );
      expect(() =>
        lockfileSyncWithPackageJson({
          repoRoot: root,
          codebases: [{ source: 'fn', codebase: 'default' }],
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when package-lock.json missing', () => {
    const root = makeTmpRepo();
    try {
      mkdirSync(join(root, 'fn'));
      writeFileSync(join(root, 'fn/package.json'), JSON.stringify({ name: 'fn' }));
      expect(() =>
        lockfileSyncWithPackageJson({
          repoRoot: root,
          codebases: [{ source: 'fn', codebase: 'default' }],
        }),
      ).toThrow(/missing fn\/package-lock\.json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when lockfileVersion is not 3', () => {
    const root = makeTmpRepo();
    try {
      seedCodebase(root, 'fn', { name: 'fn' }, { lockfileVersion: 2, packages: {} });
      expect(() =>
        lockfileSyncWithPackageJson({
          repoRoot: root,
          codebases: [{ source: 'fn', codebase: 'default' }],
        }),
      ).toThrow(/must be lockfileVersion 3/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when a dep is in package.json but missing from lockfile deps', () => {
    const root = makeTmpRepo();
    try {
      seedCodebase(
        root,
        'fn',
        { name: 'fn', dependencies: { lodash: '^4.17.0' } },
        { lockfileVersion: 3, packages: { '': { dependencies: {} } } },
      );
      expect(() =>
        lockfileSyncWithPackageJson({
          repoRoot: root,
          codebases: [{ source: 'fn', codebase: 'default' }],
        }),
      ).toThrow(/lodash declared in package\.json but missing from package-lock\.json deps/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when dep version-specifier drifts between package.json and lockfile', () => {
    const root = makeTmpRepo();
    try {
      seedCodebase(
        root,
        'fn',
        { name: 'fn', dependencies: { lodash: '^4.18.0' } },
        {
          lockfileVersion: 3,
          packages: {
            '': { dependencies: { lodash: '^4.17.0' } },
            'node_modules/lodash': { version: '4.17.21' },
          },
        },
      );
      expect(() =>
        lockfileSyncWithPackageJson({
          repoRoot: root,
          codebases: [{ source: 'fn', codebase: 'default' }],
        }),
      ).toThrow(/version-specifier drift/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when dep has no resolved node_modules entry in lockfile.packages', () => {
    const root = makeTmpRepo();
    try {
      seedCodebase(
        root,
        'fn',
        { name: 'fn', dependencies: { lodash: '^4.17.0' } },
        {
          lockfileVersion: 3,
          packages: { '': { dependencies: { lodash: '^4.17.0' } } },
        },
      );
      expect(() =>
        lockfileSyncWithPackageJson({
          repoRoot: root,
          codebases: [{ source: 'fn', codebase: 'default' }],
        }),
      ).toThrow(/not resolved in package-lock\.json#packages/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when neither codebases nor firebaseJsonPath provided', () => {
    expect(() =>
      lockfileSyncWithPackageJson({ repoRoot: '/tmp' } as any),
    ).toThrow(/provide either `codebases` or `firebaseJsonPath`/);
  });

  it('loads codebases from firebase.json when firebaseJsonPath given', () => {
    const root = makeTmpRepo();
    try {
      seedCodebase(
        root,
        'fn',
        { name: 'fn', dependencies: { lodash: '^4.17.0' } },
        {
          lockfileVersion: 3,
          packages: {
            '': { dependencies: { lodash: '^4.17.0' } },
            'node_modules/lodash': { version: '4.17.21' },
          },
        },
      );
      writeFileSync(
        join(root, 'firebase.json'),
        JSON.stringify({ functions: [{ source: 'fn', codebase: 'default' }] }),
      );
      expect(() =>
        lockfileSyncWithPackageJson({
          repoRoot: root,
          firebaseJsonPath: 'firebase.json',
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('extractRatchetPaths', () => {
  it('extracts test paths via default-shaped regex', () => {
    const text = `npx vitest run src/__tests__/foo.test.ts src/__tests__/bar.test.ts`;
    const re = /src\/__tests__\/[\w-]+\.test\.ts/g;
    expect([...extractRatchetPaths(text, re)].sort()).toEqual([
      'src/__tests__/bar.test.ts',
      'src/__tests__/foo.test.ts',
    ]);
  });

  it('returns empty set when no matches', () => {
    expect(extractRatchetPaths('no tests here', /src\/__tests__\/[\w-]+\.test\.ts/g)).toEqual(
      new Set(),
    );
  });

  it('throws when regex lacks `g` flag', () => {
    expect(() => extractRatchetPaths('any', /src\/__tests__\/[\w-]+\.test\.ts/)).toThrow(
      /must have the `g` flag/,
    );
  });
});

describe('ratchetListPrecommitVsWorkflow', () => {
  function seed(root: string, pre: string, wf: string): void {
    mkdirSync(join(root, '.githooks'), { recursive: true });
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(join(root, '.githooks/pre-commit'), pre);
    writeFileSync(join(root, '.github/workflows/ci.yml'), wf);
  }

  it('passes when both files list the same ratchet set', () => {
    const root = makeTmpRepo();
    try {
      seed(
        root,
        'npx vitest src/__tests__/a.test.ts src/__tests__/b.test.ts',
        'npx vitest src/__tests__/a.test.ts src/__tests__/b.test.ts',
      );
      expect(() =>
        ratchetListPrecommitVsWorkflow({
          repoRoot: root,
          preCommitPath: '.githooks/pre-commit',
          workflowPath: '.github/workflows/ci.yml',
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when pre-commit has a ratchet not in workflow', () => {
    const root = makeTmpRepo();
    try {
      seed(
        root,
        'npx vitest src/__tests__/a.test.ts src/__tests__/b.test.ts',
        'npx vitest src/__tests__/a.test.ts',
      );
      expect(() =>
        ratchetListPrecommitVsWorkflow({
          repoRoot: root,
          preCommitPath: '.githooks/pre-commit',
          workflowPath: '.github/workflows/ci.yml',
        }),
      ).toThrow(/NOT in \.github\/workflows\/ci\.yml/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when workflow has a ratchet not in pre-commit', () => {
    const root = makeTmpRepo();
    try {
      seed(
        root,
        'npx vitest src/__tests__/a.test.ts',
        'npx vitest src/__tests__/a.test.ts src/__tests__/b.test.ts',
      );
      expect(() =>
        ratchetListPrecommitVsWorkflow({
          repoRoot: root,
          preCommitPath: '.githooks/pre-commit',
          workflowPath: '.github/workflows/ci.yml',
        }),
      ).toThrow(/NOT in \.githooks\/pre-commit/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when pre-commit ratchet count is below minCount floor', () => {
    const root = makeTmpRepo();
    try {
      seed(root, '# no tests', '# no tests');
      expect(() =>
        ratchetListPrecommitVsWorkflow({
          repoRoot: root,
          preCommitPath: '.githooks/pre-commit',
          workflowPath: '.github/workflows/ci.yml',
          minCount: 1,
        }),
      ).toThrow(/below the minCount floor of 1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('honors custom ratchetPathRegex', () => {
    const root = makeTmpRepo();
    try {
      seed(
        root,
        'bash tests/check-a.sh tests/check-b.sh',
        'bash tests/check-a.sh tests/check-b.sh',
      );
      expect(() =>
        ratchetListPrecommitVsWorkflow({
          repoRoot: root,
          preCommitPath: '.githooks/pre-commit',
          workflowPath: '.github/workflows/ci.yml',
          ratchetPathRegex: /tests\/check-[\w-]+\.sh/g,
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.6 addition — noUndefinedTokens
// ─────────────────────────────────────────────────────────────────────────────

describe('extractDefinedTokens', () => {
  it('extracts --token-name: declarations regardless of selector', () => {
    const css = `:root {
  --color-primary: #f53d6b;
  --space-md: 16px;
}
.dark {
  --color-primary: #ff6b88;
}
`;
    const defined = extractDefinedTokens(css);
    expect(defined).toEqual(new Set(['--color-primary', '--space-md']));
  });

  it('ignores non-custom-property declarations', () => {
    const css = `.x { color: red; font-size: 14px; --my-token: 1px; }`;
    // The non-CP declarations land off-line-start so the gm regex skips them,
    // but the --my-token IS at line start (after the open-brace it isn't, but
    // the chorz precedent uses gm anchoring — verify expected shape).
    const defined = extractDefinedTokens(css);
    expect(defined.has('--my-token')).toBe(false); // not at line start
    expect(defined).not.toContain('color');
    expect(defined).not.toContain('font-size');
  });

  it('extracts custom properties at line start with leading whitespace', () => {
    const css = `  --leading-space-ok: 1px;
\t--tab-prefix-ok: 2px;
`;
    expect(extractDefinedTokens(css)).toEqual(
      new Set(['--leading-space-ok', '--tab-prefix-ok']),
    );
  });
});

describe('extractReferencedTokens', () => {
  it('extracts simple var(--name)', () => {
    const css = `.x { color: var(--color-primary); }`;
    const refs = extractReferencedTokens(css);
    expect(refs).toEqual([{ name: '--color-primary', line: 1 }]);
  });

  it('extracts var(--name, fallback) — ignores fallback', () => {
    const css = `.x { color: var(--color-primary, #f53d6b); }`;
    const refs = extractReferencedTokens(css);
    expect(refs).toEqual([{ name: '--color-primary', line: 1 }]);
  });

  it('extracts refs nested inside color-mix / rgb / calc', () => {
    const css = `.x {
  color: color-mix(in srgb, var(--color-primary) 50%, var(--color-secondary));
  width: calc(var(--space-md) * 2);
}`;
    const refs = extractReferencedTokens(css);
    expect(refs.map((r) => r.name)).toEqual([
      '--color-primary',
      '--color-secondary',
      '--space-md',
    ]);
  });

  it('tracks 1-indexed line numbers in source order', () => {
    const css = `.x {
  color: var(--a);
}
.y {
  color: var(--b);
  background: var(--c);
}`;
    const refs = extractReferencedTokens(css);
    expect(refs).toEqual([
      { name: '--a', line: 2 },
      { name: '--b', line: 5 },
      { name: '--c', line: 6 },
    ]);
  });

  it('returns empty array when no var(--) references present', () => {
    expect(extractReferencedTokens(`.x { color: red; }`)).toEqual([]);
  });
});

describe('noUndefinedTokens', () => {
  function seedTokenRepo(
    root: string,
    tokens: string,
    consumers: Record<string, string>,
  ): void {
    mkdirSync(join(root, 'ui'), { recursive: true });
    writeFileSync(join(root, 'ui/tokens.generated.css'), tokens);
    for (const [relPath, content] of Object.entries(consumers)) {
      const fullPath = join(root, relPath);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, content);
    }
  }

  it('passes when every var(--) reference resolves to a defined token', () => {
    const root = makeTmpRepo();
    try {
      seedTokenRepo(
        root,
        `:root {\n  --color-primary: #f53d6b;\n  --space-md: 16px;\n}`,
        {
          'features/Button.css': `.btn { color: var(--color-primary); padding: var(--space-md); }`,
        },
      );
      expect(() =>
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [join(root, 'ui/tokens.generated.css')],
          ignoredFiles: new Set(['ui/tokens.generated.css']),
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when a consumer references an undefined token', () => {
    const root = makeTmpRepo();
    try {
      seedTokenRepo(
        root,
        `:root {\n  --color-primary: #f53d6b;\n}`,
        {
          'features/Button.css': `.btn { color: var(--colr-primary); }`,
        },
      );
      expect(() =>
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [join(root, 'ui/tokens.generated.css')],
          ignoredFiles: new Set(['ui/tokens.generated.css']),
        }),
      ).toThrow(/references undefined token --colr-primary/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('merges defined-set across multiple token source files', () => {
    const root = makeTmpRepo();
    try {
      mkdirSync(join(root, 'ui'));
      writeFileSync(
        join(root, 'ui/tokens.generated.css'),
        `:root {\n  --color-primary: #f53d6b;\n}`,
      );
      writeFileSync(
        join(root, 'ui/tokens.overrides.css'),
        `.dark {\n  --color-surface: #111;\n}`,
      );
      writeFileSync(
        join(root, 'Button.css'),
        `.btn { color: var(--color-primary); background: var(--color-surface); }`,
      );
      expect(() =>
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [
            join(root, 'ui/tokens.generated.css'),
            join(root, 'ui/tokens.overrides.css'),
          ],
          ignoredFiles: new Set([
            'ui/tokens.generated.css',
            'ui/tokens.overrides.css',
          ]),
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('honors runtimeInjectedPrefixes (e.g., Tailwind --tw-*)', () => {
    const root = makeTmpRepo();
    try {
      seedTokenRepo(
        root,
        `:root {\n  --color-primary: #f53d6b;\n}`,
        {
          'features/Button.css': `.btn { color: var(--tw-ring-color); border: var(--color-primary); }`,
        },
      );
      expect(() =>
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [join(root, 'ui/tokens.generated.css')],
          ignoredFiles: new Set(['ui/tokens.generated.css']),
          runtimeInjectedPrefixes: ['--tw-'],
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when tokenSourceFiles is empty', () => {
    expect(() =>
      noUndefinedTokens({
        consumerScanRoot: '/tmp',
        tokenSourceFiles: [],
      }),
    ).toThrow(/must contain at least one file/);
  });

  it('throws when token source has zero --token: declarations', () => {
    const root = makeTmpRepo();
    try {
      mkdirSync(join(root, 'ui'));
      writeFileSync(
        join(root, 'ui/tokens.generated.css'),
        `/* empty placeholder */`,
      );
      expect(() =>
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [join(root, 'ui/tokens.generated.css')],
        }),
      ).toThrow(/contained zero --token-name: declarations/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('respects ignoredDirs (skips node_modules, __tests__ by default)', () => {
    const root = makeTmpRepo();
    try {
      seedTokenRepo(
        root,
        `:root {\n  --color-primary: #f53d6b;\n}`,
        {
          'features/Button.css': `.btn { color: var(--color-primary); }`,
        },
      );
      // Add a __tests__ file that REFERENCES an undefined token — should be
      // ignored by default.
      mkdirSync(join(root, '__tests__'));
      writeFileSync(
        join(root, '__tests__/fixture.css'),
        `.fixture { color: var(--undefined-fixture-token); }`,
      );
      expect(() =>
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [join(root, 'ui/tokens.generated.css')],
          ignoredFiles: new Set(['ui/tokens.generated.css']),
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('honors custom consumerExtensions (e.g., .module.css only)', () => {
    const root = makeTmpRepo();
    try {
      mkdirSync(join(root, 'ui'));
      writeFileSync(
        join(root, 'ui/tokens.generated.css'),
        `:root {\n  --color-primary: #f53d6b;\n}`,
      );
      // Plain .css with undefined token — should be SKIPPED if we scan only .module.css.
      writeFileSync(
        join(root, 'plain.css'),
        `.x { color: var(--undefined-in-plain); }`,
      );
      // .module.css with defined token — should be checked.
      writeFileSync(
        join(root, 'Button.module.css'),
        `.btn { color: var(--color-primary); }`,
      );
      expect(() =>
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [join(root, 'ui/tokens.generated.css')],
          ignoredFiles: new Set(['ui/tokens.generated.css']),
          consumerExtensions: ['.module.css'],
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports file path + line + token name in error message', () => {
    const root = makeTmpRepo();
    try {
      seedTokenRepo(
        root,
        `:root {\n  --color-primary: #f53d6b;\n}`,
        {
          'features/Button.css': `.btn {\n  color: red;\n  background: var(--missing-token);\n}`,
        },
      );
      let caught: Error | null = null;
      try {
        noUndefinedTokens({
          consumerScanRoot: root,
          tokenSourceFiles: [join(root, 'ui/tokens.generated.css')],
          ignoredFiles: new Set(['ui/tokens.generated.css']),
        });
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).not.toBeNull();
      expect(caught!.message).toContain('features/Button.css:3');
      expect(caught!.message).toContain('--missing-token');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.7 — arch-doc-integrity
// ─────────────────────────────────────────────────────────────────────────────
import {
  slugify,
  citedRepoPath,
  findMermaidTraps,
  findContrastTraps,
  parseDoc,
  collectHeadingSlugs,
} from './arch-doc-integrity';

describe('arch-doc-integrity: slugify (GitHub heading-slug algorithm)', () => {
  it('lowercases, strips punctuation, hyphenates spaces', () => {
    expect(slugify('3.5 String Catalog')).toBe('35-string-catalog');
    expect(slugify('`useChores` hook')).toBe('usechores-hook');
    expect(slugify('10. Auto-schedule flow')).toBe('10-auto-schedule-flow');
  });
  it('does NOT collapse whitespace runs ("a + b" → a--b)', () => {
    expect(slugify('Codebase split + cross-codebase coordination')).toBe(
      'codebase-split--cross-codebase-coordination',
    );
  });
  it('keeps Unicode letters (GitHub does too)', () => {
    expect(slugify('Café résumé')).toBe('café-résumé');
  });
  it('strips emoji / trailing punctuation', () => {
    expect(slugify('🔴 Blocker?')).toBe('-blocker');
  });
});

describe('arch-doc-integrity: citedRepoPath', () => {
  const top = new Set(['src', 'functions', 'packages']);
  const eph = ['coverage/', 'dist/'];
  it('resolves fully-qualified paths incl. file:line', () => {
    expect(citedRepoPath('functions/src/index.ts', top, eph)).toBe('functions/src/index.ts');
    expect(citedRepoPath('./src/ui/Button.tsx', top, eph)).toBe('src/ui/Button.tsx');
    expect(citedRepoPath('src/ui/Button.tsx:42', top, eph)).toBe('src/ui/Button.tsx');
    expect(citedRepoPath('src/ui/Button.tsx:10-20', top, eph)).toBe('src/ui/Button.tsx');
  });
  it('skips base-relative shorthand, ephemeral, and non-paths (null)', () => {
    expect(citedRepoPath('audit/writeWithAudit.ts', top, eph)).toBeNull();
    expect(citedRepoPath('coverage/lcov.info', top, eph)).toBeNull();
    expect(citedRepoPath('households/{hh}/x.json', top, eph)).toBeNull();
    expect(citedRepoPath('src/**/*.ts', top, eph)).toBeNull();
    expect(citedRepoPath('npm run check', top, eph)).toBeNull();
  });
});

describe('arch-doc-integrity: findMermaidTraps', () => {
  it('flags \\n, &&, raw <tags> in node AND edge labels', () => {
    expect(findMermaidTraps('A["line1\\nline2"]')).toHaveLength(1);
    expect(findMermaidTraps('B["foo && bar"]')).toHaveLength(1);
    expect(findMermaidTraps('C["<placeholder>"]')).toHaveLength(1);
    expect(findMermaidTraps('A -->|"<b>x</b>"| B')).toHaveLength(1);
    expect(findMermaidTraps('A((<placeholder>))')[0]).toContain('"<placeholder>"');
  });
  it('allows <br/> and bare edge-label pipes', () => {
    expect(findMermaidTraps('D["line1<br/>line2"]')).toHaveLength(0);
    expect(findMermaidTraps('A -->|yes| B')).toHaveLength(0);
    expect(findMermaidTraps('subgraph CALL["onCall - typed callables (48)"]')).toHaveLength(0);
  });
  it('flags the 3 grounded GitHub-only traps: escaped quote, dotted-edge period, sequence ";"', () => {
    // backslash-escaped quote in a node label (mermaid has no \" escape):
    expect(findMermaidTraps('IUSE["iOS: t(\\"x\\")"]')).toHaveLength(1);
    expect(findMermaidTraps('IUSE["iOS: t(\\"x\\")"]')[0]).toContain('#quot;');
    expect(findMermaidTraps('IUSE["iOS: t(#quot;x#quot;)"]')).toHaveLength(0); // the FIX, not a trap
    // a "." inside a -. dotted .-> edge label breaks the lexer:
    expect(findMermaidTraps('flowchart TB\n  FS -. chore.conflict set .-> CONF')).toHaveLength(1);
    // periods in pipe / node labels and period-free dotted labels are fine:
    expect(findMermaidTraps('flowchart TB\n  A -->|chore.conflict set| B')).toHaveLength(0);
    expect(findMermaidTraps('flowchart TB\n  A["chore.conflict set"] --> B')).toHaveLength(0);
    expect(findMermaidTraps('flowchart TB\n  RATCHET -.locks consumers.-> WUSE')).toHaveLength(0);
    // chained unlabeled dotted arrows must not span across arrowheads (`>`-exclusion):
    expect(findMermaidTraps('flowchart TB\n  I2 -.->|previous| I1 -.->|previous| ROOT')).toHaveLength(0);
    // a QUOTED dotted-edge label with a period parses fine (quotes rescue it); unquoted is the trap:
    expect(findMermaidTraps('flowchart TB\n  A -. "x.y" .-> B')).toHaveLength(0);
    expect(findMermaidTraps('flowchart TB\n  A -. x.y .-> B')).toHaveLength(1);
    // ";" in sequenceDiagram message / note text is a statement separator:
    expect(findMermaidTraps('sequenceDiagram\n  Note over X: claims live; route guards pass')).toHaveLength(1);
    expect(findMermaidTraps('sequenceDiagram\n  X->>Y: success; onSnapshot fires')).toHaveLength(1);
    // the same ";" in a FLOWCHART label is harmless (sequence-only trap):
    expect(findMermaidTraps('flowchart TB\n  A["foo; bar"] --> B')).toHaveLength(0);
    expect(findMermaidTraps('sequenceDiagram\n  participant FBAuth as Firebase Auth')).toHaveLength(0);
    // colon-less guard + themed (directive/frontmatter) sequences keep protection:
    expect(findMermaidTraps('sequenceDiagram\n  loop every 5s; forever\n  end')).toHaveLength(1);
    expect(findMermaidTraps('%%{init: {"theme":"neutral"}}%%\nsequenceDiagram\n  Note over X: a; b')).toHaveLength(1);
    expect(findMermaidTraps('---\ntitle: Flow\n---\nsequenceDiagram\n  Note over X: a; b')).toHaveLength(1);
    // ";" inside a %% comment is ignored (mermaid drops comments):
    expect(findMermaidTraps('sequenceDiagram\n  %% note: a; b\n  X->>Y: ping')).toHaveLength(0);
    // entity refs parse fine yet carry a trailing ";" — NOT flagged (incl. the #quot; escape):
    expect(findMermaidTraps('sequenceDiagram\n  Note over X: emit #quot;done#quot; now')).toHaveLength(0);
    expect(findMermaidTraps('sequenceDiagram\n  Note over X: love #9829; it')).toHaveLength(0);
    expect(findMermaidTraps('sequenceDiagram\n  Note over X: dash &#8212; here')).toHaveLength(0);
    // a real ";" alongside an entity is still caught:
    expect(findMermaidTraps('sequenceDiagram\n  Note over X: #quot;a#quot;; then b')).toHaveLength(1);
  });
});

describe('arch-doc-integrity: findContrastTraps (dark-mode legibility)', () => {
  it('flags a filled classDef with no text color; allows fill+color and bare stroke', () => {
    // filled but no color: → illegible in GitHub dark mode:
    expect(findContrastTraps('  classDef ok fill:#98F5E1,stroke:#2B2D42,stroke-width:2px;')).toHaveLength(1);
    expect(findContrastTraps('  classDef ok fill:#98F5E1,stroke:#2B2D42;')[0]).toContain('"ok"');
    // fill + pinned color → the fix (dark text or white text), not flagged:
    expect(findContrastTraps('  classDef ok fill:#98F5E1,color:#2B2D42,stroke:#2B2D42;')).toHaveLength(0);
    expect(findContrastTraps('  classDef src fill:#f53d6b,color:#fff,stroke:#2B2D42,stroke-width:3px;')).toHaveLength(0);
    // order-independent:
    expect(findContrastTraps('  classDef ok color:#2B2D42,fill:#98F5E1;')).toHaveLength(0);
    // no fill → keeps the theme's own legible fill+text pairing, exempt:
    expect(findContrastTraps('  classDef gap stroke:#888,stroke-dasharray: 4 4;')).toHaveLength(0);
    // non-classDef lines are ignored:
    expect(findContrastTraps('  A["fill:#fff in prose"] --> B')).toHaveLength(0);
  });
});

describe('arch-doc-integrity: parseDoc + collectHeadingSlugs', () => {
  it('separates prose from fences and dedups heading slugs', () => {
    const doc = parseDoc('# Title\n\n```mermaid\n# not a heading\n```\n\n## Overview\n## Overview\n');
    expect(doc.fenceBlocks).toHaveLength(1);
    const slugs = collectHeadingSlugs(doc);
    expect(slugs.has('title')).toBe(true);
    expect(slugs.has('overview')).toBe(true);
    expect(slugs.has('overview-1')).toBe(true);
    expect(slugs.has('not-a-heading')).toBe(false); // inside a fence
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.7 — no-adaptive-fg-on-kept-light-island
// ─────────────────────────────────────────────────────────────────────────────
import {
  deriveAdaptiveVars,
  findIslandPolarityViolations,
  deriveAdaptiveSwiftTokens,
  findSwiftIslandPolarityViolations,
} from './no-adaptive-fg-on-kept-light-island';

const TOKENS_FIXTURE = JSON.stringify({
  color: {
    textPrimary: { alias: ['ink'] },
    textSecondary: { alias: ['coolGray'] },
    surface: {},
    border: {},
    success: {},
    primary: {},
    butter: {},
    overlay: {},
    textOnPrimary: {},
  },
  darkColor: {
    textPrimary: { platforms: ['web', 'ios'] },
    textSecondary: { platforms: ['web', 'ios'] },
    surface: { platforms: ['web', 'ios'] },
    border: { platforms: ['web', 'ios'] },
    overlay: { platforms: ['web'] }, // web-only dark leaf
  },
});

describe('no-adaptive-fg-on-kept-light-island: web', () => {
  const ADAPTIVE = deriveAdaptiveVars(TOKENS_FIXTURE);
  it('derives adaptive vars + aliases; islands excluded', () => {
    expect(ADAPTIVE.has('--color-text-primary')).toBe(true);
    expect(ADAPTIVE.has('--color-ink')).toBe(true); // alias
    expect(ADAPTIVE.has('--color-cool-gray')).toBe(true); // alias of textSecondary
    expect(ADAPTIVE.has('--color-success')).toBe(false); // island
    expect(ADAPTIVE.has('--color-text-on-primary')).toBe(false);
  });
  it('flags adaptive fg on island bg; passes stays-* + adaptive-on-adaptive + dark-ok', () => {
    expect(findIslandPolarityViolations('.x { background: var(--color-success); color: var(--color-text-primary); }', ADAPTIVE)).toHaveLength(1);
    expect(findIslandPolarityViolations('.y { background: var(--color-primary); color: var(--color-surface); }', ADAPTIVE)).toHaveLength(1);
    expect(findIslandPolarityViolations('.a { background: var(--color-success); color: var(--color-text-on-primary); }', ADAPTIVE)).toHaveLength(0);
    expect(findIslandPolarityViolations('.b { background: var(--color-surface); color: var(--color-text-primary); }', ADAPTIVE)).toHaveLength(0);
    expect(findIslandPolarityViolations('.c { background: var(--color-success); color: var(--color-ink); /* dark-ok: translucent wash */ }', ADAPTIVE)).toHaveLength(0);
    expect(findIslandPolarityViolations('.d { background: var(--color-success); color: var(--color-ink); /* dark-ok */ }', ADAPTIVE)).toHaveLength(1); // bare dark-ok no reason
  });
});

describe('no-adaptive-fg-on-kept-light-island: Swift', () => {
  const ADAPTIVE = deriveAdaptiveSwiftTokens(TOKENS_FIXTURE);
  it('derives ios-platform adaptive set; web-only leaf excluded', () => {
    expect(ADAPTIVE.has('textPrimary')).toBe(true);
    expect(ADAPTIVE.has('ink')).toBe(true);
    expect(ADAPTIVE.has('overlay')).toBe(false); // web-only dark leaf
    expect(ADAPTIVE.has('butter')).toBe(false); // island
  });
  it('flags adaptive fg + island bg in one run; skips conditional + honors dark-ok', () => {
    const viol = (s: string) => findSwiftIslandPolarityViolations(s, ADAPTIVE);
    expect(viol('Text("x")\n    .foregroundStyle(Colors.ink)\n    .background(Colors.butter)')).toHaveLength(1);
    expect(viol('Text("x")\n    .foregroundStyle(Colors.ink)\n    .background(\n        RoundedRectangle()\n            .fill(Colors.butter)\n    )')).toHaveLength(1);
    expect(viol('Text("x")\n    .foregroundStyle(Colors.surface)\n    .background(Colors.surface)')).toHaveLength(0);
    expect(viol('Text("x")\n    .foregroundStyle(isActive ? .white : Colors.ink)\n    .background(isActive ? Colors.primary : Colors.butter)')).toHaveLength(0); // conditional ceiling
    expect(viol('Text("x")\n    .foregroundStyle(Colors.ink)\n    // dark-ok: translucent wash\n    .background(Colors.butter)')).toHaveLength(0);
    expect(viol('Text("x")\n    .foregroundStyle(Colors.ink)\n    // dark-ok\n    .background(Colors.butter)')).toHaveLength(1); // bare dark-ok
  });
});

describe('no-adaptive-fg-on-kept-light-island: deriveAdaptiveSwiftTokens platforms-absent', () => {
  it('treats a darkColor leaf with NO platforms array as adaptive (all-platforms)', () => {
    const t = JSON.stringify({ color: { foo: { alias: ['bar'] } }, darkColor: { foo: {} } });
    const set = deriveAdaptiveSwiftTokens(t);
    expect(set.has('foo')).toBe(true); // absent platforms → included
    expect(set.has('bar')).toBe(true); // alias included too
  });
});
