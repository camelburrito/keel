import * as functionsLogger from 'firebase-functions/logger';
import { SyncRedactor } from 'redact-pii';
import { scrubGaxiosError } from '../observability/instrument';
import { getLoggerConfig } from '../config';

const piiRedactor = new SyncRedactor();

// Combined regex for labeled internal IDs, matched generically (no domain nouns):
//   1. camelCase `<word>Id` label: `userId: "abc123"`, `recordId=abc123def`
//   2. JSON-stringified: `"userId":"abc123def"`
//   3. bare 28-char Firebase Auth UIDs (caught by BARE_FIREBASE_UID_RE below)
// Matches any `<word>Id` label (capital `I`, so words like "android"/"valid"
// don't false-match), plus `uid` and the `watchToken`/`fcmToken` Firebase /
// Google-API token labels. Projects with bare-entity-name logging (e.g.
// `Tenant abc123`) extend coverage via a custom firestoreCollectionNames entry
// or a domainScrubber — the framework default stays domain-neutral.
// Captures: 1=label, 2=separator-and-opening-quote, 3=id-value, 4=closing-quote.
// The value is required to contain at least one digit, hyphen, or underscore so
// pure-letter human strings don't false-positive.
const LABELED_ID_RE =
  /\b([A-Za-z]+Id|[Uu]id|watch[Tt]oken|fcm[Tt]oken)([":\s=]+["']?)([A-Za-z0-9_-]{8,128})(["']?)/g;

/**
 * Bare Firebase Auth UID. Firebase UIDs (Google/Apple/anonymous/email-password)
 * are 28-char base62 strings. LABELED_ID_RE catches `uid: "abc..."` label-value
 * pairs; this pattern catches BARE-STRING occurrences in free-text log lines.
 *
 * Width pinned to EXACTLY 28 chars to avoid false-positives on 20-char Firestore
 * auto-IDs, 32-char hex digests, 40-char git SHAs, 24-char base64 chunks.
 * Character class is base62 only.
 *
 * False-positives on 28-char in-repo identifiers (TS type names, exported
 * constants) are handled by the `knownIdentifiers` config allowlist (see
 * configureLogger). Exported for downstream ratchets to import by name.
 */
export const BARE_FIREBASE_UID_RE = /\b[a-zA-Z0-9]{28}\b/g;

// FCM tokens — instance-ID prefix (≥20 chars) + ":APA91" + base64url body
// (≥100 chars). Matches the legacy and V1 FCM token shape.
const FCM_TOKEN_RE = /[A-Za-z0-9_-]{20,}:APA91[A-Za-z0-9_-]{100,}/g;

