/**
 * CLI helper to expose inventory and frame-selection logic to video runners.
 *
 * Usage:
 *   node_modules/.bin/jiti tools/review/videoHelper.ts inventory [root]
 *   node_modules/.bin/jiti tools/review/videoHelper.ts select-frames <jsonOptions>
 */

import * as fs from 'node:fs';
import * as process from 'node:process';
import { buildInventory, listMediaFiles, readCleanIds } from './inventory';
import { ffmpegSelectExpr, selectFrames, type SelectFramesOptions } from './videoFrames';

export function main(
  argv: string[] = process.argv.slice(2),
  readStdin: () => string = () => fs.readFileSync(0, 'utf-8'),
): void {
  const cmd = argv[0];
  if (cmd === 'inventory') {
    const root = argv[1] ?? process.cwd();
    const cleanIds = readCleanIds(root);
    const mediaFiles = listMediaFiles(root);
    const inventory = buildInventory(mediaFiles, cleanIds);
    const videoAssets = inventory.filter((a) => a.kind === 'video' && a.path.startsWith('public/'));
    process.stdout.write(JSON.stringify(videoAssets) + '\n');
  } else if (cmd === 'select-frames') {
    const jsonStr = argv[1] && argv[1] !== '-' ? argv[1] : readStdin();
    if (!jsonStr || !jsonStr.trim()) {
      throw new Error('select-frames requires JSON options argument or stdin payload');
    }
    const options: SelectFramesOptions = JSON.parse(jsonStr);
    const frames = selectFrames(options);
    const expr = ffmpegSelectExpr(frames);
    process.stdout.write(JSON.stringify({ frames, expr }) + '\n');
  } else {
    throw new Error(`Unknown command: ${cmd}`);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('videoHelper.ts')) {
  main();
}
