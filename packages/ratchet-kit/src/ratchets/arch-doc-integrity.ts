// arch-doc-integrity — structural quality gate for `docs/architecture/*.md`.
//
// The third leg of the arch-doc drift defense (see keel playbook 04): the
// citation hook and value-based parsers both assume a doc's STRUCTURE is sound.
// This ratchet checks that it is — every citation a doc makes must RESOLVE:
//
//   1. Relative links + #anchors resolve — `[text](./other.md)` to a real file,
//      `[text](#anchor)` / `[text](./other.md#anchor)` to a real heading slug
//      (GitHub's exact slug algorithm, so an editor-valid link that 404s on
//      GitHub is caught).
//   2. Fully-qualified inline-code paths exist — a `` `code` `` span whose first
//      segment is a real top-level dir and which ends in a source extension must
//      name a file on disk (incl. the `path/to/file.ext:42` line-reference form).
//      This catches fabricated-by-paraphrase citations, the dominant drift class.
//      Base-relative shorthand + generated/ephemeral build outputs are skipped.
//   3. Mermaid renders on GitHub — node + pipe-delimited edge labels carry no
//      renderer traps (`\n` → use `<br/>`, `&&`, raw `<tag>` other than `<br/>`).
//   4. Footer present — every doc except README carries a `Last updated` line.
//
// The judgment half of the contract (readable intros, content-named sections, a
// diagram per subsystem, grounded claims) can't be mechanized — see
// templates/_AUTHORING.md.
//
// Strict-zero: the carve-out for "broken link, will fix later" IS the bug.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

export interface ArchDocIntegrityConfig {
  /** Absolute path to the docs/architecture directory. */
  archDir: string;
  /** Absolute repo root — fully-qualified path citations resolve against this. */
  repoRoot: string;
  /** First-segment allowlist: a cited path is only existence-checked if its first
   * segment is one of these real top-level dirs (everything else is treated as
   * base-relative shorthand and skipped). */
  topLevelDirs: ReadonlySet<string>;
  /** Repo-relative prefixes whose contents are generated/gitignored — skipped. */
  ephemeralPrefixes?: readonly string[];
  /** Doc filenames exempt from the footer requirement. Default `README.md`. */
  footerExemptFiles?: ReadonlySet<string>;
}

const PATH_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|swift|json|css|scss|md|sh|yml|yaml|html|png|svg|toml|rules|plist)$/;

// ── Fenced-code-aware parse: prose lines vs ``` fence blocks ──────────────────
interface ParsedDoc {
  proseLines: { text: string; lineNo: number }[];
  fenceBlocks: { lang: string; body: string; startLine: number }[];
}

