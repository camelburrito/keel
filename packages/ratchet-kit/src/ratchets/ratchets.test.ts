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
