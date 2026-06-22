import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const WINDOW_MS = 60_000; // 1-minute sliding window

/**
 * Per-user rate limiter using Firestore counters at
 * `users/{uid}/rateLimits/{functionName}`. Written via Admin SDK — no client
 * access (firestore.rules should deny client reads/writes on this subcollection).
 *
 * @param uid - Firebase Auth UID of the caller
 * @param functionName - Name of the callable CF (used as doc ID)
 * @param maxPerWindow - Maximum allowed calls within WINDOW_MS
 * @throws HttpsError('resource-exhausted', ...) if limit exceeded
 */
export async function checkRateLimit(
  uid: string,
  functionName: string,
  maxPerWindow: number,
): Promise<void> {
  const db = getFirestore();
  const ref = db.doc(`users/${uid}/rateLimits/${functionName}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    const { count, windowStart } = snap.data() as { count: number; windowStart: number };

    if (now - windowStart > WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    if (count >= maxPerWindow) {
      throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again in a minute.');
    }

    tx.update(ref, { count: FieldValue.increment(1) });
  });
}
