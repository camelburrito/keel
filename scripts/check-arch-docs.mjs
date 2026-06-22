#!/usr/bin/env node
// Dogfood gate — run @camelburrito/ratchet-kit's archDocIntegrity on keel's OWN
// docs/architecture/*.md, so the reference repo self-applies the same structural
// arch-doc gate it ships for consuming projects: every relative link + #anchor
// resolves, every fully-qualified inline-code path exists on disk, mermaid carries
// no GitHub-renderer traps, and each non-index doc has a "Last updated" footer.
// See docs/playbook/04-architecture-docs.md (Tier 3) and templates/_AUTHORING.md.
//
// ratchet-kit ships CJS and its dist/ is gitignored, so CI builds the package
// first (npm ci && npm run build in packages/ratchet-kit) and this script
// require()s the built output. The companion check-mermaid-render.mjs renders
// every diagram through the real engine — the half this heuristic can't prove.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distPath = join(repoRoot, 'packages/ratchet-kit/dist/index.js');

let archDocIntegrity;
try {
  ({ archDocIntegrity } = require(distPath));
} catch {
  console.error(
    `Could not load ${distPath}.\n` +
      `Build the package first:  (cd packages/ratchet-kit && npm ci && npm run build)`,
  );
  process.exit(1);
}

try {
  archDocIntegrity({
    archDir: join(repoRoot, 'docs/architecture'),
    repoRoot,
    // keel's real top-level dirs — a fully-qualified inline-code citation is only
    // existence-checked when its first segment is one of these.
    topLevelDirs: new Set([
      'docs',
      'packages',
      'templates',
      'scripts',
      'recipes',
      'checklists',
      'examples',
      '.github',
    ]),
  });
  console.log('arch-doc-integrity: docs/architecture/*.md — 0 violations');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
