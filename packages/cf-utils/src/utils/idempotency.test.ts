// claimIdempotency contract tests.
//
// The helper opens its own transaction via `getFirestore().runTransaction(...)`,
// so the test mocks `firebase-admin/firestore` with a fake db whose
// `runTransaction` drives the fake's `get` / `set` against an in-memory store.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

// In-memory store for the fake Firestore. Reset before each test.
const store = new Map<string, { claimedAt: number; expiresAt: Date; functionName: string }>();

function makeRef(path: string): any {
  return {
    path,
    _key: path,
  };
}

function makeTxnFor(store: Map<string, any>): any {
  const writes: Array<{ ref: any; data: any }> = [];
  return {
    writes,
    get: async (ref: any) => ({
      exists: store.has(ref._key),
      data: () => store.get(ref._key),
    }),
    set: (ref: any, data: any) => {
      writes.push({ ref, data });
      store.set(ref._key, data);
    },
  };
}

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: (path: string) => makeRef(path),
    runTransaction: async (fn: (tx: any) => Promise<void>) => {
      const txn = makeTxnFor(store);
      await fn(txn);
      return txn;
    },
  }),
}));

import { claimIdempotency } from './idempotency';

beforeEach(() => {
  store.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('claimIdempotency', () => {
  describe('input guards', () => {
    it('no-op when requestId is undefined', async () => {
      await expect(claimIdempotency('uid-1', undefined, 'fn-x')).resolves.toBeUndefined();
      expect(store.size).toBe(0);
    });

    it('no-op when requestId is empty string', async () => {
      await expect(claimIdempotency('uid-1', '', 'fn-x')).resolves.toBeUndefined();
      expect(store.size).toBe(0);
    });

    it('throws invalid-argument for requestId > 128 chars', async () => {
      const long = 'a'.repeat(129);
      await expect(claimIdempotency('uid-1', long, 'fn-x')).rejects.toThrow(HttpsError);
      await expect(claimIdempotency('uid-1', long, 'fn-x')).rejects.toMatchObject({
        code: 'invalid-argument',
        message: expect.stringContaining('idempotency/request-id-too-long'),
      });
    });

    it('accepts requestId at exactly 128 chars', async () => {
      const okLen = 'a'.repeat(128);
      await expect(claimIdempotency('uid-1', okLen, 'fn-x')).resolves.toBeUndefined();
      expect(store.size).toBe(1);
    });

    it('throws invalid-argument for path-traversal `/`', async () => {
      await expect(claimIdempotency('uid-1', 'abc/def', 'fn-x')).rejects.toMatchObject({
        code: 'invalid-argument',
        message: expect.stringContaining('idempotency/request-id-invalid-chars'),
      });
    });

    it('throws invalid-argument for spaces', async () => {
      await expect(claimIdempotency('uid-1', 'abc def', 'fn-x')).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('accepts UUID-shaped requestId (hyphens + alphanumerics)', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      await expect(claimIdempotency('uid-1', uuid, 'fn-x')).resolves.toBeUndefined();
      expect(store.size).toBe(1);
    });

    it('accepts requestId with dots + underscores', async () => {
      await expect(claimIdempotency('uid-1', 'foo.bar_baz-123', 'fn-x')).resolves.toBeUndefined();
      expect(store.size).toBe(1);
    });
  });

  describe('claim behavior', () => {
    it('fresh claim writes doc at users/{uid}/requestIds/{requestId}', async () => {
      await claimIdempotency('uid-1', 'req-A', 'fn-x');
      expect(store.has('users/uid-1/requestIds/req-A')).toBe(true);
    });

    it('written doc has claimedAt / expiresAt / functionName', async () => {
      const before = Date.now();
      await claimIdempotency('uid-1', 'req-A', 'fn-x');
      const after = Date.now();
      const doc = store.get('users/uid-1/requestIds/req-A')!;
      expect(doc.functionName).toBe('fn-x');
      expect(doc.claimedAt).toBeGreaterThanOrEqual(before);
      expect(doc.claimedAt).toBeLessThanOrEqual(after);
      expect(doc.expiresAt).toBeInstanceOf(Date);
      // expiresAt should be ~5 seconds after claimedAt (WINDOW_MS)
      expect(doc.expiresAt.getTime() - doc.claimedAt).toBe(5_000);
    });

    it('duplicate claim within window throws already-exists', async () => {
      await claimIdempotency('uid-1', 'req-A', 'fn-x');
      await expect(claimIdempotency('uid-1', 'req-A', 'fn-x')).rejects.toMatchObject({
        code: 'already-exists',
        message: expect.stringContaining('idempotency/duplicate-request'),
      });
    });

    it('duplicate-request error message includes functionName', async () => {
      await claimIdempotency('uid-1', 'req-A', 'fn-foo');
      await expect(claimIdempotency('uid-1', 'req-A', 'fn-foo')).rejects.toMatchObject({
        message: expect.stringContaining('fn-foo'),
      });
    });

    it('stale claim (> WINDOW_MS) succeeds + overwrites', async () => {
      // Manually inject a stale claim aged 10s.
      const stale = Date.now() - 10_000;
      store.set('users/uid-1/requestIds/req-A', {
        claimedAt: stale,
        expiresAt: new Date(stale + 5_000),
        functionName: 'fn-x',
      });
      await expect(claimIdempotency('uid-1', 'req-A', 'fn-x')).resolves.toBeUndefined();
      // claimedAt should have advanced (overwritten).
      const updated = store.get('users/uid-1/requestIds/req-A')!;
      expect(updated.claimedAt).toBeGreaterThan(stale);
    });

    it('per-user isolation: same requestId across different uids does not collide', async () => {
      await claimIdempotency('uid-1', 'req-A', 'fn-x');
      await claimIdempotency('uid-2', 'req-A', 'fn-x');
      expect(store.has('users/uid-1/requestIds/req-A')).toBe(true);
      expect(store.has('users/uid-2/requestIds/req-A')).toBe(true);
    });
  });
});
