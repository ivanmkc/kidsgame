/**
 * Run with:
 *   node_modules/.bin/jiti tools/review/build_review.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { attachFindings, parseLoopFindings, parseScanReport, type ReviewFinding } from './findings';
import { buildInventory, listMediaFiles, readCleanIds } from './inventory';
import { renderReviewPage } from './page';

export function main(argv: string[] = process.argv.slice(2), root: string = process.cwd()): string {
  let scanFile: string | undefined;
  let loopFile: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--scan' && i + 1 < argv.length) {
      scanFile = argv[++i];
    } else if (arg.startsWith('--scan=')) {
      scanFile = arg.slice('--scan='.length);
    } else if (arg === '--loop' && i + 1 < argv.length) {
      loopFile = argv[++i];
    } else if (arg.startsWith('--loop=')) {
      loopFile = arg.slice('--loop='.length);
    }
  }

  const cleanIds = readCleanIds(root);
  const mediaFiles = listMediaFiles(root);
  const inventory = buildInventory(mediaFiles, cleanIds);

  const findings: ReviewFinding[] = [];
  let totalRejected = 0;

  if (scanFile !== undefined) {
    const scanPath = path.resolve(root, scanFile);
    const raw = JSON.parse(fs.readFileSync(scanPath, 'utf-8'));
    const res = parseScanReport(raw);
    for (const f of res.findings) {
      if (f.evidence && !/^(https?:|\/\/|data:)/.test(f.evidence)) {
        f.evidence = path.relative(root, path.resolve(path.dirname(scanPath), f.evidence)).replace(/\\/g, '/');
      }
    }
    findings.push(...res.findings);
    totalRejected += res.rejected;
  }

  if (loopFile !== undefined) {
    const loopPath = path.resolve(root, loopFile);
    const raw = JSON.parse(fs.readFileSync(loopPath, 'utf-8'));
    const res = parseLoopFindings(raw);
    for (const f of res.findings) {
      if (f.evidence && !/^(https?:|\/\/|data:)/.test(f.evidence)) {
        f.evidence = path.relative(root, path.resolve(path.dirname(loopPath), f.evidence)).replace(/\\/g, '/');
      }
    }
    findings.push(...res.findings);
    totalRejected += res.rejected;
  }

  const { entries, dirFindings, unmatched } = attachFindings(inventory, findings);

  for (const entry of entries) {
    const candidateFullPath = path.join(root, 'tmp', 'candidates', entry.asset.path);
    if (fs.existsSync(candidateFullPath)) {
      entry.candidatePath = path.join('tmp', 'candidates', entry.asset.path).replace(/\\/g, '/');
    }
  }

  if (totalRejected > 0) {
    console.error(`Rejected ${totalRejected} malformed finding(s)`);
  }
  if (unmatched.length > 0) {
    console.error(`Unmatched ${unmatched.length} finding(s)`);
  }

  const outDir = path.join(root, 'tools', 'audit_out', 'review');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'index.html');

  const assetHref = (repoPath: string) => {
    if (/^(https?:|\/\/|data:)/.test(repoPath)) return repoPath;
    return path.relative(outDir, path.join(root, repoPath)).split(path.sep).join('/');
  };

  const html = renderReviewPage({ entries, dirFindings, unmatched, rejectedCount: totalRejected }, { assetHref });
  fs.writeFileSync(outPath, html, 'utf-8');
  return outPath;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('build_review.ts')) {
  main(process.argv.slice(2), process.cwd());
}