function buildFirestorePathRegex(collections: string[]): RegExp {
  const escaped = collections.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\/[A-Za-z0-9_-]{1,128}`, 'g');
}

function isInternalIdRedactionBypassed(): boolean {
  if (process.env.LOGGER_REDACT_INTERNAL_IDS_BYPASS !== '1') return false;
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) return false;
  return getLoggerConfig().stagingProjects.has(projectId);
}

function redactInternalIds(input: string): string {
  const { firestoreCollectionNames, knownIdentifiers } = getLoggerConfig();
  const firestorePathRe = buildFirestorePathRegex(firestoreCollectionNames);

  // Order matters: FCM tokens first (long alphanumeric prefix would be
  // half-redacted by LABELED_ID_RE otherwise). Then Firestore paths, then
  // labeled IDs, then bare Firebase UIDs LAST. Bare-UID must be last so it
  // operates on whatever labeled forms LABELED_ID_RE already collapsed.
  return input
    .replace(FCM_TOKEN_RE, '[REDACTED_FCM_TOKEN]')
    .replace(firestorePathRe, (_match, collection: string) => `${collection}/[REDACTED_ID]`)
    .replace(LABELED_ID_RE, (match, label: string, sep: string, value: string, closing: string) => {
      if (!/[\d_-]/.test(value)) return match;
      return `${label}${sep}[REDACTED_ID]${closing}`;
    })
    .replace(BARE_FIREBASE_UID_RE, (match) =>
      knownIdentifiers.has(match) ? match : '[REDACTED_ID]',
    );
}

/**
 * Redacts PII and internal identifiers from any log data before it reaches
 * Cloud Logging. The 7-layer pipeline (in order):
 *   1. scrubGaxiosError — OAuth secrets in error objects → [REDACTED_OAUTH_TOKEN]
 *   2. domainScrubber (configurable) — product-specific PII (calendar, contacts, …)
 *   3. redact-pii SyncRedactor — email, phone, SSN, credit card, IP, names, addresses
 *   4. firestorePathRe — /<collection>/<id>/ paths → /<collection>/[REDACTED_ID]/
 *   5. LABELED_ID_RE — label-value pairs → label: [REDACTED_ID]
 *   6. BARE_FIREBASE_UID_RE — bare 28-char UIDs → [REDACTED_ID]
 *   7. FCM_TOKEN_RE — FCM device tokens → [REDACTED_FCM_TOKEN] (runs FIRST
 *      inside redactInternalIds to avoid being half-eaten by LABELED_ID_RE)
 *
 * The configurable staging-bypass disables layers 4-7 when
 * LOGGER_REDACT_INTERNAL_IDS_BYPASS=1 AND GCLOUD_PROJECT is in
 * config.stagingProjects. Layers 1-3 always run — privacy floor.
 */
export function redact(data: unknown): unknown {
  const { domainScrubber } = getLoggerConfig();
  const bypassInternalIds = isInternalIdRedactionBypassed();

  if (typeof data === 'string') {
    const piiRedacted = piiRedactor.redact(data);
    return bypassInternalIds ? piiRedacted : redactInternalIds(piiRedacted);
  }
  if (data && typeof data === 'object') {
    // Track the deepest-scrubbed form so the catch branch returns a redacted
    // value rather than the unscrubbed `data` on stringify failure.
    let scrubbed: unknown = data;
    try {
      // Layer 1: OAuth-secret scrub. Gaxios errors carry the request body as
      // URLSearchParams; downstream JSON.stringify silently emits "{}", so
      // refresh_token must be redacted AND URLSearchParams must become a
      // plain object BEFORE any other pipeline stage runs.
      const gaxiosScrubbed = scrubGaxiosError(data);
      scrubbed = gaxiosScrubbed;
      // Layer 2: domain-specific scrub. Operates on object structure first so
      // PII subtrees become a sentinel string before the downstream
      // stringify+regex passes.
      const domainScrubbed = domainScrubber(gaxiosScrubbed);
      scrubbed = domainScrubbed;
      const stringified = JSON.stringify(domainScrubbed);
      // Layers 3-7 run on the stringified payload.
      const piiRedacted = piiRedactor.redact(stringified);
      const finalRedacted = bypassInternalIds ? piiRedacted : redactInternalIds(piiRedacted);
      return JSON.parse(finalRedacted);
    } catch {
      return scrubbed;
    }
  }
  return data;
}

/**
 * Structured logger wrapper. Every call runs `redact()` on the message AND
 * every variadic arg before emitting to Cloud Logging.
 */
export const logger = {
  log: (message: string, ...args: unknown[]) => {
    functionsLogger.log(redact(message) as string, ...args.map(redact));
  },
  info: (message: string, ...args: unknown[]) => {
    functionsLogger.info(redact(message) as string, ...args.map(redact));
  },
  warn: (message: string, ...args: unknown[]) => {
    functionsLogger.warn(redact(message) as string, ...args.map(redact));
  },
  error: (message: string, ...args: unknown[]) => {
    functionsLogger.error(redact(message) as string, ...args.map(redact));
  },
  debug: (message: string, ...args: unknown[]) => {
    functionsLogger.debug(redact(message) as string, ...args.map(redact));
  },
};
