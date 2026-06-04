import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CRITICAL: console.* bypasses Sentry's beforeSend redact pipeline on web
      // and the @camelburrito/cf-utils logger redact pipeline on the CF side.
      // Defense in depth: this lint rule + the no-console-in-source ratchet
      // (which catches `git commit --no-verify` bypasses at pre-push/CI time).
      // To allow a specific call site, add:
      //   // eslint-disable-next-line no-console -- <rationale>
      // The `-- <rationale>` segment is REQUIRED by the ratchet.
      // See playbook/05-observability-pii.md.
      'no-console': 'error',
    },
  },
  {
    ignores: ['dist', 'build', 'node_modules', '*.generated.ts', '*.generated.css'],
  },
];
