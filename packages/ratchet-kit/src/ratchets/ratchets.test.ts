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
