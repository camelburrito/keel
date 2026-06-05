import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { scrubGaxiosError, OAUTH_SECRET_FIELDS, wrapHandler } from './instrument';

// firebase-functions/logger emits to console; silence it in tests.
vi.mock('firebase-functions/logger', () => ({
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

describe('OAUTH_SECRET_FIELDS', () => {
  it('contains the 4 documented OAuth-secret fields', () => {
    expect(OAUTH_SECRET_FIELDS).toEqual(
      new Set(['refresh_token', 'access_token', 'id_token', 'client_secret']),
    );
  });

  it('deliberately excludes `code` (HTTP-status semantics dominate)', () => {
    expect(OAUTH_SECRET_FIELDS.has('code')).toBe(false);
  });
});

describe('scrubGaxiosError', () => {
  it('redacts top-level OAuth secret fields', () => {
    expect(scrubGaxiosError({ refresh_token: 'r1', other: 'x' })).toEqual({
      refresh_token: '[REDACTED_OAUTH_TOKEN]',
      other: 'x',
    });
  });

  it('redacts nested OAuth secret fields', () => {
    expect(scrubGaxiosError({ config: { data: { access_token: 'a1', kept: 'k' } } })).toEqual({
      config: { data: { access_token: '[REDACTED_OAUTH_TOKEN]', kept: 'k' } },
    });
  });

  it('converts URLSearchParams to plain object + redacts secrets', () => {
    const params = new URLSearchParams();
    params.set('refresh_token', 'r1');
    params.set('grant_type', 'refresh_token');
    expect(scrubGaxiosError(params)).toEqual({
      refresh_token: '[REDACTED_OAUTH_TOKEN]',
      grant_type: 'refresh_token',
    });
  });

  it('short-circuits cycles with <cyclic> sentinel', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    const result = scrubGaxiosError(a) as Record<string, unknown>;
    expect(result.name).toBe('a');
    expect(result.self).toBe('<cyclic>');
  });

  it('passes primitives through unchanged', () => {
    expect(scrubGaxiosError(null)).toBe(null);
    expect(scrubGaxiosError(undefined)).toBe(undefined);
    expect(scrubGaxiosError('plain string')).toBe('plain string');
    expect(scrubGaxiosError(42)).toBe(42);
  });
});

describe('wrapHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through HttpsError unchanged', async () => {
    const handler = async () => { throw new HttpsError('not-found', 'thing/missing'); };
    const wrapped = wrapHandler(handler);
    await expect(wrapped()).rejects.toMatchObject({
      code: 'not-found',
      message: expect.stringContaining('thing/missing'),
    });
  });

  it('wraps non-HttpsError throws as internal', async () => {
    const handler = async () => { throw new Error('boom'); };
    const wrapped = wrapHandler(handler);
    await expect(wrapped()).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('returns success value through unchanged', async () => {
    const handler = async () => ({ ok: true, value: 42 });
    const wrapped = wrapHandler(handler);
    await expect(wrapped()).resolves.toEqual({ ok: true, value: 42 });
  });

  it('emits callable-invocation breadcrumb when request.auth.uid present', async () => {
    const { logger } = await import('../utils/logger');
    const infoSpy = vi.spyOn(logger, 'info');
    const handler = async () => ({ ok: true });
    const wrapped = wrapHandler(handler);
    await wrapped({ auth: { uid: 'abc123' } } as Parameters<typeof handler>[0]);
    expect(infoSpy).toHaveBeenCalledWith('callable-invocation', { uid: 'abc123' });
  });

  it('does not emit breadcrumb when auth absent', async () => {
    const { logger } = await import('../utils/logger');
    const infoSpy = vi.spyOn(logger, 'info');
    infoSpy.mockClear();
    const handler = async () => ({ ok: true });
    const wrapped = wrapHandler(handler);
    await wrapped();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('returns non-function inputs unchanged', () => {
    const obj = { not: 'a function' };
    expect(wrapHandler(obj)).toBe(obj);
  });
});
