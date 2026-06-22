import { describe, it, expect } from 'vitest';
import { validateString, validateEmail, validateUrl } from './validation';

describe('validateString', () => {
  it('returns trimmed value for valid input', () => {
    expect(validateString('  hello  ', { field: 'x', maxLen: 100 })).toBe('hello');
  });

  it('returns undefined for missing optional', () => {
    expect(validateString(undefined, { field: 'x', maxLen: 100 })).toBeUndefined();
    expect(validateString('   ', { field: 'x', maxLen: 100 })).toBeUndefined();
  });

  it('throws <field>-required for missing required', () => {
    expect(() => validateString(undefined, { field: 'x', maxLen: 100, required: true }))
      .toThrowError('x-required');
    expect(() => validateString('  ', { field: 'x', maxLen: 100, required: true }))
      .toThrowError('x-required');
    expect(() => validateString(42, { field: 'x', maxLen: 100, required: true }))
      .toThrowError('x-required');
  });

  it('throws <field>-too-long when exceeding maxLen', () => {
    expect(() => validateString('a'.repeat(101), { field: 'x', maxLen: 100 }))
      .toThrowError('x-too-long');
  });
});

describe('validateEmail', () => {
  it('returns lower-cased trimmed valid email', () => {
    expect(validateEmail('  ALICE@EXAMPLE.COM  ', { field: 'user/email' }))
      .toBe('alice@example.com');
  });

  it('throws <entity>/invalid-email on bad format', () => {
    expect(() => validateEmail('not-an-email', { field: 'user/email' }))
      .toThrowError('user/invalid-email');
  });

  it('throws <field>-required when missing required', () => {
    expect(() => validateEmail(undefined, { field: 'user/email', required: true }))
      .toThrowError('user/email-required');
  });

  it('throws <field>-too-long when exceeding maxLen', () => {
    const long = 'a'.repeat(250) + '@x.io'; // 255 chars
    expect(() => validateEmail(long, { field: 'user/email' }))
      .toThrowError('user/email-too-long');
  });
});

