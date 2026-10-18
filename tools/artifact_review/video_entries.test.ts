import { describe, expect, it } from 'vitest';
import type { ReviewEntry } from '../review/findings';
import { selectFrames } from '../review/videoFrames';
import { type FrameJudgeResult, videoFramesToEntries, type VideoEntriesOptions } from './video_entries';

describe('videoFramesToEntries', () => {
  it('maps fake results with two clips (one with two flagged frames, one clean) to exactly one entry in time order', () => {
    const fakeResults: FrameJudgeResult[] = [
      // Clean clip: all clean
      {
        clip: 'public/story-video/clean_clip.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 'thumbs/clean_f0.png',
        flagged: false,
      },
      {
        clip: 'public/story-video/clean_clip.mp4',
        frameIndex: 60,
        timeSec: 2.0,
        thumb: 'thumbs/clean_f60.png',
        flagged: false,
      },
      {
        clip: 'public/story-video/clean_clip.mp4',
        frameIndex: 119,
        timeSec: 3.96,
        thumb: 'thumbs/clean_f119.png',
        flagged: false,
      },
      // Flagged clip: provided deliberately out of time order to test sorting
      {
        clip: 'public/story-video/flagged_clip.mp4',
        frameIndex: 119,
        timeSec: 3.96,
        thumb: 'thumbs/flagged_f119.png',
        flagged: true,
        reason: 'distorted hand',
      },
      {
        clip: 'public/story-video/flagged_clip.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 'thumbs/flagged_f0.png',
        flagged: false,
      },
      {
        clip: 'public/story-video/flagged_clip.mp4',
        frameIndex: 60,
        timeSec: 2.0,
        thumb: 'thumbs/flagged_f60.png',
        flagged: true,
        reason: 'face warp',
      },
    ];

    const allowed = new Set([0, 60, 119]);
    const options: VideoEntriesOptions = {
      allowedFrames: () => allowed,
    };
    const entries = videoFramesToEntries(fakeResults, options);

    // Exactly one entry produced
    expect(entries).toHaveLength(1);
    const entry: ReviewEntry = entries[0];

    // Findings list both flagged frames in time order
    expect(entry.findings).toEqual([
      {
        source: 'video',
        category: 'face warp',
        severity: 2,
        assetPath: 'public/story-video/flagged_clip.mp4',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: 'thumbs/flagged_f60.png',
        note: 't=2s: face warp',
      },
      {
        source: 'video',
        category: 'distorted hand',
        severity: 2,
        assetPath: 'public/story-video/flagged_clip.mp4',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: 'thumbs/flagged_f119.png',
        note: 't=3.96s: distorted hand',
      },
    ]);
  });

  it('passes the Fc094f3 review-entry type check with asset.kind "video" and clip path as asset.path', () => {
    const fakeResults: FrameJudgeResult[] = [
      {
        clip: 'public/story-video/acorn_jump_0.mp4',
        frameIndex: 60,
        timeSec: 2.0,
        thumb: 'thumbs/acorn_60.png',
        flagged: true,
        reason: 'artifact distortion',
      },
    ];

    const entries: ReviewEntry[] = videoFramesToEntries(fakeResults, {
      allowedFrames: () => new Set([60]),
    });
    expect(entries).toHaveLength(1);

    const entry = entries[0];

    // Passes Fc094f3 review-entry type check & properties
    expect(entry.asset).toBeDefined();
    expect(entry.asset.path).toBe('public/story-video/acorn_jump_0.mp4');
    expect(entry.asset.kind).toBe('video');
    expect(entry.asset.game).toBe('story-video');
    expect(entry.asset.group).toBe('acorn');
    expect(entry.maxSeverity).toBe(2);

    expect(entry.findings).toHaveLength(1);
    expect(entry.findings[0]).toEqual({
      source: 'video',
      category: 'artifact distortion',
      severity: 2,
      assetPath: 'public/story-video/acorn_jump_0.mp4',
      dirPath: null,
      surface: null,
      rect: null,
      evidence: 'thumbs/acorn_60.png',
      note: 't=2s: artifact distortion',
    });
  });

  it('rejects a result whose frameIndex was not selected by the frame-selection function', () => {
    // selectFrames with frameCount: 120, fps: 30 picks [0, 60, 119]
    const fakeResults: FrameJudgeResult[] = [
      {
        clip: 'public/story-video/stray_frame.mp4',
        frameIndex: 42, // Not in [0, 60, 119]
        timeSec: 1.4,
        thumb: 'thumbs/f42.png',
        flagged: true,
      },
    ];

    const selected = new Set(selectFrames({ frameCount: 120, fps: 30 }));
    expect(() =>
      videoFramesToEntries(fakeResults, {
        allowedFrames: () => selected,
      }),
    ).toThrow(/Frame index 42 was not selected by the frame-selection function/);
  });

  it('fails loudly when frame selection cannot be resolved for a clip', () => {
    const fakeResults: FrameJudgeResult[] = [
      {
        clip: 'public/story-video/sample.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 'thumb.png',
        flagged: true,
      },
    ];

    expect(() =>
      videoFramesToEntries(fakeResults, {
        allowedFrames: () => undefined,
      }),
    ).toThrow(/Frame selection could not be resolved for clip "public\/story-video\/sample\.mp4"/);
  });

  it('produces no entry when all clips are clean', () => {
    const allClean: FrameJudgeResult[] = [
      {
        clip: 'public/story-video/a.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 'a0.png',
        flagged: false,
      },
      {
        clip: 'public/story-video/b.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 'b0.png',
        flagged: false,
      },
    ];

    const entries = videoFramesToEntries(allClean, {
      allowedFrames: () => new Set([0]),
    });
    expect(entries).toEqual([]);
  });

  it('returns an empty array on empty results', () => {
    expect(
      videoFramesToEntries([], {
        allowedFrames: () => new Set(),
      }),
    ).toEqual([]);
  });

  it('fails loudly on invalid inputs or malformed records', () => {
    const validOpts = { allowedFrames: () => new Set([0]) };

    expect(() => videoFramesToEntries(null as unknown as FrameJudgeResult[], validOpts)).toThrow();
    expect(() => videoFramesToEntries(undefined as unknown as FrameJudgeResult[], validOpts)).toThrow();
    expect(() => videoFramesToEntries('not-an-array' as unknown as FrameJudgeResult[], validOpts)).toThrow();

    expect(() =>
      videoFramesToEntries(
        [
          {
            clip: '',
            frameIndex: 0,
            timeSec: 0.0,
            thumb: 't.png',
            flagged: true,
          },
        ],
        validOpts,
      ),
    ).toThrow(/clip/);

    expect(() =>
      videoFramesToEntries(
        [
          {
            clip: 'clip.mp4',
            frameIndex: -1,
            timeSec: 0.0,
            thumb: 't.png',
            flagged: true,
          },
        ],
        validOpts,
      ),
    ).toThrow(/frameIndex/);

    expect(() =>
      videoFramesToEntries(
        [
          {
            clip: 'clip.mp4',
            frameIndex: 0,
            timeSec: -1,
            thumb: 't.png',
            flagged: true,
          },
        ],
        validOpts,
      ),
    ).toThrow(/timeSec/);

    expect(() =>
      videoFramesToEntries(
        [
          {
            clip: 'clip.mp4',
            frameIndex: 0,
            timeSec: 0.0,
            thumb: '',
            flagged: true,
          },
        ],
        validOpts,
      ),
    ).toThrow(/thumb/);

    expect(() =>
      videoFramesToEntries(
        [
          {
            clip: 'clip.mp4',
            frameIndex: 0,
            timeSec: 0.0,
            thumb: 't.png',
            flagged: 'yes' as unknown as boolean,
          },
        ],
        validOpts,
      ),
    ).toThrow(/flagged/);
  });

  it('fails loudly on duplicate frame indices for the same clip', () => {
    const duplicates: FrameJudgeResult[] = [
      {
        clip: 'clip.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 't0.png',
        flagged: false,
      },
      {
        clip: 'clip.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 't0_dup.png',
        flagged: true,
      },
    ];

    expect(() =>
      videoFramesToEntries(duplicates, {
        allowedFrames: () => new Set([0]),
      }),
    ).toThrow(/Duplicate frameIndex 0/);
  });

  it('orders multiple flagged clips alphabetically by asset path', () => {
    const results: FrameJudgeResult[] = [
      {
        clip: 'public/story-video/zebra.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 'z0.png',
        flagged: true,
      },
      {
        clip: 'public/story-video/bear.mp4',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 'b0.png',
        flagged: true,
      },
    ];

    const entries = videoFramesToEntries(results, {
      allowedFrames: () => new Set([0]),
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].asset.path).toBe('public/story-video/bear.mp4');
    expect(entries[1].asset.path).toBe('public/story-video/zebra.mp4');
  });

  it('fails loudly when buildInventory cannot resolve media asset for invalid clip extension', () => {
    const fakeResults: FrameJudgeResult[] = [
      {
        clip: 'public/story-video/invalid_ext.txt',
        frameIndex: 0,
        timeSec: 0.0,
        thumb: 't0.png',
        flagged: true,
      },
    ];

    expect(() =>
      videoFramesToEntries(fakeResults, {
        allowedFrames: () => new Set([0]),
      }),
    ).toThrow(/Failed to build media asset/);
  });
});
