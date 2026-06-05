// writeWithAudit / writeWithAuditBatch contract tests.
//
// These don't need a live Firestore — the helpers take a caller-supplied
// `Transaction` / `WriteBatch` and `DocumentReference`. We construct fakes
// that record calls and assert the dual-write shape (parent + audit
// subcollection) lands atomically with correct enrichment + redaction.

import { describe, expect, it, vi } from 'vitest';
import { writeWithAudit, writeWithAuditBatch, type AuditOp } from './writeWithAudit';

// ─────────────────────────────────────────────────────────────────────────────
// Fakes
// ─────────────────────────────────────────────────────────────────────────────

interface RecordedCall {
  kind: 'set' | 'update' | 'delete';
  ref: { path: string };
  data?: Record<string, unknown>;
}

function makeRef(path: string, calls: RecordedCall[]): any {
  // Each `.collection('audit').doc()` mints a new auto-id ref. We mint
  // deterministic IDs so assertions can target the audit doc by path.
  let auditCounter = 0;
  return {
    path,
    collection: (sub: string) => ({
      doc: (id?: string) => {
        auditCounter += 1;
        const childId = id ?? `auto-${auditCounter}`;
        return makeRef(`${path}/${sub}/${childId}`, calls);
      },
    }),
  };
}

function makeTxn(calls: RecordedCall[]): any {
  return {
    set: (ref: any, data: Record<string, unknown>) => {
      calls.push({ kind: 'set', ref: { path: ref.path }, data });
    },
    update: (ref: any, data: Record<string, unknown>) => {
      calls.push({ kind: 'update', ref: { path: ref.path }, data });
    },
    delete: (ref: any) => {
      calls.push({ kind: 'delete', ref: { path: ref.path } });
    },
  };
}

function makeBatch(calls: RecordedCall[]): any {
  // Same shape — only the calling helper differs.
  return makeTxn(calls);
}

// Stub firebase-admin/firestore so FieldValue.serverTimestamp() doesn't require
// app init. Returns a sentinel the tests can pattern-match.
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '<server-timestamp>',
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Tests — writeWithAudit (Transaction overload)
// ─────────────────────────────────────────────────────────────────────────────