describe('validateUrl', () => {
  it('returns trimmed valid https URL', () => {
    expect(validateUrl('  https://example.com/path  ', { field: 'cb' }))
      .toBe('https://example.com/path');
  });

  it('throws <field>-invalid-protocol for non-https', () => {
    expect(() => validateUrl('http://example.com', { field: 'cb' }))
      .toThrowError('cb-invalid-protocol');
    expect(() => validateUrl('javascript:alert(1)', { field: 'cb' }))
      .toThrowError('cb-invalid-protocol');
  });

  it('allows http when requireHttps=false', () => {
    expect(validateUrl('http://example.com', { field: 'cb', requireHttps: false }))
      .toBe('http://example.com');
  });

  it('throws <field>-invalid-format for unparseable', () => {
    expect(() => validateUrl('not a url at all', { field: 'cb' }))
      .toThrowError('cb-invalid-format');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.3 expansion — edge cases + boundary conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('validateString — edge cases', () => {
  it('accepts string at exactly maxLen (boundary)', () => {
    expect(validateString('a'.repeat(100), { field: 'x', maxLen: 100 })).toBe(
      'a'.repeat(100),
    );
  });

  it('treats null + boolean + array + object as non-string (optional → undefined)', () => {
    expect(validateString(null, { field: 'x', maxLen: 100 })).toBeUndefined();
    expect(validateString(true, { field: 'x', maxLen: 100 })).toBeUndefined();
    expect(validateString([], { field: 'x', maxLen: 100 })).toBeUndefined();
    expect(validateString({}, { field: 'x', maxLen: 100 })).toBeUndefined();
  });

  it('treats null + boolean as non-string (required → throws)', () => {
    expect(() => validateString(null, { field: 'x', maxLen: 100, required: true }))
      .toThrowError('x-required');
    expect(() => validateString(false, { field: 'x', maxLen: 100, required: true }))
      .toThrowError('x-required');
  });

  it('throws too-long based on TRIMMED length, not raw', () => {
    // 100 chars + leading/trailing spaces should pass after trim.
    expect(validateString('  ' + 'a'.repeat(100) + '  ', { field: 'x', maxLen: 100 })).toBe(
      'a'.repeat(100),
    );
    // 101-char content should fail even with surrounding whitespace.
    expect(() =>
      validateString('  ' + 'a'.repeat(101) + '  ', { field: 'x', maxLen: 100 }),
    ).toThrowError('x-too-long');
  });

  it('preserves internal whitespace (trims only leading/trailing)', () => {
    expect(validateString('  hello world  ', { field: 'x', maxLen: 100 })).toBe(
      'hello world',
    );
  });
});

describe('validateEmail — edge cases', () => {
  it('accepts mixed-case domain (lower-cases everything)', () => {
    expect(validateEmail('Alice@EXAMPLE.COM', { field: 'user/email' })).toBe(
      'alice@example.com',
    );
  });

  it('rejects email with no @ symbol', () => {
    expect(() => validateEmail('alice.example.com', { field: 'user/email' }))
      .toThrowError('user/invalid-email');
  });

  it('rejects email with no domain dot', () => {
    expect(() => validateEmail('alice@example', { field: 'user/email' }))
      .toThrowError('user/invalid-email');
  });

  it('rejects email with embedded whitespace', () => {
    expect(() => validateEmail('alice @example.com', { field: 'user/email' }))
      .toThrowError('user/invalid-email');
  });

  it('honors custom maxLen ceiling', () => {
    const short = 'aa@bb.io'; // 8 chars
    expect(validateEmail(short, { field: 'user/email', maxLen: 10 })).toBe(short);
    expect(() => validateEmail('a'.repeat(20) + '@x.io', { field: 'user/email', maxLen: 10 }))
      .toThrowError('user/email-too-long');
  });

  it('returns undefined for optional missing input', () => {
    expect(validateEmail(undefined, { field: 'user/email' })).toBeUndefined();
    expect(validateEmail('   ', { field: 'user/email' })).toBeUndefined();
  });

  it('error code uses first segment as entity (slash-prefix)', () => {
    expect(() => validateEmail('not-an-email', { field: 'tenant/owner/email' }))
      .toThrowError('tenant/invalid-email');
  });

  it('error code is field-as-entity when no slash', () => {
    expect(() => validateEmail('not-an-email', { field: 'contact' }))
      .toThrowError('contact/invalid-email');
  });
});

describe('validateUrl — edge cases', () => {
  it('rejects data: URLs', () => {
    expect(() => validateUrl('data:text/html,<script>alert(1)</script>', { field: 'cb' }))
      .toThrowError('cb-invalid-protocol');
  });

  it('rejects ftp: URLs by default', () => {
    expect(() => validateUrl('ftp://files.example.com', { field: 'cb' }))
      .toThrowError('cb-invalid-protocol');
  });

  it('accepts https with port + query + fragment', () => {
    expect(validateUrl('https://example.com:8443/path?q=1#frag', { field: 'cb' }))
      .toBe('https://example.com:8443/path?q=1#frag');
  });

  it('returns undefined for optional missing input', () => {
    expect(validateUrl(undefined, { field: 'cb' })).toBeUndefined();
    expect(validateUrl('   ', { field: 'cb' })).toBeUndefined();
  });

  it('throws <field>-required when required + missing', () => {
    expect(() => validateUrl(undefined, { field: 'cb', required: true }))
      .toThrowError('cb-required');
    expect(() => validateUrl('  ', { field: 'cb', required: true }))
      .toThrowError('cb-required');
  });

  it('honors custom maxLen ceiling', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(50);
    expect(() => validateUrl(longUrl, { field: 'cb', maxLen: 30 }))
      .toThrowError('cb-too-long');
  });
});
