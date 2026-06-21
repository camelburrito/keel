import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted to top of file before any const definitions run, so the
// factory body has to be self-contained. Use vi.hoisted to share the mock
// object between the factory and the test assertions below.
const fnLogger = vi.hoisted(() => ({
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('firebase-functions/logger', () => fnLogger);

import { logger, redact, BARE_FIREBASE_UID_RE } from './logger';
import { configureLogger, resetLoggerConfig } from '../config';

beforeEach(() => {
  vi.clearAllMocks();
  resetLoggerConfig();
});

describe('BARE_FIREBASE_UID_RE', () => {
  it('matches a 28-char base62 string', () => {
    expect('abc123def456ghi789jkl012mno3'.match(BARE_FIREBASE_UID_RE)).not.toBeNull();
  });

  it('does not match 20-char Firestore auto-IDs', () => {
    expect('abc123def456ghi789jk'.match(BARE_FIREBASE_UID_RE)).toBeNull();
  });

  it('does not match 40-char git SHAs', () => {
    expect('1234567890abcdef1234567890abcdef12345678'.match(BARE_FIREBASE_UID_RE)).toBeNull();
  });

  it('does not match 32-char hex digests', () => {
    expect('1234567890abcdef1234567890abcdef'.match(BARE_FIREBASE_UID_RE)).toBeNull();
  });
});

describe('redact — internal-ID layer', () => {
  it('redacts labeled IDs', () => {
    const redacted = redact('user uid: "abc12345defXYZ_long"') as string;
    expect(redacted).toContain('[REDACTED_ID]');
    expect(redacted).not.toContain('abc12345defXYZ_long');
  });

  it('redacts Firestore paths for default collection list', () => {
    const redacted = redact('not found: /users/abc12345defXYZ/profile') as string;
    expect(redacted).toContain('users/[REDACTED_ID]');
  });

  it('redacts FCM tokens', () => {
    const fcmToken = 'aaaaaaaaaaaaaaaaaaaa:APA91' + 'b'.repeat(110);
    const redacted = redact(`token=${fcmToken}`) as string;
    expect(redacted).toContain('[REDACTED_FCM_TOKEN]');
    expect(redacted).not.toContain(fcmToken);
  });

  it('redacts bare 28-char Firebase UIDs', () => {
    // 28-char base62 with a digit (regex matches but layer also requires digit/_/-)
    const uid = 'AbCdEfGhIjKlMnOpQrStUvWxYz12';
    const redacted = redact(`user ${uid} did X`) as string;
    expect(redacted).toContain('[REDACTED_ID]');
    expect(redacted).not.toContain(uid);
  });

  it('respects knownIdentifiers allowlist', () => {
    const identifier = 'KnownIdentifierTwentyEight00'; // 28 chars
    configureLogger({ knownIdentifiers: new Set([identifier]) });
    const redacted = redact(`schema ${identifier} loaded`) as string;
    expect(redacted).toContain(identifier);
  });
});

describe('redact — staging bypass', () => {
  it('skips internal-ID layers when env + project match allowlist', () => {
    configureLogger({ stagingProjects: new Set(['my-app-staging']) });
    process.env.LOGGER_REDACT_INTERNAL_IDS_BYPASS = '1';
    process.env.GCLOUD_PROJECT = 'my-app-staging';
    try {
      const result = redact('user uid: "abc12345defXYZ_long"') as string;
      // Internal-ID layer skipped; redact-pii still runs (no PII here so passes
      // through unchanged).
      expect(result).toContain('abc12345defXYZ_long');
    } finally {
      delete process.env.LOGGER_REDACT_INTERNAL_IDS_BYPASS;
      delete process.env.GCLOUD_PROJECT;
    }
  });

  it('fails closed: bypass ignored when project NOT in allowlist', () => {
    configureLogger({ stagingProjects: new Set(['my-app-staging']) });
    process.env.LOGGER_REDACT_INTERNAL_IDS_BYPASS = '1';
    process.env.GCLOUD_PROJECT = 'my-app-prod'; // not on allowlist
    try {
      const result = redact('user uid: "abc12345defXYZ_long"') as string;
      expect(result).toContain('[REDACTED_ID]');
    } finally {
      delete process.env.LOGGER_REDACT_INTERNAL_IDS_BYPASS;
      delete process.env.GCLOUD_PROJECT;
    }
  });
});

describe('redact — domain scrubber slot', () => {
  it('runs the configured domain scrubber on objects', () => {
    configureLogger({
      domainScrubber: (input) => {
        if (input && typeof input === 'object' && !Array.isArray(input)) {
          const result: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(input)) {
            result[k] = k === 'secretField' ? '<scrubbed:test-pii>' : v;
          }
          return result;
        }
        return input;
      },
    });
    const result = redact({ secretField: 'leak', other: 'ok' });
    expect(result).toEqual({ secretField: '<scrubbed:test-pii>', other: 'ok' });
  });
});

describe('logger interface', () => {
  it('routes log/info/warn/error/debug through firebase-functions/logger', () => {
    logger.log('msg-log');
    logger.info('msg-info');
    logger.warn('msg-warn');
    logger.error('msg-error');
    logger.debug('msg-debug');

    expect(fnLogger.log).toHaveBeenCalled();
    expect(fnLogger.info).toHaveBeenCalled();
    expect(fnLogger.warn).toHaveBeenCalled();
    expect(fnLogger.error).toHaveBeenCalled();
    expect(fnLogger.debug).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.3 expansion — redact pipeline depth + edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('BARE_FIREBASE_UID_RE — boundary cases', () => {
  it('rejects 27-char strings (under-length)', () => {
    expect('abc123def456ghi789jkl012mn0'.match(BARE_FIREBASE_UID_RE)).toBeNull();
  });

  it('rejects 29-char strings (over-length)', () => {
    expect('abc123def456ghi789jkl012mn03X'.match(BARE_FIREBASE_UID_RE)).toBeNull();
  });

  it('matches mixed-case 28-char base62 (Google OAuth uid shape)', () => {
    expect('GTAt9hZxKbWqPmRsLvJyCxFwNbVe'.match(BARE_FIREBASE_UID_RE)).not.toBeNull();
  });

  it('rejects strings containing hyphen / underscore', () => {
    // Word-boundary `\b` already excludes these, but verify explicitly.
    expect('abc123def-ghi789jkl012mno3'.match(BARE_FIREBASE_UID_RE)).toBeNull();
    expect('abc123def_ghi789jkl012mno3'.match(BARE_FIREBASE_UID_RE)).toBeNull();
  });
});

describe('redact — Firestore-path coverage across default collections', () => {
  it('redacts /users/{uid}', () => {
    const result = redact('/users/abc12345defXYZ/profile') as string;
    expect(result).toContain('users/[REDACTED_ID]');
  });

  it('does not redact collections outside the default list', () => {
    const result = redact('/tenants/t-12345abcDEF') as string;
    expect(result).toContain('tenants/t-12345abcDEF');
  });

  it('redacts /audit/{a}', () => {
    const result = redact('/audit/a-12345abcDEF') as string;
    expect(result).toContain('audit/[REDACTED_ID]');
  });

  it('honors configureLogger.firestoreCollectionNames extension', () => {
    configureLogger({ firestoreCollectionNames: ['users', 'audit', 'items'] });
    const result = redact('/items/c-12345abcDEF') as string;
    expect(result).toContain('items/[REDACTED_ID]');
  });
});

describe('redact — labeled-ID coverage across documented labels', () => {
  it('redacts recordId', () => {
    const result = redact('recordId: "abc12345defXYZ_lng"') as string;
    expect(result).toContain('recordId');
    expect(result).toContain('[REDACTED_ID]');
    expect(result).not.toContain('abc12345defXYZ_lng');
  });

  it('redacts sessionId', () => {
    const result = redact('sessionId="abc12345defXYZ_lng"') as string;
    expect(result).toContain('[REDACTED_ID]');
  });

  it('redacts watchToken', () => {
    const result = redact('watchToken: "abc12345defXYZ_lng"') as string;
    expect(result).toContain('[REDACTED_ID]');
  });

  it('redacts fixed token labels case-insensitively (UID / WatchToken / FCMToken)', () => {
    expect(redact('UID: "abc12345defXYZ_lng"') as string).toContain('[REDACTED_ID]');
    expect(redact('WatchToken="abc12345defXYZ_lng"') as string).toContain('[REDACTED_ID]');
    expect(redact('FCMToken: "abc12345defXYZ_lng"') as string).toContain('[REDACTED_ID]');
  });

  it('does NOT redact English words ending in lowercase "id" (camelCase Id clause is case-sensitive)', () => {
    // 'android'/'valid' must pass through — the <word>Id clause requires a literal
    // capital I, so these are not mistaken for ID labels.
    expect(redact('android: 12345678ab') as string).toContain('12345678ab');
    expect(redact('valid=98765432cd') as string).toContain('98765432cd');
  });

  it('redacts pure-letter values are NOT touched (requires digit/_/-)', () => {
    // 'AbcDefGhIjKlMnOpQrStUvWx' is 24-char pure letters — no digit/_/-, so
    // LABELED_ID_RE's guard skips it. Verifies the guard is wired.
    const result = redact('userId: "AbcDefGhIjKlMnOpQrStUvWx"') as string;
    expect(result).toContain('AbcDefGhIjKlMnOpQrStUvWx');
  });
});

describe('redact — object input', () => {
  it('redacts bare 28-char UIDs inside object string values', () => {
    // For object inputs, JSON.stringify escapes quotes, which breaks
    // LABELED_ID_RE's pattern matching. The BARE_FIREBASE_UID_RE (28-char
    // alphanum boundary) is the layer that survives the escape — verify it
    // catches a clean 28-char UID embedded in an object property.
    const uid = 'AbCdEfGhIjKlMnOpQrStUvWxYz12'; // 28 chars
    const result = redact({
      message: `user ${uid} did X`,
      other: 'ok',
    }) as Record<string, unknown>;
    expect(JSON.stringify(result)).toContain('[REDACTED_ID]');
    expect(JSON.stringify(result)).not.toContain(uid);
  });

  it('handles arrays containing 28-char UIDs', () => {
    const uid = 'AbCdEfGhIjKlMnOpQrStUvWxYz12';
    const result = redact([
      `event by ${uid}`,
      'ok',
    ]) as string[];
    expect(JSON.stringify(result)).toContain('[REDACTED_ID]');
    expect(JSON.stringify(result)).not.toContain(uid);
  });

  it('passes primitives through unchanged', () => {
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBe(null);
  });
});

describe('redact — OAuth scrub layer (instrument integration)', () => {
  it('scrubs refresh_token inside log-object args', () => {
    const result = redact({ refresh_token: 'SECRET_VALUE', other: 'ok' }) as Record<string, unknown>;
    expect(JSON.stringify(result)).toContain('[REDACTED_OAUTH_TOKEN]');
    expect(JSON.stringify(result)).not.toContain('SECRET_VALUE');
  });

  it('scrubs access_token inside nested config.data', () => {
    const result = redact({
      config: { data: { access_token: 'AT_SECRET' } },
    }) as Record<string, unknown>;
    expect(JSON.stringify(result)).toContain('[REDACTED_OAUTH_TOKEN]');
    expect(JSON.stringify(result)).not.toContain('AT_SECRET');
  });
});

describe('logger.error with err object', () => {
  it('routes error object through redact pipeline', () => {
    logger.error('something failed', {
      uid: 'AbCdEfGhIjKlMnOpQrStUvWxYz12',
      refresh_token: 'OAUTH_SECRET',
    });
    expect(fnLogger.error).toHaveBeenCalled();
    const args = fnLogger.error.mock.calls[0];
    const stringified = JSON.stringify(args);
    expect(stringified).toContain('[REDACTED_OAUTH_TOKEN]');
    expect(stringified).not.toContain('OAUTH_SECRET');
  });
});
