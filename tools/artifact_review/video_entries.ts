import type { ReviewEntry, ReviewFinding } from '../review/findings';
import { buildInventory } from '../review/inventory';

export interface FrameJudgeResult {
  clip: string;
  frameIndex: number;
  timeSec: number;
  thumb: string;
  flagged: boolean;
  reason?: string;
}

export interface VideoEntriesOptions {
  readonly allowedFrames: (clip: string) => ReadonlySet<number> | undefined;
  readonly cleanIds?: ReadonlySet<string>;
}

export function videoFramesToEntries(
  results: readonly FrameJudgeResult[],
  options: VideoEntriesOptions,
): ReviewEntry[] {
  if (!Array.isArray(results)) {
    throw new Error('results must be an array');
  }

  const clipMap = new Map<string, FrameJudgeResult[]>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result || typeof result !== 'object') {
      throw new Error(`Invalid result at index ${i}: expected an object`);
    }
    if (typeof result.clip !== 'string' || result.clip.trim() === '') {
      throw new Error(`Invalid result at index ${i}: clip must be a non-empty string`);
    }
    if (!Number.isInteger(result.frameIndex) || result.frameIndex < 0) {
      throw new Error(`Invalid frameIndex at index ${i}: ${result.frameIndex}`);
    }
    if (typeof result.timeSec !== 'number' || !Number.isFinite(result.timeSec) || result.timeSec < 0) {
      throw new Error(`Invalid timeSec at index ${i}: ${result.timeSec}`);
    }
    if (typeof result.thumb !== 'string' || result.thumb.trim() === '') {
      throw new Error(`Invalid thumb at index ${i}: "${result.thumb}"`);
    }
    if (typeof result.flagged !== 'boolean') {
      throw new Error(`Invalid flagged value at index ${i}: expected boolean`);
    }

    const clipKey = result.clip.trim();
    let list = clipMap.get(clipKey);
    if (!list) {
      list = [];
      clipMap.set(clipKey, list);
    }
    list.push(result);
  }

  const entries: ReviewEntry[] = [];

  for (const [clip, clipResults] of clipMap.entries()) {
    const allowed = options.allowedFrames(clip);
    if (!allowed) {
      throw new Error(`Frame selection could not be resolved for clip "${clip}"`);
    }

    const seenFrames = new Set<number>();
    for (const r of clipResults) {
      if (seenFrames.has(r.frameIndex)) {
        throw new Error(`Duplicate frameIndex ${r.frameIndex} for clip "${clip}"`);
      }
      seenFrames.add(r.frameIndex);

      if (!allowed.has(r.frameIndex)) {
        throw new Error(
          `Frame index ${r.frameIndex} was not selected by the frame-selection function for clip "${clip}"`,
        );
      }
    }

    const flagged = clipResults.filter((r) => r.flagged);
    if (flagged.length === 0) continue;

    flagged.sort((a, b) => a.timeSec - b.timeSec || a.frameIndex - b.frameIndex);

    const asset = buildInventory([clip], options.cleanIds ?? new Set())[0];
    if (!asset) {
      throw new Error(`Failed to build media asset for clip "${clip}"`);
    }

    const findings: ReviewFinding[] = flagged.map((f) => {
      const reason = f.reason?.trim();
      return {
        source: 'video',
        category: reason || 'judged-artifact',
        severity: 2,
        assetPath: asset.path,
        dirPath: null,
        surface: null,
        rect: null,
        evidence: f.thumb,
        note: reason ? `t=${f.timeSec}s: ${reason}` : `t=${f.timeSec}s`,
      };
    });

    entries.push({
      asset,
      findings,
      maxSeverity: 2,
    });
  }

  entries.sort((a, b) => {
    if (b.maxSeverity !== a.maxSeverity) {
      return b.maxSeverity - a.maxSeverity;
    }
    return a.asset.path < b.asset.path ? -1 : a.asset.path > b.asset.path ? 1 : 0;
  });

  return entries;
}
