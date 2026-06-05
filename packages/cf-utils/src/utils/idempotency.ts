import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Backend idempotency claim (defense-in-depth against duplicate writes when
 * frontend guards fail — stale view state, test paths, custom clients,
 * malicious actor).
 *
 * Pattern: client sends `requestId` (short-lived UUID generated per user
 * action) alongside the write args. Server claims the requestId in a
 * transaction against `users/{uid}/requestIds/{requestId}`; a second claim
 * within WINDOW_MS is rejected with `already-exists`.
 *
 * Design:
 * - NO result caching. A second claim rejects rather than returning the cached
 *   response. Fits the "engaged-user mis-tap" profile.
 * - Scope: per-user. requestId collision across users is astronomically
 *   unlikely (UUID v4) AND auth principal is part of the lock key.
 * - TTL: the helper does NOT clean up. Configure Firestore TTL policy on
 *   `users/{uid}/requestIds` (field `expiresAt`) as the cleanup mechanism:
 *     gcloud firestore fields ttl update expiresAt \
 *       --collection-group=requestIds --enable-ttl
 * - Optional: when `requestId` is absent/empty, the helper is a no-op
 *   pass-through (backward compat for legacy clients).
 */
const WINDOW_MS = 5_000;

export async function claimIdempotency(
  uid: string,
  requestId: string | undefined,
  functionName: string,
): Promise<void> {
  if (!requestId || typeof requestId !== 'string') return;
  if (requestId.length > 128) {
    throw new HttpsError('invalid-argument', 'idempotency/request-id-too-long');
  }
  // Reject path-traversal chars + control chars. Firestore allows most
  // characters in doc IDs but `/` is path-separator and `__` is reserved.
  if (/[^\w.-]/.test(requestId)) {
    throw new HttpsError('invalid-argument', 'idempotency/request-id-invalid-chars');
  }

  const db = getFirestore();
  const ref = db.doc(`users/${uid}/requestIds/${requestId}`);
  const now = Date.now();
  const expiresAt = new Date(now + WINDOW_MS);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const claimedAt = snap.data()?.claimedAt as number | undefined;
      if (claimedAt && now - claimedAt < WINDOW_MS) {
        throw new HttpsError(
          'already-exists',
          `idempotency/duplicate-request (${functionName})`,
        );
      }
      // Stale claim — overwrite.
    }
    // NOTE: users/{uid}/requestIds/* writes are intentionally NOT audited.
    // These are idempotency locks (pure mechanics), not user actions with
    // forensic value. The no-audit-bypass-in-functions ratchet (per playbook
    // 09-firebase-stack) should exclude this file.
    tx.set(ref, {
      claimedAt: now,
      expiresAt,
      functionName,
    });
  });
}
