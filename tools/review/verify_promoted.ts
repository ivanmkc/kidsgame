import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseReviewDecisions, runStep, detectScanFindings } from './promote';
import { parseScanReport, parseLoopFindings } from './findings';
import { main as makeScanPlan } from '../artifact_review/make_scan_plan';

export function main(argv = process.argv.slice(2), rootDir = process.cwd()): void {
  let decisionsFile = 'review_decisions.json';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--decisions' && i + 1 < argv.length) {
      decisionsFile = argv[++i];
    }
  }

  const decPath = path.isAbsolute(decisionsFile) ? decisionsFile : path.join(rootDir, decisionsFile);
  if (!fs.existsSync(decPath)) throw new Error(`Review decisions file not found: ${decPath}`);

  const decisions = parseReviewDecisions(fs.readFileSync(decPath, 'utf-8'));
  const acceptedPaths: string[] = [];

  for (const d of decisions) {
    if (d.verdict.toLowerCase() === 'accept') {
      acceptedPaths.push(d.path);
    }
  }

  const scanOutDir = 'tools/audit_out/artifact_scan';
  const planStatus = makeScanPlan(rootDir);
  if (planStatus !== 0) {
    throw new Error(`makeScanPlan failed with status ${planStatus}`);
  }
  runStep('python3', ['tools/artifact_scan.py', '--out', scanOutDir], rootDir);

  const videoScanOutJson = 'tools/audit_out/video_artifact_scan/video_artifact_report.json';
  const videoScanOutDir = path.dirname(videoScanOutJson);
  fs.mkdirSync(path.join(rootDir, videoScanOutDir), { recursive: true });
  runStep('python3', ['tools/video_artifact_scan.py', '--output', videoScanOutJson], rootDir);

  const reportPath = path.join(rootDir, scanOutDir, 'artifact_report.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Artifact report not found: ${reportPath}`);
  }

  const rawScan = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const scanFindings = parseScanReport(rawScan).findings;

  const videoReportPath = path.join(rootDir, videoScanOutJson);
  if (!fs.existsSync(videoReportPath)) {
    throw new Error(`Video artifact report not found: ${videoReportPath}`);
  }
  const rawVideo = JSON.parse(fs.readFileSync(videoReportPath, 'utf-8'));
  const videoFindings = parseLoopFindings(rawVideo).findings;

  const issues: string[] = detectScanFindings(acceptedPaths, [...scanFindings, ...videoFindings]);

  if (issues.length > 0) {
    throw new Error(`Re-scan detected findings on accepted assets:\n${issues.join('\n')}`);
  }

  runStep('npx', ['vitest', 'run', '--passWithNoTests'], rootDir);
  runStep('npx', ['tsc', '--noEmit'], rootDir);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('verify_promoted.ts')) {
  main();
}
