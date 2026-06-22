// Drift detector — for every package the project declares as a deploy unit,
// asserts that its `package-lock.json` exists AND every top-level dep in
// `package.json#dependencies` appears in `package-lock.json` with matching
// version specifier + resolved install path.
//
// WHY
//   Cloud Build (and any deploy that runs `npm ci`) uses ONLY the lockfile
//   inside the uploaded package directory. If `package.json` has been bumped
//   but the lockfile wasn't regenerated, `npm ci` fails with EUSAGE /
//   "Missing: <pkg>@<ver> from lock file" — and the failure surfaces at
//   deploy time, not at PR time. Local `npm install` in an npm-workspaces
//   repo uses the ROOT lockfile and silently masks the per-package drift.
//
// SCOPE
//   What this guard checks (pre-commit speed: pure JSON parsing):
//     1. `<source>/package-lock.json` exists.
//     2. lockfileVersion is 3 (npm 7+).
//     3. Every key in package.json#dependencies appears in the lockfile's
//        top-level deps record with a matching version specifier.
//     4. Every key in package.json#dependencies has a resolved entry at
//        `lockfile.packages["node_modules/<name>"]`.
//   Out of scope (intentional):
//     - devDependencies (deploys run `--production`).
//     - Transitive dep version pins.
//     - Root `package-lock.json` (only per-package matters for deploy).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LockfileSyncCodebase {
  /** Relative path from repoRoot to the deploy unit (must contain package.json + package-lock.json). */
  source: string;
  /** Human-friendly label used in failure messages. */
  codebase: string;
}

export interface LockfileSyncWithPackageJsonConfig {
  /** Absolute path to the repo root. */
  repoRoot: string;
  /**
   * Explicit codebase list. Use this when the project's deploy units live
   * outside a firebase.json or similar manifest.
   */
  codebases?: LockfileSyncCodebase[];
  /**
   * Path (relative to repoRoot) to a firebase.json with a `functions[]`
   * array whose entries have `{ source, codebase }`. When set, the
   * codebases array is derived from this manifest. If both are set, the
   * explicit `codebases` arg wins.
   */
  firebaseJsonPath?: string;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
}

interface LockfileV3 {
  lockfileVersion: number;
  packages: Record<
    string,
    {
      dependencies?: Record<string, string>;
      version?: string;
      resolved?: string;
    }
  >;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function loadCodebasesFromFirebaseJson(
  repoRoot: string,
  firebaseJsonPath: string,
): LockfileSyncCodebase[] {
  const fb = readJson<{ functions: LockfileSyncCodebase[] }>(
    join(repoRoot, firebaseJsonPath),
  );
  if (!Array.isArray(fb.functions)) {
    throw new Error(
      `lockfile-sync-with-package-json: ${firebaseJsonPath} \`functions\` field is not an array. ` +
        `Expected post-firebase-tools-12 schema with \`functions[]\` array of \`{ source, codebase }\`.`,
    );
  }
  return fb.functions;
}

/**
 * Lockfile-sync-with-package-json ratchet. Throws on the first per-codebase
 * violation encountered (missing lockfile, wrong lockfileVersion, missing
 * dep, version mismatch, missing resolved entry).
 *
 * @example
 *   // Explicit codebases:
 *   lockfileSyncWithPackageJson({
 *     repoRoot: process.cwd(),
 *     codebases: [
 *       { source: 'functions', codebase: 'default' },
 *       { source: 'functions-secondary', codebase: 'secondary' },
 *     ],
 *   });
 *
 *   // OR auto-load from firebase.json:
 *   lockfileSyncWithPackageJson({
 *     repoRoot: process.cwd(),
 *     firebaseJsonPath: 'firebase.json',
 *   });
 */
export function lockfileSyncWithPackageJson(
  config: LockfileSyncWithPackageJsonConfig,
): void {
  const { repoRoot, codebases: explicit, firebaseJsonPath } = config;

  let codebases: LockfileSyncCodebase[];
  if (explicit && explicit.length > 0) {
    codebases = explicit;
  } else if (firebaseJsonPath) {
    codebases = loadCodebasesFromFirebaseJson(repoRoot, firebaseJsonPath);
  } else {
    throw new Error(
      'lockfile-sync-with-package-json: provide either `codebases` or `firebaseJsonPath`.',
    );
  }

  const violations: string[] = [];

  for (const { source, codebase } of codebases) {
    const lockPath = join(repoRoot, source, 'package-lock.json');
    const pkgPath = join(repoRoot, source, 'package.json');

    if (!existsSync(lockPath)) {
      violations.push(
        `[${codebase}] missing ${source}/package-lock.json — Cloud Build's \`npm ci\` requires it. ` +
          `Generate via: cd ${source} && npm install --package-lock-only --no-workspaces`,
      );
      continue;
    }

    const pkg = readJson<PackageJson>(pkgPath);
    const lock = readJson<LockfileV3>(lockPath);

    if (lock.lockfileVersion !== 3) {
      violations.push(
        `[${codebase}] ${source}/package-lock.json must be lockfileVersion 3 (npm 7+); ` +
          `got ${lock.lockfileVersion}.`,
      );
      continue;
    }

    const pkgDeps = pkg.dependencies ?? {};
    const lockTopLevelDeps = lock.packages['']?.dependencies ?? {};
    const repairCmd = `cd ${source} && rm -f package-lock.json && npm install --package-lock-only --no-workspaces`;

    for (const [name, specifier] of Object.entries(pkgDeps)) {
      if (!(name in lockTopLevelDeps)) {
        violations.push(
          `[${codebase}] ${source}: ${name} declared in package.json but missing from package-lock.json deps. Repair: ${repairCmd}`,
        );
        continue;
      }
      if (lockTopLevelDeps[name] !== specifier) {
        violations.push(
          `[${codebase}] ${source}: ${name} version-specifier drift — package.json="${specifier}" vs lockfile="${lockTopLevelDeps[name]}". Repair: ${repairCmd}`,
        );
      }
      const installedPath = `node_modules/${name}`;
      if (!(installedPath in lock.packages)) {
        violations.push(
          `[${codebase}] ${source}: ${name} declared in package.json but not resolved in package-lock.json#packages (deploy will fail with "Missing: <pkg> from lock file"). Repair: ${repairCmd}`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `lockfile-sync-with-package-json ratchet violated.\n\n` +
        `Violations:\n` +
        violations.map((v) => `  • ${v}`).join('\n'),
    );
  }
}
