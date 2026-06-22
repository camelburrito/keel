// @camelburrito/cf-utils — agnostic Cloud Functions utilities for keel-derived
// projects. See keel playbook 05-observability-pii.md and 09-firebase-stack.md.

// Configuration
export {
  configureLogger,
  resetLoggerConfig,
  getLoggerConfig,
  type LoggerConfig,
} from './config';

// Logger (7-layer redact pipeline)
export { logger, redact, BARE_FIREBASE_UID_RE } from './utils/logger';

// Observability: wrapHandler Proxy + OAuth-secret scrubbing
export {
  wrapHandler,
  scrubGaxiosError,
  OAUTH_SECRET_FIELDS,
} from './observability/instrument';

// Audit-trail: atomic dual-write helpers
export {
  writeWithAudit,
  writeWithAuditBatch,
  type WriteWithAuditOptions,
  type WriteWithAuditBatchOptions,
  type AuditOp,
} from './audit/writeWithAudit';

// Idempotency + rate limit
export { claimIdempotency } from './utils/idempotency';
export { checkRateLimit } from './utils/rateLimit';

// Input validation primitives
export {
  validateString,
  validateEmail,
  validateUrl,
  type ValidateStringOpts,
  type ValidateEmailOpts,
  type ValidateUrlOpts,
} from './utils/validation';
