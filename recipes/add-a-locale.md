# Recipe: Add a Locale

## Steps

1. Pick the BCP-47 code (e.g., `es-US`, `ta-IN`, `en-GB`).
2. Copy `shared/strings/catalogs/en-US.json` to `shared/strings/catalogs/<locale>.json`.
3. Replace every value with the translated string. Maintain key parity — same keys, same nesting.
4. Run `npm run strings:gen` to regenerate all per-platform outputs.
5. Add `<locale>` to the locale picker UI (web `LanguagePicker`, iOS `SettingsView` Language row).
6. Add a permutation cell that seeds a member with `Member.locale = '<locale>'` so E2E proves the resolver chain picks it up.
7. Run `npm run strings:check` and the full ratchet suite to verify nothing drifted.

## Key parity is load-bearing

The codegen verifier asserts every locale has the same set of keys as the source-of-truth locale (`en-US`). Missing or extra keys fail `npm run strings:check`. If a translation is genuinely the same as English (rare for content; common for brand strings), still copy the value verbatim — don't omit the key.

## Interpolations

`t(key, vars)` substitutes `{var}` placeholders. The same `{var}` set must appear in every locale's value for that key; the verifier catches drift.

## Resolver chain reminder

`Member.locale → Household.locale → device → en-US`. Per-user override wins over household default wins over device wins over fallback. Test the chain by setting only one layer at a time.

## Related playbook

- [08-string-catalog-i18n.md](../docs/playbook/08-string-catalog-i18n.md) — full pipeline
