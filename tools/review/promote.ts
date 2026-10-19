import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseScanReport, type ReviewFinding } from './findings';

export interface ReviewDecision {
  path: string;
  verdict: string;
  candidatePath?: string;
  note?: string;
}

export interface PromoteOptions {
  decisionsFile?: string;
  candidatesDir?: string;
  rootDir?: string;
}

export interface PromoteResult {
  promoted: string[];
  skipped: string[];
}

export function runStep(
  cmd: string,
  args: readonly string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  const r = childProcess.spawnSync(cmd, args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (r.error) throw r.error;
  const status = r.status ?? 1;
  const stdout = r.stdout ?? '';
  const stderr = r.stderr ?? '';
  if (status !== 0) {
    throw new Error(
      `Step failed (${cmd} ${args.join(' ')} exited with code ${status}):\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
  return { status, stdout, stderr };
}

export function parseReviewDecisions(raw: string): ReviewDecision[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in review decisions: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(data)) {
    throw new Error('Expected review decisions to be an array');
  }
  return data.map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`Decision at index ${i} is not an object`);
    const r = item as Record<string, unknown>;
    const p = typeof r.path === 'string' ? r.path.trim() : '';
    const v = typeof r.verdict === 'string' ? r.verdict.trim() : '';
    if (!p) throw new Error(`Decision at index ${i} missing a valid path string`);
    if (!v) throw new Error(`Decision at index ${i} missing a valid verdict string`);
    const c = typeof r.candidatePath === 'string' && r.candidatePath.trim() ? r.candidatePath.trim() : undefined;
    const note = typeof r.note === 'string' ? r.note : undefined;
    return { path: p, verdict: v, candidatePath: c, note };
  });
}

export function resolvePromotionPaths(
  d: ReviewDecision,
  candidatesDir = 'tmp/candidates',
): { targetRelPath: string; candidateRelPath: string } {
  const target = d.path.replace(/\\/g, '/').replace(/^\.\//, '');
  const cand = d.candidatePath
    ? d.candidatePath.replace(/\\/g, '/').replace(/^\.\//, '')
    : path.posix.join(candidatesDir.replace(/\\/g, '/'), target);

  const normTarget = path.posix.normalize(target);
  const normCand = path.posix.normalize(cand);
  if (normTarget.startsWith('..') || path.isAbsolute(normTarget)) {
    throw new Error(`Invalid target path escapes repository root: ${normTarget}`);
  }
  if (!normTarget.startsWith('assets/game/') && !normTarget.startsWith('public/')) {
    throw new Error(`Target path must be under assets/game/ or public/: ${normTarget}`);
  }
  if (normCand.startsWith('..') || path.isAbsolute(normCand)) {
    throw new Error(`Invalid candidate path escapes repository root: ${normCand}`);
  }
  return { targetRelPath: normTarget, candidateRelPath: normCand };
}

export function stripExt(filePath: string): string {
  const ext = path.posix.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

export function detectScanFindings(promoted: readonly string[], scanFindings: readonly ReviewFinding[]): string[] {
  const issues: string[] = [];
  const normPromoted = new Set<string>();
  for (const p of promoted) {
    const clean = p.replace(/\\/g, '/').replace(/^\.\//, '');
    normPromoted.add(clean);
    normPromoted.add(stripExt(clean));
  }

  for (const f of scanFindings) {
    const p = f.assetPath ?? f.dirPath;
    if (p) {
      const clean = p.replace(/\\/g, '/').replace(/^\.\//, '');
      const stripped = stripExt(clean);
      if (normPromoted.has(clean) || normPromoted.has(stripped)) {
        issues.push(`${p}: [${f.category}] ${f.note || 'artifact detected'}`);
      }
    }
  }
  return Array.from(new Set(issues));
}

export function promoteAssets(options: PromoteOptions = {}): PromoteResult {
  const rootDir = options.rootDir ?? process.cwd();
  const candidatesDir = options.candidatesDir ?? 'tmp/candidates';
  const decFile = options.decisionsFile ?? 'review_decisions.json';
  const decPath = path.isAbsolute(decFile) ? decFile : path.join(rootDir, decFile);
  if (!fs.existsSync(decPath)) throw new Error(`Review decisions file not found: ${decPath}`);

  const decisions = parseReviewDecisions(fs.readFileSync(decPath, 'utf-8'));
  const toPromote: Array<{ candFull: string; targetFull: string; targetRelPath: string }> = [];
  const skipped: string[] = [];

  for (const d of decisions) {
    if (d.verdict.toLowerCase() !== 'accept') {
      skipped.push(d.path);
      continue;
    }
    const { targetRelPath, candidateRelPath } = resolvePromotionPaths(d, candidatesDir);
    const candFull = path.isAbsolute(candidateRelPath) ? candidateRelPath : path.join(rootDir, candidateRelPath);
    const targetFull = path.isAbsolute(targetRelPath) ? targetRelPath : path.join(rootDir, targetRelPath);
    if (!fs.existsSync(candFull)) throw new Error(`Candidate file not found for ${targetRelPath}: ${candFull}`);
    toPromote.push({ candFull, targetFull, targetRelPath });
  }

  if (toPromote.length === 0) return { promoted: [], skipped };

  const promoted: string[] = [];
  for (const { candFull, targetFull, targetRelPath } of toPromote) {
    fs.mkdirSync(path.dirname(targetFull), { recursive: true });
    fs.copyFileSync(candFull, targetFull);
    promoted.push(targetRelPath);
  }

  runStep('python3', ['tools/compress_assets.py'], rootDir);
  runStep('node', ['tools/gen_images_ts.mjs'], rootDir);
  runStep('npx', ['tsx', 'tools/artifact_review/make_scan_plan.ts'], rootDir);
  const scanOutDir = 'tools/audit_out/artifact_scan';
  runStep('python3', ['tools/artifact_scan.py', '--out', scanOutDir], rootDir);

  const reportPath = path.join(rootDir, scanOutDir, 'artifact_report.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Artifact report not found: ${reportPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const scanFindings = parseScanReport(raw).findings;

  const findings = detectScanFindings(promoted, scanFindings);
  if (findings.length > 0) throw new Error(`Re-scan detected findings on promoted assets:\n${findings.join('\n')}`);

  runStep('npx', ['tsc', '--noEmit'], rootDir);
  runStep('npx', ['vitest', 'run'], rootDir);
  return { promoted, skipped };
}

export interface CliArgs {
  decisionsFile?: string;
  candidatesDir?: string;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  let decisionsFile: string | undefined;
  let candidatesDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--candidates-dir' && i + 1 < argv.length) {
      candidatesDir = argv[++i];
    } else if (!a.startsWith('-')) {
      decisionsFile = a;
    }
  }
  return { decisionsFile, candidatesDir };
}

export function main(argv = process.argv.slice(2), rootDir = process.cwd()): PromoteResult {
  const cliArgs = parseCliArgs(argv);
  return promoteAssets({
    ...cliArgs,
    rootDir,
  });
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('promote.ts')) {
  main();
}
