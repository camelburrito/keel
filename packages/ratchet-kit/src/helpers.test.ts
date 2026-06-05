import { describe, it, expect } from 'vitest';
import {
  stripTsLineAndBlockComments,
  stripSwiftCommentsAndDebugBlocks,
  stripSwiftPreviewBlocks,
  checkDeferralCount,
  countMatchesIgnoringBrands,
} from './helpers';

describe('stripTsLineAndBlockComments', () => {
  it('strips // line comments', () => {
    expect(stripTsLineAndBlockComments('foo // bar\nbaz')).toBe('foo \nbaz');
  });

  it('strips /* block comments */', () => {
    expect(stripTsLineAndBlockComments('foo /* bar */ baz')).toBe('foo  baz');
  });

  it('strips multi-line block comments', () => {
    expect(stripTsLineAndBlockComments('foo /* a\nb\nc */ baz')).toBe('foo  baz');
  });
});

describe('stripSwiftCommentsAndDebugBlocks', () => {
  it('strips Swift // line comments', () => {
    expect(stripSwiftCommentsAndDebugBlocks('let x = 1 // comment\nlet y = 2'))
      .toContain('let x = 1');
    expect(stripSwiftCommentsAndDebugBlocks('let x = 1 // comment\nlet y = 2'))
      .not.toContain('comment');
  });

  it('strips #if DEBUG blocks', () => {
    const src = `let a = 1
#if DEBUG
let debugOnly = "secret"
#endif
let b = 2`;
    const stripped = stripSwiftCommentsAndDebugBlocks(src);
    expect(stripped).not.toContain('debugOnly');
    expect(stripped).toContain('let a = 1');
    expect(stripped).toContain('let b = 2');
  });
});

describe('stripSwiftPreviewBlocks', () => {
  it('strips #Preview { ... } blocks', () => {
    const src = `struct MyView: View {
  var body: some View { Text("hello") }
}

#Preview {
  MyView()
    .accessibilityLabel("Preview only literal")
}

extension MyView { }`;
    const stripped = stripSwiftPreviewBlocks(src);
    expect(stripped).not.toContain('Preview only literal');
    expect(stripped).toContain('struct MyView');
    expect(stripped).toContain('extension MyView');
  });

  it('handles nested braces inside #Preview block', () => {
    const src = `#Preview {
  let x = { 1 + 2 }
  MyView()
}
let after = 1`;
    expect(stripSwiftPreviewBlocks(src)).toContain('let after = 1');
    expect(stripSwiftPreviewBlocks(src)).not.toContain('MyView');
  });
});

describe('checkDeferralCount', () => {
  it('returns null when counts match', () => {
    expect(
      checkDeferralCount('foo.ts', { count: 3, rationale: 'TODO migrate' }, 3, 'WEB_DEFERRED'),
    ).toBeNull();
  });

  it('fails on empty rationale', () => {
    const msg = checkDeferralCount('foo.ts', { count: 3, rationale: '   ' }, 3, 'WEB_DEFERRED');
    expect(msg).toContain('empty rationale');
  });

  it('fails when file no longer exists in scan', () => {
    const msg = checkDeferralCount(
      'foo.ts',
      { count: 3, rationale: 'TODO' },
      undefined,
      'WEB_DEFERRED',
    );
    expect(msg).toContain('does not exist');
  });

  it('fails when actual > expected (new violation)', () => {
    const msg = checkDeferralCount('foo.ts', { count: 3, rationale: 'TODO' }, 4, 'WEB_DEFERRED');
    expect(msg).toContain('grew');
    expect(msg).toContain('expected 3');
  });

  it('fails when actual < expected (silent migration without count update)', () => {
    const msg = checkDeferralCount('foo.ts', { count: 3, rationale: 'TODO' }, 2, 'WEB_DEFERRED');
    expect(msg).toContain('shrunk');
    expect(msg).toContain('decrement');
  });
});

describe('countMatchesIgnoringBrands', () => {
  it('counts matches not in brand allowlist', () => {
    const src = `Text("Hello"); Text("Google"); Text("Apple"); Text("World");`;
    const pattern = /Text\("([^"]+)"\)/g;
    const brands = new Set(['Google', 'Apple']);
    expect(countMatchesIgnoringBrands(src, pattern, brands)).toBe(2);
  });
});
