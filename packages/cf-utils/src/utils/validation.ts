// Centralized CF input validation.
//
// Wire-protocol: error codes follow the hyphen pattern `<field>-<reason>` for
// general failures, with one exception — email format-failure is special-cased
// to `<entity>/invalid-email` (entity = first `/`-segment of field) for legacy
// client-side mapping compatibility.
//
// Error reasons: required | too-long | invalid-format | invalid-protocol.

import { HttpsError } from 'firebase-functions/v2/https';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_URL_MAX_LEN = 2048;  // V4-signed-URL ceiling
const DEFAULT_EMAIL_MAX_LEN = 254; // RFC 5321 ceiling

export interface ValidateStringOpts {
  /** Logical name used in the error code, e.g., 'member/name'. */
  field: string;
  /** Inclusive upper bound on TRIMMED length. */
  maxLen: number;
  /** When true, empty/whitespace-only/undefined throws `<field>-required`. */
  required?: boolean;
}

/**
 * Validate a user-supplied string. Trim-then-check semantics.
 * @returns Trimmed value, or `undefined` when missing AND !required.
 * @throws  HttpsError('invalid-argument', '<field>-required' | '<field>-too-long').
 */
export function validateString(value: unknown, opts: ValidateStringOpts): string | undefined {
  const { field, maxLen, required } = opts;

  if (typeof value !== 'string') {
    if (required) throw new HttpsError('invalid-argument', `${field}-required`);
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    if (required) throw new HttpsError('invalid-argument', `${field}-required`);
    return undefined;
  }

  if (trimmed.length > maxLen) {
    throw new HttpsError('invalid-argument', `${field}-too-long`);
  }

  return trimmed;
}

export interface ValidateEmailOpts {
  field: string;
  /** Default 254 (RFC 5321 ceiling). */
  maxLen?: number;
  required?: boolean;
}

/**
 * Validate a user-supplied email. Trims, lower-cases, then runs EMAIL_RE.
 *
 * Format-failure error code is special-cased to `<entity>/invalid-email`
 * (entity = first `/`-segment of field) for legacy client-side toast mapping
 * compatibility. Other failures follow the standard `<field>-<reason>` pattern.
 *
 * @returns Lower-cased trimmed email, or `undefined` when missing AND !required.
 */
export function validateEmail(value: unknown, opts: ValidateEmailOpts): string | undefined {
  const { field, maxLen = DEFAULT_EMAIL_MAX_LEN, required } = opts;

  if (typeof value !== 'string') {
    if (required) throw new HttpsError('invalid-argument', `${field}-required`);
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    if (required) throw new HttpsError('invalid-argument', `${field}-required`);
    return undefined;
  }

  if (normalized.length > maxLen) {
    throw new HttpsError('invalid-argument', `${field}-too-long`);
  }

  if (!EMAIL_RE.test(normalized)) {
    const entity = field.split('/')[0];
    throw new HttpsError('invalid-argument', `${entity}/invalid-email`);
  }

  return normalized;
}

export interface ValidateUrlOpts {
  field: string;
  /** Default 2048 (V4-signed-URL ceiling). */
  maxLen?: number;
  required?: boolean;
  /** When true (default), accepts ONLY `https://` URLs. */
  requireHttps?: boolean;
}

/**
 * Validate a user-supplied URL. Trims, parses with `new URL()`, and (by
 * default) enforces https-only.
 *
 * @returns Trimmed validated URL, or `undefined` when missing AND !required.
 * @throws  HttpsError('invalid-argument', '<field>-required' | '<field>-too-long' |
 *          '<field>-invalid-format' | '<field>-invalid-protocol').
 */
export function validateUrl(value: unknown, opts: ValidateUrlOpts): string | undefined {
  const { field, maxLen = DEFAULT_URL_MAX_LEN, required, requireHttps = true } = opts;

  if (typeof value !== 'string') {
    if (required) throw new HttpsError('invalid-argument', `${field}-required`);
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    if (required) throw new HttpsError('invalid-argument', `${field}-required`);
    return undefined;
  }

  if (trimmed.length > maxLen) {
    throw new HttpsError('invalid-argument', `${field}-too-long`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpsError('invalid-argument', `${field}-invalid-format`);
  }

  if (requireHttps && parsed.protocol !== 'https:') {
    throw new HttpsError('invalid-argument', `${field}-invalid-protocol`);
  }

  return trimmed;
}
