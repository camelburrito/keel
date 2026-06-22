# Pre-Launch PII Audit Checklist

Run this before flipping a new product surface to public.

## Inventory

- [ ] `docs/architecture/pii-handling.md` exists and enumerates every log surface (Cloud Logging, Sentry, Browser DevTools, Audit Trail) + the scrubbers that run on each.
- [ ] Every PII field in your data model is documented in `data-model.md` with sensitivity classification.

## Code-side defenses

- [ ] `no-console-in-source` ratchet is strict-zero (no carve-outs without `-- <rationale>`).
- [ ] `no-bare-firebase-uid-in-logger` ratchet is wired and passing.
- [ ] ESLint `no-console: error` is configured at the root.
- [ ] All CFs are wrapped by `wrapHandler` (the Proxy unhandled-error catch). Verify via `grep -c wrapHandler functions/src/index.ts` matches total CF count.
- [ ] Logger's 7-layer pipeline includes your product's domain-PII scrubber (calendar fields, contacts, health data, financial data — whatever applies).
- [ ] Sentry `ignoreErrors` array suppresses SDK-internal classes that carry zero PII.

## Operational defenses

- [ ] `scripts/audit-cloud-logging-pii.mjs` runs cleanly against staging (`--project=<APP>-staging --hours=168 --limit=2000`).
- [ ] Same scout runs cleanly against prod once you have prod traffic.
- [ ] Weekly cron or human-driven cadence for re-running the scout (document in `docs/runbooks/observability.md`).
- [ ] Per-env alert email is wired (`scripts/setup-cf-alerts.sh --project=<APP>-{staging,prod}`).
- [ ] On-call has access to the Tier 1/2/3 triage runbook.

## Documented carve-outs

- [ ] Every legitimate place where PII appears unredacted (audit trail D-01, FCM tokens to Google for delivery, OAuth secrets to Google for token exchange) is enumerated in `pii-handling.md § Carve-outs` with rationale.
- [ ] React error-boundary `componentDidCatch` logs are bounded to non-PII fields only.
- [ ] i18n fallback `console.warn` lines (when codegen runs) carry `-- <rationale>` directives.

## Audit trail

- [ ] Every audited mutation goes through `writeWithAudit` / `writeWithAuditBatch`. Defended by `no-audit-bypass-in-functions` ratchet.
- [ ] Audit doc retention policy is documented (how long do you keep `audit/{auditId}` docs?).

## Sign-off

- [ ] Read the latest entry of `pii-handling.md § Surface inventory` end-to-end.
- [ ] Run the scout one last time against staging.
- [ ] Snapshot the pre-launch state for future comparison.

## Related playbook

- [05-observability-pii.md](../docs/playbook/05-observability-pii.md)