describe('writeWithAudit (Transaction)', () => {
  function setup(op: AuditOp) {
    const calls: RecordedCall[] = [];
    const txn = makeTxn(calls);
    const docRef = makeRef('households/h1/chores/c1', calls);
    return { calls, txn, docRef, op };
  }

  describe('create', () => {
    it('writes parent + audit atomically (2 set calls in same txn)', () => {
      const { calls, txn, docRef } = setup('create');
      writeWithAudit({
        txn,
        docRef,
        op: 'create',
        payload: { title: 'Take out trash' },
        before: null,
        action: 'CHORE_CREATED',
        actor: 'uid-alice',
      });
      expect(calls).toHaveLength(2);
      expect(calls[0]!.kind).toBe('set');
      expect(calls[0]!.ref.path).toBe('households/h1/chores/c1');
      expect(calls[1]!.kind).toBe('set');
      expect(calls[1]!.ref.path).toMatch(/^households\/h1\/chores\/c1\/audit\/auto-/);
    });

    it('enriches parent with createdBy/updatedBy/lastAction', () => {
      const { calls, txn, docRef } = setup('create');
      writeWithAudit({
        txn,
        docRef,
        op: 'create',
        payload: { title: 'X' },
        before: null,
        action: 'CHORE_CREATED',
        actor: 'uid-alice',
      });
      expect(calls[0]!.data).toMatchObject({
        title: 'X',
        createdBy: 'uid-alice',
        updatedBy: 'uid-alice',
        lastAction: 'CHORE_CREATED',
      });
    });

    it('audit beforeData=null, afterData=enriched payload', () => {
      const { calls, txn, docRef } = setup('create');
      writeWithAudit({
        txn,
        docRef,
        op: 'create',
        payload: { title: 'X' },
        before: null,
        action: 'CHORE_CREATED',
        actor: 'uid-alice',
      });
      expect(calls[1]!.data).toMatchObject({
        actor: 'uid-alice',
        action: 'CHORE_CREATED',
        beforeData: null,
        afterData: {
          title: 'X',
          createdBy: 'uid-alice',
          updatedBy: 'uid-alice',
          lastAction: 'CHORE_CREATED',
        },
        timestamp: '<server-timestamp>',
      });
    });

    it('handles missing payload (treated as empty object)', () => {
      const { calls, txn, docRef } = setup('create');
      writeWithAudit({
        txn,
        docRef,
        op: 'create',
        before: null,
        action: 'CHORE_CREATED',
        actor: 'uid-alice',
      });
      expect(calls[0]!.data).toEqual({
        createdBy: 'uid-alice',
        updatedBy: 'uid-alice',
        lastAction: 'CHORE_CREATED',
      });
    });
  });

  describe('update', () => {
    it('writes parent (update) + audit (set) atomically', () => {
      const { calls, txn, docRef } = setup('update');
      writeWithAudit({
        txn,
        docRef,
        op: 'update',
        payload: { status: 'done' },
        before: { title: 'X', status: 'todo' },
        action: 'CHORE_MARKED_DONE',
        actor: 'uid-alice',
      });
      expect(calls).toHaveLength(2);
      expect(calls[0]!.kind).toBe('update');
      expect(calls[0]!.ref.path).toBe('households/h1/chores/c1');
      expect(calls[1]!.kind).toBe('set');
    });

    it('enriches parent with updatedBy + lastAction (NOT createdBy)', () => {
      const { calls, txn, docRef } = setup('update');
      writeWithAudit({
        txn,
        docRef,
        op: 'update',
        payload: { status: 'done' },
        before: { title: 'X', status: 'todo' },
        action: 'CHORE_MARKED_DONE',
        actor: 'uid-alice',
      });
      expect(calls[0]!.data).toMatchObject({
        status: 'done',
        updatedBy: 'uid-alice',
        lastAction: 'CHORE_MARKED_DONE',
      });
      expect(calls[0]!.data).not.toHaveProperty('createdBy');
    });

    it('audit beforeData=before, afterData=merged(before + enriched payload)', () => {
      const { calls, txn, docRef } = setup('update');
      writeWithAudit({
        txn,
        docRef,
        op: 'update',
        payload: { status: 'done' },
        before: { title: 'X', status: 'todo', createdBy: 'uid-bob' },
        action: 'CHORE_MARKED_DONE',
        actor: 'uid-alice',
      });
      expect(calls[1]!.data).toMatchObject({
        beforeData: { title: 'X', status: 'todo', createdBy: 'uid-bob' },
        afterData: {
          title: 'X',
          status: 'done',
          createdBy: 'uid-bob',
          updatedBy: 'uid-alice',
          lastAction: 'CHORE_MARKED_DONE',
        },
      });
    });

    it('handles before=null gracefully (mergedAfter == enriched payload)', () => {
      const { calls, txn, docRef } = setup('update');
      writeWithAudit({
        txn,
        docRef,
        op: 'update',
        payload: { status: 'done' },
        before: null,
        action: 'CHORE_MARKED_DONE',
        actor: 'uid-alice',
      });
      expect(calls[1]!.data).toMatchObject({
        beforeData: null,
        afterData: { status: 'done', updatedBy: 'uid-alice', lastAction: 'CHORE_MARKED_DONE' },
      });
    });
  });

  describe('delete', () => {
    it('writes parent (delete) + audit (set) atomically', () => {
      const { calls, txn, docRef } = setup('delete');
      writeWithAudit({
        txn,
        docRef,
        op: 'delete',
        before: { title: 'X', status: 'done' },
        action: 'CHORE_DELETED',
        actor: 'uid-alice',
      });
      expect(calls).toHaveLength(2);
      expect(calls[0]!.kind).toBe('delete');
      expect(calls[0]!.ref.path).toBe('households/h1/chores/c1');
      expect(calls[1]!.kind).toBe('set');
    });

    it('audit beforeData=before, afterData=null', () => {
      const { calls, txn, docRef } = setup('delete');
      writeWithAudit({
        txn,
        docRef,
        op: 'delete',
        before: { title: 'X', status: 'done' },
        action: 'CHORE_DELETED',
        actor: 'uid-alice',
      });
      expect(calls[1]!.data).toMatchObject({
        actor: 'uid-alice',
        action: 'CHORE_DELETED',
        beforeData: { title: 'X', status: 'done' },
        afterData: null,
        timestamp: '<server-timestamp>',
      });
    });

    it('payload arg is ignored on delete', () => {
      const { calls, txn, docRef } = setup('delete');
      writeWithAudit({
        txn,
        docRef,
        op: 'delete',
        payload: { ignored: 'value' },
        before: { title: 'X' },
        action: 'CHORE_DELETED',
        actor: 'uid-alice',
      });
      // No write of payload on delete; only the delete call lands on parent.
      expect(calls[0]!.kind).toBe('delete');
      expect(calls[0]!).not.toHaveProperty('data');
    });
  });

  describe('redactFields', () => {
    it('redacts listed fields in audit beforeData + afterData ONLY', () => {
      const { calls, txn, docRef } = setup('update');
      writeWithAudit({
        txn,
        docRef,
        op: 'update',
        payload: { refresh_token: 'NEW_SECRET', scope: 'tasks' },
        before: { refresh_token: 'OLD_SECRET', scope: 'calendar' },
        action: 'CALENDAR_REFRESH',
        actor: 'uid-alice',
        redactFields: ['refresh_token'],
      });
      // Parent doc keeps the real value (it's needed for API calls).
      expect(calls[0]!.data).toMatchObject({
        refresh_token: 'NEW_SECRET',
        scope: 'tasks',
      });
      // Audit redacts both before + after.
      expect(calls[1]!.data).toMatchObject({
        beforeData: { refresh_token: '<redacted>', scope: 'calendar' },
        afterData: expect.objectContaining({
          refresh_token: '<redacted>',
          scope: 'tasks',
        }),
      });
    });

    it('redacts on create (beforeData stays null, afterData is redacted)', () => {
      const { calls, txn, docRef } = setup('create');
      writeWithAudit({
        txn,
        docRef,
        op: 'create',
        payload: { refresh_token: 'SECRET' },
        before: null,
        action: 'CALENDAR_CONNECT',
        actor: 'uid-alice',
        redactFields: ['refresh_token'],
      });
      expect(calls[1]!.data).toMatchObject({
        beforeData: null,
        afterData: expect.objectContaining({ refresh_token: '<redacted>' }),
      });
      // Parent unchanged.
      expect(calls[0]!.data).toMatchObject({ refresh_token: 'SECRET' });
    });

    it('redacts on delete (beforeData is redacted, afterData stays null)', () => {
      const { calls, txn, docRef } = setup('delete');
      writeWithAudit({
        txn,
        docRef,
        op: 'delete',
        before: { refresh_token: 'SECRET' },
        action: 'CALENDAR_REVOKE',
        actor: 'uid-alice',
        redactFields: ['refresh_token'],
      });
      expect(calls[1]!.data).toMatchObject({
        beforeData: { refresh_token: '<redacted>' },
        afterData: null,
      });
    });

    it('undefined redactFields = no redaction', () => {
      const { calls, txn, docRef } = setup('update');
      writeWithAudit({
        txn,
        docRef,
        op: 'update',
        payload: { refresh_token: 'NEW' },
        before: { refresh_token: 'OLD' },
        action: 'X',
        actor: 'uid-alice',
      });
      expect(calls[1]!.data).toMatchObject({
        beforeData: { refresh_token: 'OLD' },
        afterData: expect.objectContaining({ refresh_token: 'NEW' }),
      });
    });

    it('field absent from before/after does not error', () => {
      const { calls, txn, docRef } = setup('update');
      writeWithAudit({
        txn,
        docRef,
        op: 'update',
        payload: { status: 'done' },
        before: { title: 'X' },
        action: 'X',
        actor: 'uid-alice',
        redactFields: ['refresh_token'], // not present in either
      });
      expect(calls[1]!.data).toMatchObject({
        beforeData: { title: 'X' },
        afterData: expect.objectContaining({ title: 'X', status: 'done' }),
      });
    });
  });

  it('audit doc path is parent/audit/<auto>', () => {
    const { calls, txn, docRef } = setup('create');
    writeWithAudit({
      txn,
      docRef,
      op: 'create',
      payload: { x: 1 },
      before: null,
      action: 'X',
      actor: 'uid-a',
    });
    expect(calls[1]!.ref.path).toMatch(/^households\/h1\/chores\/c1\/audit\//);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests — writeWithAuditBatch (WriteBatch overload)
// ─────────────────────────────────────────────────────────────────────────────

describe('writeWithAuditBatch (WriteBatch parity)', () => {
  it('create: parent (set) + audit (set) parity with Transaction overload', () => {
    const calls: RecordedCall[] = [];
    const batch = makeBatch(calls);
    const docRef = makeRef('households/h1/chores/c1', calls);
    writeWithAuditBatch({
      batch,
      docRef,
      op: 'create',
      payload: { title: 'X' },
      before: null,
      action: 'CHORE_CREATED',
      actor: 'uid-a',
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.kind).toBe('set');
    expect(calls[0]!.data).toMatchObject({ title: 'X', createdBy: 'uid-a' });
    expect(calls[1]!.kind).toBe('set');
    expect(calls[1]!.data).toMatchObject({ beforeData: null, afterData: expect.objectContaining({ title: 'X' }) });
  });

  it('update: parent (update) + audit (set) parity', () => {
    const calls: RecordedCall[] = [];
    const batch = makeBatch(calls);
    const docRef = makeRef('households/h1/chores/c1', calls);
    writeWithAuditBatch({
      batch,
      docRef,
      op: 'update',
      payload: { status: 'done' },
      before: { status: 'todo' },
      action: 'X',
      actor: 'uid-a',
    });
    expect(calls[0]!.kind).toBe('update');
    expect(calls[1]!.kind).toBe('set');
  });

  it('delete: parent (delete) + audit (set) parity', () => {
    const calls: RecordedCall[] = [];
    const batch = makeBatch(calls);
    const docRef = makeRef('households/h1/chores/c1', calls);
    writeWithAuditBatch({
      batch,
      docRef,
      op: 'delete',
      before: { x: 1 },
      action: 'X',
      actor: 'uid-a',
    });
    expect(calls[0]!.kind).toBe('delete');
    expect(calls[1]!.data).toMatchObject({ beforeData: { x: 1 }, afterData: null });
  });

  it('redactFields apply on batch overload too', () => {
    const calls: RecordedCall[] = [];
    const batch = makeBatch(calls);
    const docRef = makeRef('households/h1/private/calendarAuth', calls);
    writeWithAuditBatch({
      batch,
      docRef,
      op: 'create',
      payload: { refresh_token: 'SECRET' },
      before: null,
      action: 'CALENDAR_CONNECT',
      actor: 'uid-a',
      redactFields: ['refresh_token'],
    });
    expect(calls[0]!.data).toMatchObject({ refresh_token: 'SECRET' });
    expect(calls[1]!.data).toMatchObject({
      afterData: expect.objectContaining({ refresh_token: '<redacted>' }),
    });
  });
});
