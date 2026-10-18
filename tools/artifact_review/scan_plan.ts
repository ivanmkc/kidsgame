import * as fs from 'node:fs';
import * as path from 'node:path';

export type Rect = [x0: number, y0: number, x1: number, y1: number];

export interface ScanAsset {
  path: string;
  kind: string;
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface ScanJob<T extends ScanAsset = ScanAsset> {
  asset: T;
  rect: Rect;
  tag: string;
}

export function jobTag(assetPath: string, tileIndex: number): string {
  const normalized = assetPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const sanitized = normalized.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitized}_${tileIndex}`;
}

export function planTiles(asset: { path: string; kind: string; width: number; height: number }): Rect[] {
  const { path: assetPath, kind, width, height } = asset;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid dimensions for asset ${assetPath}: ${width}x${height}`);
  }

  const normalizedKind = typeof kind === 'string' ? kind.toLowerCase().trim() : '';
  const longestSide = Math.max(width, height);

  if (longestSide <= 512 || normalizedKind === 'icon' || normalizedKind === 'sprite') {
    return [[0, 0, width, height]];
  }

  const cols = Math.max(1, Math.min(3, Math.floor(width / 256)));
  const rows = Math.max(1, Math.min(2, Math.floor(height / 256)));
  const overlap = 0.25;

  const tw = Math.floor(width / cols);
  const th = Math.floor(height / rows);
  const ox = Math.floor(tw * overlap);
  const oy = Math.floor(th * overlap);

  const rects: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.max(0, c * tw - ox);
      const y0 = Math.max(0, r * th - oy);
      const x1 = Math.min(width, (c + 1) * tw + ox);
      const y1 = Math.min(height, (r + 1) * th + oy);
      rects.push([x0, y0, x1, y1]);
    }
  }

  return rects;
}

export function planScanBatches<T extends ScanAsset>(assets: readonly T[], batchSize: number = 32): ScanJob<T>[][] {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid batchSize: ${batchSize}`);
  }

  const seenTags = new Set<string>();
  const batches: ScanJob<T>[][] = [];
  let currentBatch: ScanJob<T>[] = [];

  for (const asset of assets) {
    if (!asset || typeof asset.path !== 'string' || asset.path.trim() === '') {
      throw new Error(`Asset missing valid path: ${JSON.stringify(asset)}`);
    }

    const rects = planTiles(asset);
    const jobs: ScanJob<T>[] = rects.map((rect, idx) => {
      const tag = jobTag(asset.path, idx);
      if (seenTags.has(tag)) {
        throw new Error(`Duplicate scan tag ${tag} for ${asset.path}`);
      }
      seenTags.add(tag);
      return {
        asset,
        rect,
        tag,
      };
    });

    if (currentBatch.length > 0 && currentBatch.length + jobs.length > batchSize) {
      batches.push(currentBatch);
      currentBatch = [];
    }

    currentBatch.push(...jobs);
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function writeScanPlan<T extends ScanAsset>(
  assets: readonly T[],
  fileName: string = 'scan_plan.json',
  batchSize: number = 32,
  root: string = process.cwd(),
): string {
  if (!Array.isArray(assets)) {
    throw new Error('Expected assets to be an array');
  }

  const resolvedPath = path.resolve(root, 'tools', 'audit_out', fileName);
  const batches = planScanBatches(assets, batchSize);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(batches, null, 2) + '\n', 'utf-8');
  return resolvedPath;
}
