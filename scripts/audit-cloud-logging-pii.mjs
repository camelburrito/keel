#!/usr/bin/env node
// scripts/audit-cloud-logging-pii.mjs — read-only operator scout for PII drift.
// Samples Cloud Logging entries via `gcloud logging read` and grep-checks for
// 7 PII pattern classes. Exit 0 if clean, 1 if matches.
// See keel playbook 05-observability-pii.md § "Operational tools".
//
// Usage:
//   node scripts/audit-cloud-logging-pii.mjs --project=<APP>-staging
//   node scripts/audit-cloud-logging-pii.mjs --project=<APP>-prod --hours=24 --limit=2000
//
// Prerequisites:
//   - gcloud CLI authenticated against the project
//   - `roles/logging.viewer` on the project
//
// STATUS: skeleton. Wire actual gcloud invocation + pattern checks.

import { execSync } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);

const PROJECT = args.project ?? null;
const HOURS = Number(args.hours ?? 168); // default 7 days
const LIMIT = Number(args.limit ?? 1000);

if (!PROJECT) {
  // eslint-disable-next-line no-console -- operator-facing usage error
  console.error('Missing --project=<gcp-project-id>');
  process.exit(2);
}

// PII pattern classes (regex; tune per product).
const PII_PATTERNS = [
  { name: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { name: 'phone-E.164', re: /\+\d{7,15}\b/g },
  { name: 'firebase-uid-28', re: /\b[a-zA-Z0-9]{28}\b/g },
  { name: 'firestore-path-with-id', re: /\/(?:users|households|members)\/[a-zA-Z0-9]{20,28}/g },
  { name: 'fcm-token', re: /[a-zA-Z0-9_-]{140,}:APA91[a-zA-Z0-9_-]+/g },
  { name: 'oauth-refresh-token', re: /\b1\/\/[\w-]{50,}\b/g },
  // TODO: add domain-specific patterns (calendar v3 PII keys, contacts PII keys, etc.)
];

// Sentinels we deliberately log redacted; allowlist to suppress false positives.
const REDACTION_SENTINELS = [
  '[REDACTED]',
  '[REDACTED_ID]',
  '[REDACTED_FCM_TOKEN]',
  '[REDACTED_OAUTH_TOKEN]',
];

// TODO: implement
//   const raw = execSync(`gcloud logging read ... --project=${PROJECT} --limit=${LIMIT} ...`);
//   const entries = JSON.parse(raw);
//   for each entry, scan its text fields with PII_PATTERNS, skipping matches inside REDACTION_SENTINELS.
//   if any match, print + exit 1.

// eslint-disable-next-line no-console -- operator-facing skeleton status
console.log(`[pii-audit] project=${PROJECT} hours=${HOURS} limit=${LIMIT}`);
// eslint-disable-next-line no-console -- operator-facing skeleton status
console.log(`[pii-audit] TODO: implement gcloud logging read + pattern scan`);
process.exit(0);
