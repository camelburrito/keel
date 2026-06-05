import { describe, it, expect, vi, beforeEach } from 'vitest';

// Silence the underlying firebase-functions logger; spy on the call args.
const fnLogger = {
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
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
