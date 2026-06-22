// checkRateLimit contract tests.
//
// Drives the helper through a fake Firestore that the test fully controls.
// FieldValue.increment is stubbed as a sentinel; the fake's `update` op
// inlines the increment so subsequent reads see the new count.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const INCREMENT_SENTINEL = { __increment: true };

const store = new Map<string, { count: number; windowStart: number }>();

function makeRef(path: string): any {
  return { path, _key: path };
}

function makeTxnFor(store: Map<string, any>): any {
  return {
    get: async (ref: any) => ({
      exists: store.has(ref._key),
      data: () => store.get(ref._key),
    }),
    set: (ref: any, data: any) => {
      store.set(ref._key, data);
    },
    update: (ref: any, patch: Record<string, any>) => {
      const cur = store.get(ref._key) ?? {};
      const next: Record<string, any> = { ...cur };
      for (const [k, v] of Object.entries(patch)) {
        if (v && typeof v === 'object' && (v as any).__increment) {
          next[k] = (next[k] ?? 0) + 1;
        } else {
          next[k] = v;
        }
      }
      store.set(ref._key, next);
    },
  };
}

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: (_n: number) => INCREMENT_SENTINEL,
  },
  getFirestore: () => ({
    doc: (path: string) => makeRef(path),
    runTransaction: async (fn: (tx: any) => Promise<void>) => {
      await fn(makeTxnFor(store));
    },
  }),
}));

import { checkRateLimit } from './rateLimit';

beforeEach(() => {
  store.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkRateLimit', () => {
  it('first call creates doc at users/{uid}/rateLimits/{fn} with count=1', async () => {
    const before = Date.now();
    await checkRateLimit('uid-1', 'fn-x', 5);
    const after = Date.now();
    const doc = store.get('users/uid-1/rateLimits/fn-x')!;
    expect(doc.count).toBe(1);
    expect(doc.windowStart).toBeGreaterThanOrEqual(before);
    expect(doc.windowStart).toBeLessThanOrEqual(after);
  });

  it('second call within limit increments count to 2', async () => {
    await checkRateLimit('uid-1', 'fn-x', 5);
    await checkRateLimit('uid-1', 'fn-x', 5);
    expect(store.get('users/uid-1/rateLimits/fn-x')?.count).toBe(2);
  });

  it('hits limit at maxPerWindow → throws resource-exhausted', async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit('uid-1', 'fn-x', 5);
    }
    await expect(checkRateLimit('uid-1', 'fn-x', 5)).rejects.toThrow(HttpsError);
    await expect(checkRateLimit('uid-1', 'fn-x', 5)).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: expect.stringContaining('Rate limit exceeded'),
    });
  });

  it('count is not incremented when limit hit (rejection happens BEFORE update)', async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit('uid-1', 'fn-x', 5);
    }
    const beforeReject = store.get('users/uid-1/rateLimits/fn-x')!.count;
    await expect(checkRateLimit('uid-1', 'fn-x', 5)).rejects.toThrow();
    const afterReject = store.get('users/uid-1/rateLimits/fn-x')!.count;
    expect(afterReject).toBe(beforeReject);
  });

  it('window reset after > 60s — count resets to 1, windowStart advances', async () => {
    // Seed an old window 90s in the past.
    const oldWindow = Date.now() - 90_000;
    store.set('users/uid-1/rateLimits/fn-x', { count: 999, windowStart: oldWindow });
    await checkRateLimit('uid-1', 'fn-x', 5);
    const doc = store.get('users/uid-1/rateLimits/fn-x')!;
    expect(doc.count).toBe(1);
    expect(doc.windowStart).toBeGreaterThan(oldWindow);
  });

  it('per-user isolation: different uids share function name but independent counters', async () => {
    await checkRateLimit('uid-1', 'fn-x', 5);
    await checkRateLimit('uid-2', 'fn-x', 5);
    expect(store.get('users/uid-1/rateLimits/fn-x')?.count).toBe(1);
    expect(store.get('users/uid-2/rateLimits/fn-x')?.count).toBe(1);
  });

  it('per-function isolation: same uid different functions share uid but independent counters', async () => {
    await checkRateLimit('uid-1', 'fn-x', 5);
    await checkRateLimit('uid-1', 'fn-y', 5);
    expect(store.get('users/uid-1/rateLimits/fn-x')?.count).toBe(1);
    expect(store.get('users/uid-1/rateLimits/fn-y')?.count).toBe(1);
  });

  it('maxPerWindow=1 enforces single-call-per-window', async () => {
    await checkRateLimit('uid-1', 'fn-x', 1);
    await expect(checkRateLimit('uid-1', 'fn-x', 1)).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });
});
