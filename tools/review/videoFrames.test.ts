import { describe, expect, it } from 'vitest';
import { ffmpegSelectExpr, frameTimeSec, selectFrames } from './videoFrames';

describe('frameTimeSec', () => {
  it('computes timestamp in seconds from frame number and fps', () => {
    expect(frameTimeSec(0, 30)).toBe(0);
    expect(frameTimeSec(15, 30)).toBe(0.5);
    expect(frameTimeSec(60, 30)).toBe(2);
    expect(frameTimeSec(120, 60)).toBe(2);
  });

  it('throws on invalid frame or fps', () => {
    expect(() => frameTimeSec(-1, 30)).toThrow();
    expect(() => frameTimeSec(0, 0)).toThrow();
    expect(() => frameTimeSec(0, -30)).toThrow();
    expect(() => frameTimeSec(NaN, 30)).toThrow();
  });
});

describe('ffmpegSelectExpr', () => {
  it('equals the select expression used in tools/gen_story_videos.py:66', () => {
    expect(ffmpegSelectExpr([0, 60, 115])).toBe('eq(n\\,0)+eq(n\\,60)+eq(n\\,115)');
  });

  it('handles single-frame and empty arrays', () => {
    expect(ffmpegSelectExpr([])).toBe('');
    expect(ffmpegSelectExpr([0])).toBe('eq(n\\,0)');
    expect(ffmpegSelectExpr([42])).toBe('eq(n\\,42)');
  });

  it('throws on invalid frame numbers', () => {
    expect(() => ffmpegSelectExpr([-1])).toThrow();
    expect(() => ffmpegSelectExpr([1.5])).toThrow();
  });
});

describe('selectFrames', () => {
  describe('short clips', () => {
    it('returns [0] without duplicates when frameCount is 1', () => {
      const result = selectFrames({ frameCount: 1, fps: 30 });
      expect(result).toEqual([0]);
    });

    it('returns [0, 1] without duplicates when frameCount is 2', () => {
      const result = selectFrames({ frameCount: 2, fps: 30 });
      expect(result).toEqual([0, 1]);
    });

    it('returns [0, 1, 2] when frameCount is 3', () => {
      const result = selectFrames({ frameCount: 3, fps: 30 });
      expect(result).toEqual([0, 1, 2]);
    });

    it('returns [0, 2, 4] when frameCount is 5', () => {
      const result = selectFrames({ frameCount: 5, fps: 30 });
      expect(result).toEqual([0, 2, 4]);
    });
  });

  describe('no scene changes', () => {
    it('returns first, middle, and last frame when diffScores is omitted', () => {
      const result = selectFrames({ frameCount: 120, fps: 30 });
      expect(result).toEqual([0, 60, 119]);
    });

    it('returns first, middle, and last frame when diffScores is empty', () => {
      const result = selectFrames({ frameCount: 120, fps: 30, diffScores: [] });
      expect(result).toEqual([0, 60, 119]);
    });

    it('returns first, middle, and last frame when all diffScores are below threshold', () => {
      const diffScores = Array.from({ length: 120 }, () => 0.1);
      const result = selectFrames({
        frameCount: 120,
        fps: 30,
        diffScores,
        threshold: 0.3,
      });
      expect(result).toEqual([0, 60, 119]);
    });
  });

  describe('min-gap merge', () => {
    it('drops candidates closer than minGapSec to an anchor frame (anchor wins)', () => {
      // Anchors for frameCount 120 are 0, 60, 119.
      // At fps=30 and minGapSec=0.5 (15 frames):
      // Frame 10 is 10/30 = 0.333s from anchor 0 (< 0.5s) -> dropped.
      // Frame 55 is 5/30 = 0.167s from anchor 60 (< 0.5s) -> dropped.
      // Frame 115 is 4/30 = 0.133s from anchor 119 (< 0.5s) -> dropped.
      // Frame 30 is 30/30 = 1.0s from 0 and 60 (>= 0.5s) -> kept.
      const diffScores = Array.from({ length: 120 }, () => 0);
      diffScores[10] = 0.9;
      diffScores[55] = 0.9;
      diffScores[115] = 0.9;
      diffScores[30] = 0.8;

      const result = selectFrames({
        frameCount: 120,
        fps: 30,
        diffScores,
        minGapSec: 0.5,
      });

      expect(result).toEqual([0, 30, 60, 119]);
    });

    it('merges close scene changes keeping the strongest', () => {
      // Two scene changes close to each other: frame 30 (score 0.5) and frame 33 (score 0.9).
      // They are 3 frames apart = 0.1s < 0.5s.
      // Frame 33 has the higher score, so it should be kept and frame 30 dropped.
      const diffScores = Array.from({ length: 120 }, () => 0);
      diffScores[30] = 0.5;
      diffScores[33] = 0.9;

      const result = selectFrames({
        frameCount: 120,
        fps: 30,
        diffScores,
        minGapSec: 0.5,
      });

      expect(result).toEqual([0, 33, 60, 119]);
    });

    it('merges multi-frame transition burst into the peak frame', () => {
      const diffScores = Array.from({ length: 120 }, () => 0);
      diffScores[29] = 0.4;
      diffScores[30] = 0.85;
      diffScores[31] = 0.5;

      const result = selectFrames({
        frameCount: 120,
        fps: 30,
        diffScores,
        minGapSec: 0.5,
      });

      expect(result).toEqual([0, 30, 60, 119]);
    });
  });

  describe('maxFrames cap', () => {
    it('caps the total result at maxFrames by keeping highest-scoring scene changes', () => {
      // Anchors: 0, 60, 119 (3 frames).
      // maxFrames = 5 allows 2 scene changes.
      // Candidates far from anchors and each other:
      // frame 20 (score 0.95), frame 40 (score 0.70), frame 80 (score 0.85), frame 100 (score 0.60).
      // Top 2 are frame 20 (0.95) and frame 80 (0.85).
      const diffScores = Array.from({ length: 120 }, () => 0);
      diffScores[20] = 0.95;
      diffScores[40] = 0.7;
      diffScores[80] = 0.85;
      diffScores[100] = 0.6;

      const result = selectFrames({
        frameCount: 120,
        fps: 30,
        diffScores,
        maxFrames: 5,
        minGapSec: 0.5,
      });

      expect(result).toEqual([0, 20, 60, 80, 119]);
      expect(result.length).toBe(5);
    });

    it('always preserves all anchor frames even if maxFrames is less than anchor count', () => {
      const result = selectFrames({
        frameCount: 120,
        fps: 30,
        maxFrames: 2,
      });

      expect(result).toEqual([0, 60, 119]);
    });
  });

  describe('validation', () => {
    it('validates frameCount, fps, threshold, and maxFrames', () => {
      expect(() => selectFrames({ frameCount: 0, fps: 30 })).toThrow();
      expect(() => selectFrames({ frameCount: -5, fps: 30 })).toThrow();
      expect(() => selectFrames({ frameCount: 1.5, fps: 30 })).toThrow();
      expect(() => selectFrames({ frameCount: 10, fps: 0 })).toThrow();
      expect(() => selectFrames({ frameCount: 10, fps: -1 })).toThrow();
      expect(() => selectFrames({ frameCount: 10, fps: 30, threshold: -0.1 })).toThrow();
      expect(() => selectFrames({ frameCount: 10, fps: 30, maxFrames: 0 })).toThrow();
      expect(() => selectFrames({ frameCount: 10, fps: 30, minGapSec: -1 })).toThrow();
      expect(() => selectFrames({ frameCount: 10, fps: 30, diffScores: [NaN] })).toThrow();
    });
  });
});