export function parseDoc(raw: string): ParsedDoc {
  const lines = raw.split('\n');
  const proseLines: ParsedDoc['proseLines'] = [];
  const fenceBlocks: ParsedDoc['fenceBlocks'] = [];
  let inFence = false;
  let fenceLang = '';
  let fenceBody: string[] = [];
  let fenceStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fenceMatch = line.match(/^\s*```(\S*)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceLang = fenceMatch[1] ?? '';
        fenceBody = [];
        fenceStart = i + 1;
      } else {
        inFence = false;
        fenceBlocks.push({ lang: fenceLang, body: fenceBody.join('\n'), startLine: fenceStart });
      }
      continue;
    }
    if (inFence) fenceBody.push(line);
    else proseLines.push({ text: line, lineNo: i + 1 });
  }
  if (inFence) fenceBlocks.push({ lang: fenceLang, body: fenceBody.join('\n'), startLine: fenceStart });
  return { proseLines, fenceBlocks };
}

/**
 * GitHub heading-slug algorithm: downcase, strip everything that is not a
 * Unicode letter/number/whitespace/hyphen/underscore, then replace EACH
 * whitespace char with a hyphen (no run-collapse — `"a + b"` → `a--b`).
 */
export function slugify(headingText: string): string {
  return headingText
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

export function collectHeadingSlugs(doc: ParsedDoc): Set<string> {
  const slugs = new Set<string>();
  const seen = new Map<string, number>();
  for (const { text } of doc.proseLines) {
    const m = text.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    const base = slugify(m[2] ?? '');
    if (base === '') continue;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

function looksLikeRepoPath(span: string): boolean {
  if (!span.includes('/')) return false;
  if (!PATH_EXTENSIONS.test(span)) return false;
  if (span.includes('...') || span.includes('…')) return false;
  if (/[{}<>*?!|$(),:@\s\\]/.test(span)) return false;
  if (span.startsWith('@')) return false;
  if (span.startsWith('http')) return false;
  return true;
}

/**
 * Resolve a backtick span to the repo-relative path to existence-check, or null
 * if it's not a checkable fully-qualified citation. Strips a trailing
 * `:<line>` / `:<line>-<line>` reference first (the `file:line` citation form).
 */
export function citedRepoPath(
  span: string,
  topLevelDirs: ReadonlySet<string>,
  ephemeralPrefixes: readonly string[],
): string | null {
  const pathPart = span.replace(/:\d+(?:-\d+)?$/, '');
  if (!looksLikeRepoPath(pathPart)) return null;
  const repoRel = pathPart.replace(/^\.?\//, '');
  if (!topLevelDirs.has(repoRel.split('/')[0] ?? '')) return null; // base-relative shorthand
  if (ephemeralPrefixes.some((p) => repoRel.startsWith(p))) return null;
  return repoRel;
}

/**
 * GitHub-renderer traps inside mermaid. Two are inside node labels AND
 * pipe-delimited edge labels: literal `\n`, `&&`, a raw `<tag>` other than
 * `<br/>`, and a backslash-escaped quote `\"` (mermaid has no C-style escape —
 * use the `#quot;` entity). Two more live OUTSIDE bracket labels and are scanned
 * per-line (all four verified against the real mermaid parser):
 *   - a `.` inside a `-. text .->` DOTTED-edge label — the `.->` close token is
 *     lexed on the first `.`-then-dash, so a period in the label aborts the
 *     parse. (Periods in pipe/node labels are fine — dotted-only.)
 *   - a `;` in sequenceDiagram message / note text — `;` is a statement
 *     separator, so the parser hits a newline where it expects an arrow.
 *     (Harmless in flowchart labels — sequence-only.)
 */
export function findMermaidTraps(body: string): string[] {
  const traps: string[] = [];
  const lines = body.split('\n');
  // Diagram type, skipping a leading `%%`-comment / `%%{init}%%` directive and a
  // `---\n…\n---` frontmatter block — a themed sequence diagram opens with those
  // and would otherwise lose `;`-trap protection. The `;` trap is sequence-only.
  const isSequence = /^sequenceDiagram\b/.test(mermaidDiagramType(lines));
  // Compound shapes first so a circle `((x))` captures `x` (not `(x`).
  const labelRe =
    /\(\(([^)]*)\)\)|\[\[([^\]]*)\]\]|\{\{([^}]*)\}\}|\[\(([^)]*)\)\]|\(\[([^\]]*)\]\)|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\|([^|]+)\|/g;
  // Dotted-edge label text between `-.` and the closing `.-` (covers `.->`,
  // `.-`, reverse `<-. .-`). A bracket label containing both `-.` and `.-` is a
  // theoretical false-positive but does not occur in practice.
  const dottedEdgeRe = /-\.\s*([^\n]*?)\s*\.-/g;
  const check = (label: string, i: number) => {
    if (label.includes('\\n')) traps.push(`line +${i}: label "${label}" contains literal \\n (use <br/>)`);
    if (label.includes('&&')) traps.push(`line +${i}: label "${label}" contains && (renders as entity)`);
    if (/\\["']/.test(label)) {
      traps.push(`line +${i}: label "${label}" has a backslash-escaped quote (mermaid has no \\" escape — use #quot;)`);
    }
    const withoutBr = label.replace(/<br\s*\/?>/gi, '');
    if (/<[a-zA-Z/]/.test(withoutBr)) {
      traps.push(`line +${i}: label "${label}" contains an HTML-like <tag> (GitHub drops it — escape it or reword)`);
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let m: RegExpExecArray | null;
    labelRe.lastIndex = 0;
    while ((m = labelRe.exec(line)) !== null) {
      check(m.slice(1).find((g) => g !== undefined) ?? '', i);
    }
    dottedEdgeRe.lastIndex = 0;
    while ((m = dottedEdgeRe.exec(line)) !== null) {
      const edgeLabel = m[1] ?? '';
      if (edgeLabel.includes('.')) {
        traps.push(`line +${i}: dotted-edge label "${edgeLabel}" contains a "." (breaks the .-> lexer — reword without a period)`);
      }
    }
    // `;` is a statement separator in sequenceDiagram — breaks message/note text
    // AND colon-less guard lines (`loop a; b`). Whole-line scan; skip `%%`
    // comments (mermaid ignores them). No legit sequence statement uses `;`.
    if (isSequence && !line.trim().startsWith('%%') && line.includes(';')) {
      traps.push(`line +${i}: sequence line "${line.trim()}" contains ";" (statement separator — use "," or "—")`);
    }
  }
  return traps;
}

// First meaningful diagram-type line, skipping a leading `%%`-comment /
// `%%{init}%%` directive and a `---\n…\n---` frontmatter block.
function mermaidDiagramType(lines: string[]): string {
  let i = 0;
  while (i < lines.length) {
    const t = (lines[i] ?? '').trim();
    if (t === '') {
      i++;
      continue;
    }
    if (t.startsWith('%%')) {
      i++;
      continue;
    }
    if (t === '---') {
      i++; // open frontmatter
      while (i < lines.length && (lines[i] ?? '').trim() !== '---') i++;
      i++; // close frontmatter
      continue;
    }
    break;
  }
  return (lines[i] ?? '').trim();
}

/**
 * Strict-zero runner. Scans every `*.md` under `archDir` and asserts links +
 * anchors resolve, fully-qualified cited paths exist, mermaid has no renderer
 * traps, and the footer is present. Throws with the violation list + a pointer
 * to the authoring contract.
 */
export function archDocIntegrity(config: ArchDocIntegrityConfig): void {
  const {
    archDir,
    repoRoot,
    topLevelDirs,
    ephemeralPrefixes = ['coverage/', 'node_modules/', 'dist/', 'build/'],
    footerExemptFiles = new Set(['README.md']),
  } = config;

  const docPaths = readdirSync(archDir).filter((f) => f.endsWith('.md')).map((f) => join(archDir, f));
  const docCache = new Map<string, { parsed: ParsedDoc; slugs: Set<string> }>();
  const getDoc = (abs: string) => {
    let c = docCache.get(abs);
    if (!c) {
      const parsed = parseDoc(readFileSync(abs, 'utf8'));
      c = { parsed, slugs: collectHeadingSlugs(parsed) };
      docCache.set(abs, c);
    }
    return c;
  };

  const violations: string[] = [];
  for (const docPath of docPaths) {
    const rel = relative(repoRoot, docPath);
    const { parsed } = getDoc(docPath);
    const docDir = dirname(docPath);
    const fileName = docPath.split('/').pop()!;

    // (1)+(2) Links + anchors.
    const linkRe = /\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    for (const { text, lineNo } of parsed.proseLines) {
      const linkScanText = text.replace(/`[^`]*`/g, ''); // ignore illustrative link syntax in backticks
      let m: RegExpExecArray | null;
      linkRe.lastIndex = 0;
      while ((m = linkRe.exec(linkScanText)) !== null) {
        const target = m[1] ?? '';
        if (/^(https?:|mailto:|tel:|data:)/.test(target)) continue;
        if (target.startsWith('#')) {
          const anchor = target.slice(1).toLowerCase();
          if (anchor && !getDoc(docPath).slugs.has(anchor)) {
            violations.push(`${rel}:${lineNo}: anchor "#${anchor}" has no matching heading in this doc`);
          }
          continue;
        }
        const hashIdx = target.indexOf('#');
        const pathPart = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
        const anchorPart = hashIdx >= 0 ? target.slice(hashIdx + 1).toLowerCase() : '';
        const resolved = resolve(docDir, pathPart);
        if (!existsSync(resolved)) {
          violations.push(`${rel}:${lineNo}: link target "${pathPart}" does not exist`);
          continue;
        }
        if (anchorPart && pathPart.endsWith('.md') && !getDoc(resolved).slugs.has(anchorPart)) {
          violations.push(`${rel}:${lineNo}: link "${pathPart}#${anchorPart}" — anchor not found in target doc`);
        }
      }
    }

    // (3) Inline-code repo-path citations exist on disk.
    const codeSpanRe = /`([^`]+)`/g;
    for (const { text, lineNo } of parsed.proseLines) {
      let m: RegExpExecArray | null;
      codeSpanRe.lastIndex = 0;
      while ((m = codeSpanRe.exec(text)) !== null) {
        const span = (m[1] ?? '').trim();
        const repoRel = citedRepoPath(span, topLevelDirs, ephemeralPrefixes);
        if (!repoRel) continue;
        if (!existsSync(join(repoRoot, repoRel))) {
          violations.push(`${rel}:${lineNo}: cited path \`${span}\` does not exist in the repo`);
        }
      }
    }

    // (4) Mermaid renderer traps.
    for (const block of parsed.fenceBlocks) {
      if (block.lang !== 'mermaid') continue;
      for (const trap of findMermaidTraps(block.body)) {
        violations.push(`${rel} (mermaid @ ${block.startLine}) ${trap}`);
      }
    }

    // (5) Footer present.
    if (!footerExemptFiles.has(fileName) && !parsed.proseLines.some((l) => /last updated/i.test(l.text))) {
      violations.push(`${rel}: missing a "Last updated" footer line`);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `arch-doc-integrity: ${violations.length} structural issue(s) in ${relative(repoRoot, archDir)}/*.md.\n` +
        `Every citation must resolve (links/anchors/paths), mermaid must render on GitHub, and each doc needs a "Last updated" footer.\n` +
        `See templates/_AUTHORING.md for the full authoring contract.\n\n` +
        violations.map((v) => `  • ${v}`).join('\n'),
    );
  }
}
