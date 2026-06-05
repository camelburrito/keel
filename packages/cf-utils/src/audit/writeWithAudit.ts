// Atomic dual-write helper: parent doc + audit subcollection entry land in the
// SAME Firestore Transaction (or WriteBatch). Both writes either commit or
// neither does — the D-01 atomicity invariant (see keel playbook 09-firebase-stack
// § "The writeWithAudit pattern").
//
// Shape mirrors a helper called INSIDE `db.runTransaction(async (txn) => {...})`
// or alongside `db.batch()`. It does NOT open its own transaction; the caller
// owns the container so additional domain writes land atomically alongside
// parent + audit.

import {
  FieldValue,
  type DocumentReference,
  type Transaction,
  type WriteBatch,
} from 'firebase-admin/firestore';

export type AuditOp = 'create' | 'update' | 'delete';

/** Sentinel used in audit beforeData/afterData when a field is in redactFields. */
const REDACTED = '<redacted>';

export interface WriteWithAuditOptions {
  /** Transaction the caller is inside. */
  txn: Transaction;
  /** Reference to the parent (audited) document. Audit entry lands in docRef.collection('audit'). */
  docRef: DocumentReference;
  /** 'create' | 'update' | 'delete'. */
  op: AuditOp;
  /** Domain payload merged with audit metadata and written to the parent. REQUIRED for create/update; IGNORED for delete. */
  payload?: Record<string, unknown>;
  /** Snapshot of pre-write parent state, used as beforeData. REQUIRED (pass `null`) for create. */
  before: Record<string, unknown> | null;
  /** AUDIT_ACTIONS vocabulary literal (per-project catalog). */
  action: string;
  /** Raw auth.uid for user writes; 'system:<functionName>' for CF-triggered writes. */
  actor: string;
  /**
   * Field names to replace with '<redacted>' in beforeData + afterData of the
   * audit entry only. Parent write keeps real values (the underlying doc needs
   * them, e.g., OAuth tokens for API calls).
   * Scope: top-level keys only.
   */
  redactFields?: string[];
}

export interface WriteWithAuditBatchOptions {
  batch: WriteBatch;
  docRef: DocumentReference;
  op: AuditOp;
  payload?: Record<string, unknown>;
  before: Record<string, unknown> | null;
  action: string;
  actor: string;
  redactFields?: string[];
}

function redact(
  obj: Record<string, unknown> | null,
  fields: string[] | undefined,
): Record<string, unknown> | null {
  if (!obj || !fields || fields.length === 0) return obj;
  const cloned: Record<string, unknown> = { ...obj };
  for (const field of fields) {
    if (field in cloned) cloned[field] = REDACTED;
  }
  return cloned;
}

/**
 * Transaction overload. Caller MUST already be inside
 * `db.runTransaction(async (txn) => { ... })`.
 *
 * @example
 *   await db.runTransaction(async (txn) => {
 *     const before = (await txn.get(choreRef)).data() ?? null;
 *     writeWithAudit({
 *       txn, docRef: choreRef, op: 'update',
 *       payload: { status: 'done', completedAt: FieldValue.serverTimestamp() },
 *       before,
 *       action: AUDIT_ACTIONS.CHORE_MARKED_DONE,
 *       actor: callerUid,
 *     });
 *   });
 */
export function writeWithAudit(opts: WriteWithAuditOptions): void {
  const { txn, docRef, op, payload, before, action, actor, redactFields } = opts;
  const auditRef = docRef.collection('audit').doc();

  if (op === 'create') {
    const enrichedPayload = {
      ...(payload ?? {}),
      createdBy: actor,
      updatedBy: actor,
      lastAction: action,
    };
    txn.set(docRef, enrichedPayload);
    txn.set(auditRef, {
      timestamp: FieldValue.serverTimestamp(),
      actor,
      action,
      beforeData: null,
      afterData: redact(enrichedPayload, redactFields),
    });
    return;
  }

  if (op === 'update') {
    const enrichedPayload = {
      ...(payload ?? {}),
      updatedBy: actor,
      lastAction: action,
    };
    txn.update(docRef, enrichedPayload);
    const mergedAfter = { ...(before ?? {}), ...enrichedPayload };
    txn.set(auditRef, {
      timestamp: FieldValue.serverTimestamp(),
      actor,
      action,
      beforeData: redact(before, redactFields),
      afterData: redact(mergedAfter, redactFields),
    });
    return;
  }

  // delete
  txn.delete(docRef);
  txn.set(auditRef, {
    timestamp: FieldValue.serverTimestamp(),
    actor,
    action,
    beforeData: redact(before, redactFields),
    afterData: null,
  });
}

/**
 * WriteBatch overload — same atomicity contract. Use when the CF prefers
 * `db.batch()` for blind writes without a read-then-write step.
 */
export function writeWithAuditBatch(opts: WriteWithAuditBatchOptions): void {
  const { batch, docRef, op, payload, before, action, actor, redactFields } = opts;
  const auditRef = docRef.collection('audit').doc();

  if (op === 'create') {
    const enrichedPayload = {
      ...(payload ?? {}),
      createdBy: actor,
      updatedBy: actor,
      lastAction: action,
    };
    batch.set(docRef, enrichedPayload);
    batch.set(auditRef, {
      timestamp: FieldValue.serverTimestamp(),
      actor,
      action,
      beforeData: null,
      afterData: redact(enrichedPayload, redactFields),
    });
    return;
  }

  if (op === 'update') {
    const enrichedPayload = {
      ...(payload ?? {}),
      updatedBy: actor,
      lastAction: action,
    };
    batch.update(docRef, enrichedPayload);
    const mergedAfter = { ...(before ?? {}), ...enrichedPayload };
    batch.set(auditRef, {
      timestamp: FieldValue.serverTimestamp(),
      actor,
      action,
      beforeData: redact(before, redactFields),
      afterData: redact(mergedAfter, redactFields),
    });
    return;
  }

  // delete
  batch.delete(docRef);
  batch.set(auditRef, {
    timestamp: FieldValue.serverTimestamp(),
    actor,
    action,
    beforeData: redact(before, redactFields),
    afterData: null,
  });
}
