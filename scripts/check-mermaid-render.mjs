#!/usr/bin/env node
// scripts/check-mermaid-render.mjs — authoritative mermaid render check.
//
// The `archDocIntegrity` ratchet (from @camelburrito/ratchet-kit) text-scans for
// KNOWN mermaid trap classes — it is a heuristic, not a parse. This helper is the
// authoritative complement: it runs every ```mermaid block in the target markdown
// files through the REAL mermaid engine (`mermaid.parse()` under a jsdom DOM), so
// a diagram that passes the ratchet but still shows "Unable to render rich
// display" on GitHub is caught here. See keel playbook 04-architecture-docs.md
// § Tier 3. (mermaid.parse() is the parse-abort authority — the dominant GitHub
// failure class; the dark-mode classDef/style legibility class is covered by the
// ratchet's findContrastTraps + visual review.)
//
// Deps: `mermaid` + `jsdom` — both pure-JS, NO headless browser (unlike
// mermaid-cli, whose puppeteer/Chromium dependency makes `npx` unreliable). Add
// them once as devDependencies in the host project:
//
//   npm i -D mermaid jsdom
//
// then wire `"check:mermaid": "node scripts/check-mermaid-render.mjs"` and run it
// in CI / pre-merge alongside the ratchet suite.
//
// Usage:
//   node scripts/check-mermaid-render.mjs [files-or-dir-globs...]
//   # default targets: docs/architecture/*.md docs/playbook/*.md
//   node scripts/check-mermaid-render.mjs docs/architecture/auth.md
//   node scripts/check-mermaid-render.mjs 'docs/**/*.md'   # quote globs
//
// Exit codes:
//   0  every mermaid block parsed/rendered
//   1  at least one block failed (a real broken diagram) — prints file:line + the trap hint
//   2  setup error — `mermaid`/`jsdom` not installed (nothing verified; never a silent pass)

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_TARGETS = ['docs/architecture/*.md', 'docs/playbook/*.md'];

function log(msg) {
  // eslint-disable-next-line no-console -- operator-facing CLI output
  console.log(msg);
}

// ── tiny dependency-free globber: supports `dir/*.md` and `dir/**/*.md` ───────
function expand(pattern) {
  if (!pattern.includes('*')) return existsSync(pattern) ? [pattern] : [];
  const recursive = pattern.includes('**');
  const ext = pattern.slice(pattern.lastIndexOf('.'));
  const root = pattern.split('*')[0].replace(/\/$/, '') || '.';
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (recursive) walk(p); continue; }
      if (p.endsWith(ext)) out.push(p);
    }
  };
  walk(root);
  return out;
}

// ── extract ```mermaid blocks with their 1-based start line ──────────────────
// Opens on `\b` (word boundary), not `\s*$`, so an info-string fence like
// ```` ```mermaid foo ```` — which GitHub renders as language=mermaid — is still
// captured (it would otherwise escape the gate). An unterminated fence (opened,
// never closed) is reported as a failure: GitHub swallows the rest of the doc
// into the code block, a real render bug.
function extractBlocks(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const blocks = [];
  let inBlock = false, start = 0, buf = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!inBlock && /^```mermaid\b/.test(l)) { inBlock = true; start = i + 1; buf = []; continue; }
    if (inBlock && /^```\s*$/.test(l)) { inBlock = false; blocks.push({ line: start, src: buf.join('\n') }); continue; }
    if (inBlock) buf.push(l);
  }
  const unterminatedAt = inBlock ? start : null;
  return { blocks, unterminatedAt };
}

// ── set up a jsdom DOM + the real mermaid engine (browser-free) ──────────────
async function loadMermaid() {
  let JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch (e) {
    log('[check-mermaid-render] SETUP ERROR — `jsdom` is not installed.');
    log('  Install (browser-free, fast):  npm i -D mermaid jsdom');
    log(`  (resolver said: ${e.message.split('\n')[0]})`);
    process.exit(2);
  }
  // The DOM MUST exist on globalThis BEFORE mermaid is imported: mermaid bundles
  // DOMPurify, which captures `window` at module-evaluation time. Import mermaid
  // first and any non-trivial parse (HTML labels, subgraphs, …) fails with
  // "DOMPurify.sanitize is not a function" — verified: a bare `A-->B` survives,
  // but `A["x<br/>y"]` and any `subgraph` do not.
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  try { Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); } catch { /* already defined */ }
  let mermaid;
  try {
    mermaid = (await import('mermaid')).default;
  } catch (e) {
    log('[check-mermaid-render] SETUP ERROR — `mermaid` is not installed.');
    log('  Install (browser-free, fast):  npm i -D mermaid jsdom');
    log(`  (resolver said: ${e.message.split('\n')[0]})`);
    process.exit(2);
  }
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
  return mermaid;
}

// ── main ─────────────────────────────────────────────────────────────────────
const patterns = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TARGETS;
const files = [...new Set(patterns.flatMap(expand))].sort();

if (files.length === 0) {
  log(`[check-mermaid-render] no markdown files matched: ${patterns.join(' ')}`);
  process.exit(0);
}

const mermaid = await loadMermaid();

const failures = []; // { file, line, message }
let okBlocks = 0;
let okFiles = 0;

for (const file of files) {
  const { blocks, unterminatedAt } = extractBlocks(file);
  if (unterminatedAt !== null) {
    failures.push({ file, line: unterminatedAt, message: 'unterminated ```mermaid fence (opened here, never closed)' });
  }
  if (blocks.length === 0 && unterminatedAt === null) continue;
  let fileBroken = unterminatedAt !== null;
  for (const b of blocks) {
    try {
      await mermaid.parse(b.src);
      okBlocks++;
    } catch (e) {
      fileBroken = true;
      failures.push({ file, line: b.line, message: (e?.message ?? String(e)).split('\n').slice(0, 3).join(' ') });
    }
  }
  if (!fileBroken) { okFiles++; log(`  ✓ ${file} (${blocks.length} block${blocks.length === 1 ? '' : 's'})`); }
  else log(`  ✗ ${file} — ${failures.filter((f) => f.file === file).length} problem(s)`);
}

log('');
if (failures.length > 0) {
  log(`[check-mermaid-render] ${failures.length} mermaid problem(s):\n`);
  for (const f of failures) log(`  ✗ ${f.file}:${f.line} — ${f.message}`);
  log('\nGitHub renders mermaid via the real parser. Common traps (see playbook 04):');
  log('  \\n in a label → <br/>;  ";" in sequenceDiagram text → "," ;  "." in a -. dotted .-> label;');
  log('  \\" in a node label → #quot;;  raw <tag> → reword;  && → "and".');
  process.exit(1);
}

log(`[check-mermaid-render] OK — ${okBlocks} mermaid block(s) across ${okFiles} file(s) with diagrams render cleanly.`);
process.exit(0);
