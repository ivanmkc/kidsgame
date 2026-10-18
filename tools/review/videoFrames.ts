/**
 * Pure frame-selection algorithms for video clip artifact sampling.
 */

export interface SelectFramesOptions {
  readonly frameCount: number;
  readonly fps: number;
  readonly diffScores?: readonly number[];
  readonly threshold?: number;
  readonly minGapSec?: number;
  readonly maxFrames?: number;
}

/**
 * Returns the timestamp in seconds for a given frame index and fps.
 */
export function frameTimeSec(frame: number, fps: number): number {
  if (!Number.isFinite(frame) || frame < 0) {
    throw new Error(`Invalid frame: ${frame}`);
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`Invalid fps: ${fps}`);
  }
  return frame / fps;
}

/**
 * Formats frame numbers into an ffmpeg select filter expression:
 * eq(n\,f0)+eq(n\,f1)+...
 */
export function ffmpegSelectExpr(frames: readonly number[]): string {
  if (!Array.isArray(frames)) {
    throw new Error('frames must be an array');
  }
  if (frames.length === 0) {
    return '';
  }
  for (const f of frames) {
    if (!Number.isInteger(f) || f < 0) {
      throw new Error(`Invalid frame number: ${f}`);
    }
  }
  return frames.map((f) => `eq(n\\,${f})`).join('+');
}

/**
 * Selects representative frames from a video clip.
 *
 * Always includes anchor frames: frame 0, middle (floor(frameCount / 2)),
 * and last (frameCount - 1).
 * Adds frames with diffScores[i] > threshold, merging close scene changes
 * (< minGapSec) where anchors and higher-scoring frames win, and capping
 * the total number of frames at maxFrames by keeping the highest-scoring
 * scene changes.
 *
 * Returns sorted, unique frame indices.
 */
export function selectFrames(options: SelectFramesOptions): number[] {
  const { frameCount, fps, diffScores = [], threshold = 0.3, minGapSec = 0.5, maxFrames = 8 } = options;

  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error(`Invalid frameCount: ${frameCount}`);
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`Invalid fps: ${fps}`);
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(`Invalid threshold: ${threshold}`);
  }
  if (!Number.isFinite(minGapSec) || minGapSec < 0) {
    throw new Error(`Invalid minGapSec: ${minGapSec}`);
  }
  if (!Number.isInteger(maxFrames) || maxFrames < 1) {
    throw new Error(`Invalid maxFrames: ${maxFrames}`);
  }

  const anchors = [0, Math.floor(frameCount / 2), frameCount - 1];
  const kept = new Set<number>(anchors);

  if (kept.size >= maxFrames || !diffScores || diffScores.length === 0) {
    return Array.from(kept).sort((a, b) => a - b);
  }

  const numScores = Math.min(diffScores.length, frameCount);
  const candidates: Array<{ frame: number; score: number }> = [];

  for (let i = 0; i < numScores; i++) {
    const score = diffScores[i];
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      throw new Error(`Invalid diffScore at index ${i}: ${score}`);
    }
    if (score > threshold && !kept.has(i)) {
      candidates.push({ frame: i, score });
    }
  }

  // Sort candidates by score descending; break ties by frame index ascending.
  candidates.sort((a, b) => b.score - a.score || a.frame - b.frame);

  for (const cand of candidates) {
    if (kept.size >= maxFrames) {
      break;
    }
    const candTime = frameTimeSec(cand.frame, fps);
    let tooClose = false;
    for (const keptFrame of kept) {
      const keptTime = frameTimeSec(keptFrame, fps);
      const gapSec = Math.abs(candTime - keptTime);
      if (minGapSec > 0 ? gapSec < minGapSec - 1e-9 : gapSec === 0) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      kept.add(cand.frame);
    }
  }

  return Array.from(kept).sort((a, b) => a - b);
}
