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
    expect(validateEmail('  ALICE@EXAMPLE.COM  ', { field: 'member/email' }))
      .toBe('alice@example.com');
  });

  it('throws <entity>/invalid-email on bad format', () => {
    expect(() => validateEmail('not-an-email', { field: 'member/email' }))
      .toThrowError('member/invalid-email');
  });

  it('throws <field>-required when missing required', () => {
    expect(() => validateEmail(undefined, { field: 'member/email', required: true }))
      .toThrowError('member/email-required');
  });

  it('throws <field>-too-long when exceeding maxLen', () => {
    const long = 'a'.repeat(250) + '@x.io'; // 255 chars
    expect(() => validateEmail(long, { field: 'member/email' }))
      .toThrowError('member/email-too-long');
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
