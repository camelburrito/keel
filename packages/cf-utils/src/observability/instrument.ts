import { HttpsError } from 'firebase-functions/v2/https';
// Top-level import is safe despite the instrument.ts ↔ logger.ts cycle:
// `logger` is only DEREFERENCED inside the Proxy `apply` trap (when a CF
// throws or returns), which can't fire until BOTH modules have finished loading.
import { logger } from '../utils/logger';

/**
 * OAuth secret-bearing field names that gaxios may carry in `error.config.data`,
 * `error.config.body`, `error.config.params`, `error.response.config.data`, or
 * `error.response.data` on a token-refresh/exchange failure. Gaxios's own
 * `beforeError` hook scrubs only `client_secret`; this set extends that floor
 * to the other three OAuth secret fields.
 *
 * **`code` deliberately excluded:** the OAuth authorization-code grant uses
 * `code` as a short-lived (~10min) one-shot secret, but the same field name is
 * dominantly used in error objects to mean HTTP status (`error.code = 401`,
 * gaxios convention) and JS Error.code (`'ERR_BAD_REQUEST'`). Blanket-redacting
 * `code` would erase observability for actual prod errors. If your product's
 * OAuth-code grant path leaks too, add a context-aware redactor that only
 * scrubs `code` inside `config.data`/`config.body`.
 */
export const OAUTH_SECRET_FIELDS: ReadonlySet<string> = new Set([
  'refresh_token',
  'access_token',
  'id_token',
  'client_secret',
]);

const OAUTH_REDACTED = '[REDACTED_OAUTH_TOKEN]';

/**
 * Recursively walks `input` and replaces any value whose key is in
 * {@link OAUTH_SECRET_FIELDS} with `'[REDACTED_OAUTH_TOKEN]'`. Handles
 * `URLSearchParams` specially by converting it to a plain object via
 * `Object.fromEntries(value.entries())` — downstream `JSON.stringify` silently
 * emits `"{}"` for a URLSearchParams instance.
 *
 * Cyclic-ref safe (WeakSet short-circuit). Input is NOT mutated; a fresh
 * deep-cloned object is returned. Non-object inputs pass through unchanged.
 */
export function scrubGaxiosError(input: unknown): unknown {
  const seen = new WeakSet<object>();
  return scrub(input, seen);
}

function scrub(value: unknown, seen: WeakSet<object>): unknown {
  if (value == null) return value;
  if (typeof value !== 'object') return value;

  // URLSearchParams: convert to plain object first (otherwise JSON.stringify
  // emits "{}" silently). Redact OAuth keys in the converted object.
  if (value instanceof URLSearchParams) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      out[k] = OAUTH_SECRET_FIELDS.has(k) ? OAUTH_REDACTED : v;
    }
    return out;
  }

  // Cyclic-ref short-circuit. Return a sentinel rather than the original
  // reference (returning the reference would re-attach an unscrubbed subtree
  // that may contain secrets further down).
  if (seen.has(value as object)) return '<cyclic>';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (OAUTH_SECRET_FIELDS.has(k)) {
      out[k] = OAUTH_REDACTED;
    } else {
      out[k] = scrub(v, seen);
    }
  }
  return out;
}

/**
 * Wraps every onCall / trigger / scheduled handler. The wrapper is a Proxy
 * whose `apply` trap routes any thrown error through `logger.error(...)` (so
 * the full redact pipeline runs before the line lands in Cloud Logging) and
 * then rethrows:
 *
 *   - HttpsError instances are rethrown unchanged (preserves the existing
 *     client error-code routing).
 *   - Anything else is rewrapped as `HttpsError('internal', 'internal')`.
 *
 * Also emits a `logger.info('callable-invocation', { uid })` breadcrumb
 * BEFORE the handler runs. The breadcrumb passes through the redact pipeline
 * (BARE_FIREBASE_UID_RE catches the uid), giving you a redacted-but-queryable
 * hit for every invocation in Cloud Logging — important because the runtime
 * also auto-attaches `jsonPayload.uid` to platform-emitted log lines and you
 * can't intercept those.
 *
 * The Proxy's `get` trap forwards `.__trigger`, `.run`, and every other
 * property read so the Firebase Functions runtime still recognizes the wrapped
 * value as a CallableFunction.
 *
 * Defensive: if the input is not a function-typed value, returns it unchanged.
 */
export const wrapHandler = <T>(handler: T): T => {
  if (typeof handler !== 'function') return handler;

  const proxy = new Proxy(handler as unknown as object, {
    apply(target, thisArg, args) {
      // Breadcrumb: fire BEFORE the handler so even handlers that crash
      // immediately still get the redacted observability trace.
      // SAFETY: wrapped in try/catch — breadcrumb emission must NEVER block
      // handler invocation (malformed `request` shape, test harnesses, etc.).
      try {
        const req = args[0] as { auth?: { uid?: string } } | undefined;
        const uid = req?.auth?.uid;
        if (uid) {
          logger.info('callable-invocation', { uid });
        }
      } catch {
        // intentionally swallowed
      }

      try {
        const result = Reflect.apply(target as (...a: unknown[]) => unknown, thisArg, args);
        if (result && typeof (result as { then?: unknown }).then === 'function') {
          // Thenable-returning handler: surface async rejections through the
          // same scrub + rethrow path. Promise.resolve normalizes raw thenables
          // (which may only implement `.then`) into a native Promise.
          return Promise.resolve(result as PromiseLike<unknown>).catch((err: unknown) => {
            logger.error('Unhandled CF error', err);
            if (err instanceof HttpsError) throw err;
            throw new HttpsError('internal', 'internal');
          });
        }
        return result;
      } catch (err) {
        logger.error('Unhandled CF error', err);
        if (err instanceof HttpsError) throw err;
        throw new HttpsError('internal', 'internal');
      }
    },
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
  });
  return proxy as unknown as T;
};
