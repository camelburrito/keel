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

// ─────────────────────────────────────────────────────────────────────────────
// v0.3 expansion — depth + edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('scrubGaxiosError — depth + breadth', () => {
  it('redacts all 4 OAuth secret fields', () => {
    const input = {
      refresh_token: 'r1',
      access_token: 'a1',
      id_token: 'i1',
      client_secret: 'cs1',
      other: 'kept',
    };
    const result = scrubGaxiosError(input) as Record<string, unknown>;
    expect(result.refresh_token).toBe('[REDACTED_OAUTH_TOKEN]');
    expect(result.access_token).toBe('[REDACTED_OAUTH_TOKEN]');
    expect(result.id_token).toBe('[REDACTED_OAUTH_TOKEN]');
    expect(result.client_secret).toBe('[REDACTED_OAUTH_TOKEN]');
    expect(result.other).toBe('kept');
  });

  it('redacts secrets inside arrays of objects', () => {
    const input = [
      { refresh_token: 'r1' },
      { other: 'ok' },
    ];
    const result = scrubGaxiosError(input) as Array<Record<string, unknown>>;
    expect(result[0]!.refresh_token).toBe('[REDACTED_OAUTH_TOKEN]');
    expect(result[1]!.other).toBe('ok');
  });

  it('redacts at 4+ nesting levels', () => {
    const input = {
      error: {
        response: {
          config: {
            data: { refresh_token: 'deep_secret' },
          },
        },
      },
    };
    const result = scrubGaxiosError(input);
    expect(JSON.stringify(result)).toContain('[REDACTED_OAUTH_TOKEN]');
    expect(JSON.stringify(result)).not.toContain('deep_secret');
  });

  it('does NOT scrub `code` field (HTTP-status semantics dominate)', () => {
    const input = { code: 'ERR_BAD_REQUEST', message: 'failed' };
    const result = scrubGaxiosError(input) as Record<string, unknown>;
    expect(result.code).toBe('ERR_BAD_REQUEST');
  });

  it('handles cyclic ref inside an array element', () => {
    const inner: Record<string, unknown> = { name: 'inner' };
    inner.self = inner;
    const input = [inner];
    const result = scrubGaxiosError(input) as Array<Record<string, unknown>>;
    expect(result[0]!.name).toBe('inner');
    expect(result[0]!.self).toBe('<cyclic>');
  });

  it('returns a fresh object — does not mutate input', () => {
    const input = { refresh_token: 'r1', other: 'ok' };
    scrubGaxiosError(input);
    expect(input.refresh_token).toBe('r1'); // original unchanged
  });

  it('URLSearchParams with only non-secret keys still converts to plain object', () => {
    const params = new URLSearchParams();
    params.set('grant_type', 'refresh_token');
    params.set('scope', 'read');
    const result = scrubGaxiosError(params);
    expect(result).toEqual({ grant_type: 'refresh_token', scope: 'read' });
    // Verify it's now a plain object, not still a URLSearchParams.
    expect(result instanceof URLSearchParams).toBe(false);
  });
});

describe('wrapHandler — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles sync handler that throws (not async)', () => {
    const handler = (): unknown => { throw new HttpsError('not-found', 'sync/missing'); };
    const wrapped = wrapHandler(handler);
    expect(() => wrapped()).toThrowError('sync/missing');
  });

  it('handles sync handler that returns non-promise value', () => {
    const handler = (): { hi: string } => ({ hi: 'there' });
    const wrapped = wrapHandler(handler);
    expect(wrapped()).toEqual({ hi: 'there' });
  });

  it('async handler resolving with HttpsError-shaped Promise.reject', async () => {
    const handler = async () => {
      // Returning a rejected Promise behaves the same as throwing.
      return Promise.reject(new HttpsError('permission-denied', 'auth/forbidden'));
    };
    const wrapped = wrapHandler(handler);
    await expect(wrapped()).rejects.toMatchObject({
      code: 'permission-denied',
      message: expect.stringContaining('auth/forbidden'),
    });
  });

  it('async handler with non-HttpsError Promise.reject re-wraps as internal', async () => {
    const handler = async () => Promise.reject(new TypeError('Cannot read prop foo'));
    const wrapped = wrapHandler(handler);
    await expect(wrapped()).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('Proxy get-trap forwards arbitrary property reads', () => {
    const handler = Object.assign(
      function fakeHandler() { return 1; },
      { __trigger: { id: 'fake-trigger' }, run: vi.fn() },
    );
    const wrapped = wrapHandler(handler);
    // Both metadata properties should be readable through the Proxy.
    expect((wrapped as unknown as { __trigger: { id: string } }).__trigger).toEqual({
      id: 'fake-trigger',
    });
    expect(typeof (wrapped as unknown as { run: unknown }).run).toBe('function');
  });

  it('breadcrumb-emission failures do NOT block handler', async () => {
    const { logger } = await import('../utils/logger');
    // Force the breadcrumb to throw — wrap logger.info to raise. The handler
    // must STILL run + return.
    const originalInfo = logger.info;
    logger.info = ((..._args: unknown[]) => {
      throw new Error('breadcrumb-emit failure');
    }) as typeof logger.info;
    try {
      const handler = async () => ({ ok: true });
      const wrapped = wrapHandler(handler);
      await expect(wrapped({ auth: { uid: 'abc123' } } as Parameters<typeof handler>[0]))
        .resolves.toEqual({ ok: true });
    } finally {
      logger.info = originalInfo;
    }
  });

  it('breadcrumb skipped when request shape is unexpected (e.g., null)', async () => {
    const { logger } = await import('../utils/logger');
    const infoSpy = vi.spyOn(logger, 'info');
    infoSpy.mockClear();
    const handler = async () => ({ ok: true });
    const wrapped = wrapHandler(handler);
    await wrapped(null as unknown as Parameters<typeof handler>[0]);
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
