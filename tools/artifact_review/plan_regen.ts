import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildRegenQueue, formatPlan, type VerdictExport } from './regen_queue';

export function main(argv: string[] = process.argv.slice(2), cwd: string = process.cwd()): number {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: node tools/artifact_review/plan_regen.ts <verdicts.json>');
    return 0;
  }

  const verdictsFile = argv[0];
  const filePath = path.resolve(cwd, verdictsFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: verdicts file not found: ${filePath}`);
    return 1;
  }

  const verdicts = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as VerdictExport;
  const plan = buildRegenQueue(verdicts);
  console.log(formatPlan(plan));
  return 0;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('plan_regen.ts')) {
  process.exit(main());
}
