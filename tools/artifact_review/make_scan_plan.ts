import { spawnSync } from 'node:child_process';
import { listMediaFiles, readCleanIds, buildInventory } from '../review/inventory';
import { writeScanPlan, type ScanAsset } from './scan_plan';

export function getDimensions(
  paths: string[],
  cwd: string = process.cwd(),
): Record<string, { width: number; height: number }> {
  const pythonScript = `
import sys, json
from PIL import Image

results = {}
for p in sys.stdin.read().splitlines():
    if not p: continue
    with Image.open(p) as img:
        results[p] = {"width": img.width, "height": img.height}
print(json.dumps(results))
`;

  const result = spawnSync('python3', ['-c', pythonScript], {
    input: paths.join('\n'),
    encoding: 'utf-8',
    cwd,
  });

  if (result.error) {
    throw new Error(`Failed to execute python3: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Python script failed with status ${result.status}: ${result.stderr}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (e) {
    throw new Error(`Failed to parse Python script output: ${String(e)}`);
  }
  return parsed as Record<string, { width: number; height: number }>;
}

export function main(cwd: string = process.cwd()): number {
  try {
    const cleanIds = readCleanIds(cwd);
    const mediaFiles = listMediaFiles(cwd);
    const inventory = buildInventory(mediaFiles, cleanIds);

    const images = inventory.filter((asset) => asset.kind === 'image');
    const paths = images.map((asset) => asset.path);

    const dimensions = getDimensions(paths, cwd);

    const scanAssets: ScanAsset[] = [];
    for (const asset of images) {
      const dim = dimensions[asset.path];
      if (!dim) {
        throw new Error(`No dimensions returned for ${asset.path}`);
      }
      scanAssets.push({
        path: asset.path,
        kind: asset.kind,
        width: dim.width,
        height: dim.height,
      });
    }

    const outPath = writeScanPlan(scanAssets, 'scan_plan.json', 32, cwd);
    console.log(`Wrote scan plan to ${outPath} with ${scanAssets.length} assets`);
    return 0;
  } catch (error) {
    console.error(String(error));
    return 1;
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('make_scan_plan.ts')) {
  process.exit(main());
}
