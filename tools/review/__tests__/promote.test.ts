import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewFinding } from '../findings';
import {
  detectScanFindings,
  main,
  parseCliArgs,
  parseReviewDecisions,
  promoteAssets,
  resolvePromotionPaths,
} from '../promote';

vi.mock('node:fs');
vi.mock('node:child_process');

const virtualFiles = new Map<string, string>();
const spawnOverrides = new Map<string, { status?: number; stdout?: string; stderr?: string }>();

function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

function setVirtualFiles(files: Record<string, string>) {
  virtualFiles.clear();
  for (const [filePath, content] of Object.entries(files)) {
    virtualFiles.set(normalizePath(filePath), content);
  }
}

function makeSpawnResult(
  overrides?: Partial<childProcess.SpawnSyncReturns<string>>,
): childProcess.SpawnSyncReturns<string> {
  return {
    status: overrides?.status !== undefined ? overrides.status : 0,
    stdout: overrides?.stdout ?? '',
    stderr: overrides?.stderr ?? '',
    pid: 1234,
    output: [null, overrides?.stdout ?? '', overrides?.stderr ?? ''],
    signal: null,
    error: overrides?.error,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  virtualFiles.clear();
  spawnOverrides.clear();

  vi.mocked(fs.existsSync).mockImplementation((targetPath: fs.PathLike) => {
    const norm = normalizePath(String(targetPath));
    return virtualFiles.has(norm);
  });

  vi.mocked(fs.readFileSync).mockImplementation((targetPath: fs.PathOrFileDescriptor) => {
    const norm = normalizePath(String(targetPath));
    const content = virtualFiles.get(norm);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${String(targetPath)}'`);
    }
    return content;
  });

  vi.mocked(fs.copyFileSync).mockImplementation((src: fs.PathLike, dst: fs.PathLike) => {
    const srcNorm = normalizePath(String(src));
    const dstNorm = normalizePath(String(dst));
    const content = virtualFiles.get(srcNorm);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, copyfile '${String(src)}' -> '${String(dst)}'`);
    }
    virtualFiles.set(dstNorm, content);
  });

  vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

  vi.mocked(childProcess.spawnSync).mockImplementation(
    (cmd: string, args?: readonly string[] | childProcess.SpawnSyncOptions, _opts?: childProcess.SpawnSyncOptions) => {
      const cmdStr = cmd;
      const argsArr = Array.isArray(args) ? args : [];
      const key = `${cmdStr} ${argsArr[0] ?? ''}`.trim();
      const override = spawnOverrides.get(key) ?? spawnOverrides.get(cmdStr);
      return makeSpawnResult(override);
    },
  );
});

describe('parseReviewDecisions', () => {
  it('parses valid decision array with multiple verdicts', () => {
    const json = JSON.stringify([
      {
        path: 'assets/game/diff/beach_a.png',
        verdict: 'accept',
        note: 'fixed blur',
      },
      { path: 'assets/game/story/acorn.png', verdict: 'reject' },
      { path: 'public/story-video/intro.mp4', verdict: 'unsure' },
    ]);

    const decisions = parseReviewDecisions(json);
    expect(decisions).toEqual([
      {
        path: 'assets/game/diff/beach_a.png',
        verdict: 'accept',
        note: 'fixed blur',
        candidatePath: undefined,
      },
      {
        path: 'assets/game/story/acorn.png',
        verdict: 'reject',
        note: undefined,
        candidatePath: undefined,
      },
      {
        path: 'public/story-video/intro.mp4',
        verdict: 'unsure',
        note: undefined,
        candidatePath: undefined,
      },
    ]);
  });

  it('throws on invalid json string', () => {
    expect(() => parseReviewDecisions('not a json')).toThrow('Invalid JSON');
  });

  it('throws if data is not an array', () => {
    expect(() => parseReviewDecisions('42')).toThrow('Expected review decisions to be an array');
    expect(() => parseReviewDecisions('{"decisions":[]}')).toThrow('Expected review decisions to be an array');
  });

  it('throws if decision item is not an object or lacks required fields', () => {
    expect(() => parseReviewDecisions('[null]')).toThrow('not an object');
    expect(() => parseReviewDecisions('[{"path":"","verdict":"accept"}]')).toThrow('missing a valid path');
    expect(() => parseReviewDecisions('[{"path":"assets/a.png","verdict":""}]')).toThrow('missing a valid verdict');
  });
});

describe('resolvePromotionPaths', () => {
  it('resolves assets/game asset with default candidate directory', () => {
    const decision = {
      path: 'assets/game/diff/beach_a.png',
      verdict: 'accept',
    };
    const { targetRelPath, candidateRelPath } = resolvePromotionPaths(decision, 'tmp/candidates');
    expect(targetRelPath).toBe('assets/game/diff/beach_a.png');
    expect(candidateRelPath).toBe('tmp/candidates/assets/game/diff/beach_a.png');
  });

  it('resolves public asset path', () => {
    const decision = {
      path: 'public/story-video/intro.mp4',
      verdict: 'accept',
    };
    const { targetRelPath, candidateRelPath } = resolvePromotionPaths(decision, 'tmp/candidates');
    expect(targetRelPath).toBe('public/story-video/intro.mp4');
    expect(candidateRelPath).toBe('tmp/candidates/public/story-video/intro.mp4');
  });

  it('uses explicit candidatePath if provided', () => {
    const decision = {
      path: 'assets/game/diff/beach_a.png',
      verdict: 'accept',
      candidatePath: 'custom/candidate/path.png',
    };
    const { targetRelPath, candidateRelPath } = resolvePromotionPaths(decision);
    expect(targetRelPath).toBe('assets/game/diff/beach_a.png');
    expect(candidateRelPath).toBe('custom/candidate/path.png');
  });

  it('rejects targets not under assets/game/ or public/', () => {
    expect(() =>
      resolvePromotionPaths({
        path: 'src/assets/images.ts',
        verdict: 'accept',
      }),
    ).toThrow('Target path must be under assets/game/ or public/');
  });

  it('rejects target paths that escape root via directory traversal', () => {
    expect(() => resolvePromotionPaths({ path: '../../secrets.txt', verdict: 'accept' })).toThrow(
      'Invalid target path escapes repository root',
    );
    expect(() =>
      resolvePromotionPaths({
        path: 'assets/game/../../secrets.txt',
        verdict: 'accept',
      }),
    ).toThrow('Target path must be under assets/game/ or public/');
  });

  it('rejects candidate paths that escape root', () => {
    expect(() =>
      resolvePromotionPaths({
        path: 'assets/game/diff/ok.png',
        verdict: 'accept',
        candidatePath: '../../etc/passwd',
      }),
    ).toThrow('Invalid candidate path escapes repository root');
  });
});

describe('detectScanFindings', () => {
  it('detects structured findings matching promoted assets', () => {
    const scanFindings: ReviewFinding[] = [
      {
        source: 'scan',
        category: 'pair-identity',
        severity: 3,
        assetPath: 'assets/game/diff/flagged.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: 'differing pixels',
      },
      {
        source: 'scan',
        category: 'judged-artifact',
        severity: 2,
        assetPath: 'assets/game/diff/other.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: 'seam',
      },
    ];

    const issues = detectScanFindings(['assets/game/diff/flagged.png'], scanFindings);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('assets/game/diff/flagged.png');
    expect(issues[0]).toContain('pair-identity');
  });

  it('matches structured findings when promoted candidate was .png but scan reported .jpg', () => {
    const scanFindings: ReviewFinding[] = [
      {
        source: 'scan',
        category: 'pair-identity',
        severity: 3,
        assetPath: 'assets/game/diff/beach_a.jpg',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: 'differing pixels',
      },
    ];

    const issues = detectScanFindings(['assets/game/diff/beach_a.png'], scanFindings);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('assets/game/diff/beach_a.jpg');
    expect(issues[0]).toContain('pair-identity');
  });

  it('returns empty array when findings only touch other assets', () => {
    const scanFindings: ReviewFinding[] = [
      {
        source: 'scan',
        category: 'pair-identity',
        severity: 3,
        assetPath: 'assets/game/diff/unrelated.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: 'differing pixels',
      },
    ];
    const issues = detectScanFindings(['assets/game/diff/beach_a.png'], scanFindings);
    expect(issues).toEqual([]);
  });
});

describe('promoteAssets copy logic and pipeline execution', () => {
  const decisionsJson = JSON.stringify([
    { path: 'assets/game/diff/beach_a.png', verdict: 'accept' },
    { path: 'public/intro.mp4', verdict: 'accept' },
    { path: 'assets/game/diff/beach_b.png', verdict: 'reject' },
    { path: 'assets/game/diff/beach_c.png', verdict: 'unsure' },
  ]);

  it('copies accepted candidate files over target shipped assets and runs all pipelines', () => {
    setVirtualFiles({
      'review_decisions.json': decisionsJson,
      'assets/game/diff/beach_a.png': 'old image content',
      'public/intro.mp4': 'old video content',
      'tmp/candidates/assets/game/diff/beach_a.png': 'new accepted image content',
      'tmp/candidates/public/intro.mp4': 'new accepted video content',
      'tools/audit_out/artifact_scan/artifact_report.json': '[]',
    });

    const result = promoteAssets({ rootDir: '.' });

    expect(result.promoted).toEqual(['assets/game/diff/beach_a.png', 'public/intro.mp4']);
    expect(result.skipped).toEqual(['assets/game/diff/beach_b.png', 'assets/game/diff/beach_c.png']);

    expect(virtualFiles.get('assets/game/diff/beach_a.png')).toBe('new accepted image content');
    expect(virtualFiles.get('public/intro.mp4')).toBe('new accepted video content');

    const calls = vi
      .mocked(childProcess.spawnSync)
      .mock.calls.map(([cmd, args]) => `${cmd} ${Array.isArray(args) ? args.join(' ') : ''}`);
    expect(calls).toEqual([
      'python3 tools/compress_assets.py',
      'node tools/gen_images_ts.mjs',
      'npx tsx tools/artifact_review/make_scan_plan.ts',
      'python3 tools/artifact_scan.py --out tools/audit_out/artifact_scan',
      'npx tsc --noEmit',
      'npx vitest run',
    ]);
  });

  it('throws error when candidate file does not exist without writing earlier candidates', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([
        { path: 'assets/game/diff/beach_a.png', verdict: 'accept' },
        { path: 'public/intro.mp4', verdict: 'accept' },
      ]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
    });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('Candidate file not found for public/intro.mp4');
    expect(fs.copyFileSync).not.toHaveBeenCalled();
  });

  it('throws error when decisions file is missing', () => {
    setVirtualFiles({});

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('Review decisions file not found');
  });

  it('skips pipeline when no decisions are accepted', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_b.png', verdict: 'reject' }]),
    });

    const result = promoteAssets({ rootDir: '.' });

    expect(result.promoted).toEqual([]);
    expect(result.skipped).toEqual(['assets/game/diff/beach_b.png']);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it('fails loudly if compress_assets.py fails', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
    });

    spawnOverrides.set('python3 tools/compress_assets.py', {
      status: 1,
      stderr: 'compress error',
    });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow(
      'Step failed (python3 tools/compress_assets.py exited with code 1)',
    );
  });

  it('fails loudly if gen_images_ts.mjs fails', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
    });

    spawnOverrides.set('node tools/gen_images_ts.mjs', {
      status: 1,
      stderr: 'gen manifest error',
    });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow(
      'Step failed (node tools/gen_images_ts.mjs exited with code 1)',
    );
  });

  it('fails loudly if artifact report is missing', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
      // No report file in virtualFiles!
    });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('Artifact report not found');
  });

  it('fails loudly if artifact re-scan detects findings in scan report for promoted asset', () => {
    const reportContent = JSON.stringify([
      {
        asset: 'diff/beach_a.png',
        kind: 'judged-artifact',
        rect: [0, 0, 50, 50],
      },
    ]);

    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
      'tools/audit_out/artifact_scan/artifact_report.json': reportContent,
    });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('Re-scan detected findings on promoted assets');
  });

  it('includes both stdout and stderr in step failure error message', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
    });

    spawnOverrides.set('python3 tools/compress_assets.py', {
      status: 1,
      stdout: 'failed step output',
      stderr: 'warning on stderr',
    });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow(
      'Step failed (python3 tools/compress_assets.py exited with code 1):\nstdout:\nfailed step output\nstderr:\nwarning on stderr',
    );
  });

  it('fails loudly if artifact re-scan detects findings on converted .jpg asset when candidate was .png', () => {
    const reportContent = JSON.stringify([
      {
        asset: 'diff/beach_a.jpg',
        kind: 'pair-identity',
        note: 'differing pixels outside rects',
      },
    ]);

    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
      'tools/audit_out/artifact_scan/artifact_report.json': reportContent,
    });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('Re-scan detected findings on promoted assets');
  });

  it('fails loudly if tsc fails', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
      'tools/audit_out/artifact_scan/artifact_report.json': '[]',
    });

    spawnOverrides.set('npx tsc', { status: 2, stderr: 'Type errors detected' });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('Step failed (npx tsc --noEmit exited with code 2)');
  });

  it('fails loudly if vitest fails', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
      'tools/audit_out/artifact_scan/artifact_report.json': '[]',
    });

    spawnOverrides.set('npx vitest', { status: 1, stderr: '1 test failed' });

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('Step failed (npx vitest run exited with code 1)');
  });

  it('fails loudly if child process encounters spawn error', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'cand data',
    });
    vi.mocked(childProcess.spawnSync).mockReturnValueOnce(
      makeSpawnResult({
        error: new Error('spawn ENOENT'),
        status: null,
      }),
    );

    expect(() => promoteAssets({ rootDir: '.' })).toThrow('spawn ENOENT');
  });
});

describe('CLI argument parsing and main() runner', () => {
  it('parses empty CLI arguments into undefined options', () => {
    expect(parseCliArgs([])).toEqual({
      decisionsFile: undefined,
      candidatesDir: undefined,
    });
  });

  it('parses positional decisions file and separated flags', () => {
    const args = ['custom_decisions.json', '--candidates-dir', 'custom_cands'];
    expect(parseCliArgs(args)).toEqual({
      decisionsFile: 'custom_decisions.json',
      candidatesDir: 'custom_cands',
    });
  });

  it('main() parses argv and executes promoteAssets', () => {
    setVirtualFiles({
      'custom_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'custom_candidates/assets/game/diff/beach_a.png': 'custom data',
      'tools/audit_out/artifact_scan/artifact_report.json': '[]',
    });

    const result = main(['custom_decisions.json', '--candidates-dir', 'custom_candidates'], '.');

    expect(result.promoted).toEqual(['assets/game/diff/beach_a.png']);
    const calls = vi
      .mocked(childProcess.spawnSync)
      .mock.calls.map(([cmd, args]) => `${cmd} ${Array.isArray(args) ? args.join(' ') : ''}`);
    expect(calls[0]).toBe('python3 tools/compress_assets.py');
  });

  it('main() uses default decisions file and candidates dir when flags are omitted', () => {
    setVirtualFiles({
      'review_decisions.json': JSON.stringify([{ path: 'assets/game/diff/beach_a.png', verdict: 'accept' }]),
      'tmp/candidates/assets/game/diff/beach_a.png': 'default candidate data',
      'tools/audit_out/artifact_scan/artifact_report.json': '[]',
    });

    const result = main([], '.');

    expect(result.promoted).toEqual(['assets/game/diff/beach_a.png']);
    const calls = vi
      .mocked(childProcess.spawnSync)
      .mock.calls.map(([cmd, args]) => `${cmd} ${Array.isArray(args) ? args.join(' ') : ''}`);
    expect(calls[0]).toBe('python3 tools/compress_assets.py');
  });
});
