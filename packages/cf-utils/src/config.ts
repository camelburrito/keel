// Configurable slots for the cf-utils logger. Each downstream project wires its
// own product-specific values; the framework defaults are safe (empty/no-op).

export interface LoggerConfig {
  /**
   * Recursive walker for domain-specific PII (e.g., calendar fields, contacts,
   * health data). Runs as layer 2 of the redact pipeline, BEFORE the generic
   * email/phone redactor. Receives an unknown input; must return a fresh
   * deep-cloned object with PII subtrees replaced by a sentinel string
   * (recommended: `'<scrubbed:<domain>-pii>'`).
   *
   * Default: identity (no-op). Wire via configureLogger when product PII fields
   * exceed what redact-pii catches generically.
   */
  domainScrubber: (input: unknown) => unknown;

  /**
   * Firestore collection-name patterns to redact in path-shaped log lines.
   * Match shape: `<collection>/<id>` → `<collection>/[REDACTED_ID]`.
   *
   * Default: a safe set covering common Firebase shapes. Extend per project.
   */
  firestoreCollectionNames: string[];

  /**
   * 28-char base62 identifiers that are NOT Firebase Auth UIDs but happen to
   * match the bare-UID regex shape. Each entry must be a real in-repo
   * identifier (e.g., a TS interface name, an exported constant name).
   * Without this allowlist, the bare-UID redactor would redact occurrences of
   * these identifiers in log text. Extending the list is a deliberate trade
   * against a ~0.73% false-negative tail on real Firebase UIDs.
   *
   * Default: empty. Wire via configureLogger when grep across logs shows
   * 28-char identifiers being false-positive redacted.
   */
  knownIdentifiers: Set<string>;

  /**
   * Firebase project IDs that honor the LOGGER_REDACT_INTERNAL_IDS_BYPASS env
   * var for incident-triage observability. Typically `<APP>-staging`. Prod
   * project IDs must NEVER be in this set — fail-closed by design.
   *
   * The bypass only skips layers 4-7 (internal-ID redaction). Layers 1-3
   * (OAuth, domain PII, redact-pii) ALWAYS run regardless — privacy floor
   * that's never lowered.
   *
   * Default: empty (bypass disabled everywhere).
   */
  stagingProjects: Set<string>;
}

const defaultConfig: LoggerConfig = {
  domainScrubber: (input) => input,
  firestoreCollectionNames: [
    'users',
    'audit',
  ],
  knownIdentifiers: new Set<string>(),
  stagingProjects: new Set<string>(),
};

let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Override the logger's runtime configuration. Call at CF cold-start time
 * (e.g., once in `functions/src/index.ts` before any handler runs).
 *
 * Partial overrides are merged — fields not provided keep their default.
 * Re-calling with new values overrides on top of the current state, not the
 * original defaults. Use `resetLoggerConfig()` if you need to undo.
 */
export function configureLogger(overrides: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...overrides };
}

/**
 * Reset logger configuration to framework defaults. Primarily for tests;
 * production code calls `configureLogger` exactly once at cold-start.
 */
export function resetLoggerConfig(): void {
  currentConfig = { ...defaultConfig };
}

/** Read the current configuration. Used internally by logger + instrument. */
export function getLoggerConfig(): LoggerConfig {
  return currentConfig;
}
