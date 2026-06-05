import { describe, it, expect } from 'vitest';
import { countInlineStyles } from './no-inline-style';
import { countBareHexInTsx } from './no-bare-hex-in-tsx';
import { countBareHexInCss } from './no-bare-hex-in-css';
import { countBarePxInCss } from './no-bare-px-in-css';
import { countConsoleInSource } from './no-console-in-source';

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
