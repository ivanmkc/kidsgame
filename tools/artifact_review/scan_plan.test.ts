import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { jobTag, planScanBatches, planTiles, writeScanPlan, type Rect, type ScanAsset } from './scan_plan';

describe('planTiles', () => {
  it('gives a 128x128 icon exactly one tile covering the whole image', () => {
    const icon: ScanAsset = {
      path: 'assets/game/spotit/dog.png',
      kind: 'icon',
      width: 128,
      height: 128,
    };
    const rects = planTiles(icon);
    expect(rects).toEqual([[0, 0, 128, 128]]);
  });

  it('gives a 1536x1024 scene the same 6 overlapping rects as artifact_scan.py tiles()', () => {
    const scene: ScanAsset = {
      path: 'assets/game/diff/aquarium_base.png',
      kind: 'scene',
      width: 1536,
      height: 1024,
    };
    const rects = planTiles(scene);
    const expectedRects: Rect[] = [
      [0, 0, 640, 640],
      [384, 0, 1152, 640],
      [896, 0, 1536, 640],
      [0, 384, 640, 1024],
      [384, 384, 1152, 1024],
      [896, 384, 1536, 1024],
    ];
    expect(rects).toEqual(expectedRects);
  });

  it('gives whole-image tiles to images whose longest side is at most 512 px', () => {
    const uiAsset: ScanAsset = {
      path: 'assets/game/ui/btn_next.png',
      kind: 'ui',
      width: 256,
      height: 128,
    };
    expect(planTiles(uiAsset)).toEqual([[0, 0, 256, 128]]);

    const thumbAsset: ScanAsset = {
      path: 'assets/game/diff/aquarium_base_thumb.jpg',
      kind: 'thumb',
      width: 384,
      height: 256,
    };
    expect(planTiles(thumbAsset)).toEqual([[0, 0, 384, 256]]);

    const smallScene: ScanAsset = {
      path: 'assets/game/diff/small.png',
      kind: 'scene',
      width: 512,
      height: 512,
    };
    expect(planTiles(smallScene)).toEqual([[0, 0, 512, 512]]);
  });

  it('gives whole-image tiles to icons and sprites even when larger than 512 px', () => {
    const bigIcon: ScanAsset = {
      path: 'assets/game/icons/big_icon.png',
      kind: 'icon',
      width: 600,
      height: 600,
    };
    expect(planTiles(bigIcon)).toEqual([[0, 0, 600, 600]]);

    const bigSprite: ScanAsset = {
      path: 'assets/game/sprites/character.png',
      kind: 'sprite',
      width: 700,
      height: 550,
    };
    expect(planTiles(bigSprite)).toEqual([[0, 0, 700, 550]]);
  });

  it('sizes grids for larger images so no tile is under 256 px, capped at 3x2 with 25% overlap', () => {
    // 600x400 scene -> cols: floor(600/256)=2, rows: floor(400/256)=1
    const scene2x1: ScanAsset = {
      path: 'assets/game/diff/scene_600x400.png',
      kind: 'scene',
      width: 600,
      height: 400,
    };
    const rects2x1 = planTiles(scene2x1);
    expect(rects2x1).toEqual([
      [0, 0, 375, 400],
      [225, 0, 600, 400],
    ]);

    // 600x600 scene -> cols: 2, rows: 2
    const scene2x2: ScanAsset = {
      path: 'assets/game/diff/scene_600x600.png',
      kind: 'scene',
      width: 600,
      height: 600,
    };
    const rects2x2 = planTiles(scene2x2);
    expect(rects2x2).toHaveLength(4);
    for (const [x0, y0, x1, y1] of rects2x2) {
      expect(x1 - x0).toBeGreaterThanOrEqual(256);
      expect(y1 - y0).toBeGreaterThanOrEqual(256);
    }

    // 2000x1200 scene -> capped at 3x2
    const sceneHuge: ScanAsset = {
      path: 'assets/game/diff/scene_huge.png',
      kind: 'scene',
      width: 2000,
      height: 1200,
    };
    const rectsHuge = planTiles(sceneHuge);
    expect(rectsHuge).toHaveLength(6);
    for (const [x0, y0, x1, y1] of rectsHuge) {
      expect(x1 - x0).toBeGreaterThanOrEqual(256);
      expect(y1 - y0).toBeGreaterThanOrEqual(256);
    }

    // Tall banner: 200x600 image -> cols: 1, rows: 2
    const tallAsset: ScanAsset = {
      path: 'assets/game/ui/banner.png',
      kind: 'ui',
      width: 200,
      height: 600,
    };
    const rectsTall = planTiles(tallAsset);
    expect(rectsTall).toEqual([
      [0, 0, 200, 375],
      [0, 225, 200, 600],
    ]);
  });

  it('fails loudly when dimensions are non-positive or non-finite', () => {
    expect(() => planTiles({ path: 'test.png', kind: 'scene', width: 0, height: 100 })).toThrowError(
      /Invalid dimensions/,
    );
    expect(() => planTiles({ path: 'test.png', kind: 'scene', width: 100, height: -5 })).toThrowError(
      /Invalid dimensions/,
    );
    expect(() =>
      planTiles({
        path: 'test.png',
        kind: 'scene',
        width: Number.NaN,
        height: 100,
      }),
    ).toThrowError(/Invalid dimensions/);
  });
});

describe('jobTag', () => {
  it('generates a stable, unique, filesystem-safe tag from path and tile index', () => {
    expect(jobTag('assets/game/spotit/dog.png', 0)).toBe('assets_game_spotit_dog_png_0');
    expect(jobTag('diff/aquarium_base.png', 3)).toBe('diff_aquarium_base_png_3');
    expect(jobTag('./public/escape/key.png', 1)).toBe('public_escape_key_png_1');
  });
});

describe('planScanBatches', () => {
  const mixedFixtures: ScanAsset[] = [
    {
      path: 'assets/game/spotit/dog.png',
      kind: 'icon',
      width: 128,
      height: 128,
    },
    {
      path: 'assets/game/spotit/cat.png',
      kind: 'icon',
      width: 128,
      height: 128,
    },
    {
      path: 'assets/game/diff/aquarium_base.png',
      kind: 'scene',
      width: 1536,
      height: 1024,
    },
    {
      path: 'assets/game/diff/bakery_base.png',
      kind: 'scene',
      width: 1536,
      height: 1024,
    },
    { path: 'assets/game/ui/start.png', kind: 'ui', width: 300, height: 100 },
    {
      path: 'assets/game/rhyme/sheep.png',
      kind: 'sprite',
      width: 600,
      height: 400,
    },
    {
      path: 'assets/game/diff/beach_base.png',
      kind: 'scene',
      width: 1536,
      height: 1024,
    },
    {
      path: 'assets/game/story/luna_start_thumb.jpg',
      kind: 'thumb',
      width: 400,
      height: 225,
    },
  ];

  it('guarantees every asset gets at least one tile across a mixed fixture list', () => {
    const batches = planScanBatches(mixedFixtures, 4);
    const jobs = batches.flat();

    for (const asset of mixedFixtures) {
      const assetJobs = jobs.filter((j) => j.asset.path === asset.path);
      expect(assetJobs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('guarantees all tags are unique across the entire plan', () => {
    const batches = planScanBatches(mixedFixtures, 4);
    const jobs = batches.flat();
    const tags = jobs.map((j) => j.tag);
    const uniqueTags = new Set(tags);
    expect(uniqueTags.size).toBe(jobs.length);
  });

  it("guarantees no asset's tiles are split across batches", () => {
    const batches = planScanBatches(mixedFixtures, 4);

    for (const asset of mixedFixtures) {
      const batchIndices = batches
        .map((batch, idx) => (batch.some((j) => j.asset.path === asset.path) ? idx : -1))
        .filter((idx) => idx !== -1);
      expect(batchIndices.length).toBe(1);
    }
  });

  it('satisfies the coverage-count check: distinct assets equals input list length', () => {
    const batches = planScanBatches(mixedFixtures, 4);
    const distinctAssets = new Set(batches.flat().map((j) => j.asset.path));
    expect(distinctAssets.size).toBe(mixedFixtures.length);

    const distinctAssetObjects = new Set(batches.flat().map((j) => j.asset));
    expect(distinctAssetObjects.size).toBe(mixedFixtures.length);
  });

  it('keeps all tiles together even when an asset has more tiles than batchSize', () => {
    const sceneAsset: ScanAsset = {
      path: 'assets/game/diff/aquarium_base.png',
      kind: 'scene',
      width: 1536,
      height: 1024,
    };
    const iconAsset: ScanAsset = {
      path: 'assets/game/spotit/dog.png',
      kind: 'icon',
      width: 128,
      height: 128,
    };

    // batchSize 2, but scene has 6 tiles
    const batches = planScanBatches([sceneAsset, iconAsset], 2);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(6);
    expect(batches[0].every((j) => j.asset.path === sceneAsset.path)).toBe(true);
    expect(batches[1]).toHaveLength(1);
    expect(batches[1][0].asset.path === iconAsset.path).toBe(true);
  });

  it('returns an empty array when given an empty asset list', () => {
    expect(planScanBatches([], 4)).toEqual([]);
  });

  it('fails loudly when batchSize is non-positive or non-finite', () => {
    expect(() => planScanBatches(mixedFixtures, 0)).toThrowError(/Invalid batchSize/);
    expect(() => planScanBatches(mixedFixtures, -2)).toThrowError(/Invalid batchSize/);
    expect(() => planScanBatches(mixedFixtures, Number.NaN)).toThrowError(/Invalid batchSize/);
  });

  it('fails loudly when two assets produce colliding tags', () => {
    const collidingAssets: ScanAsset[] = [
      {
        path: 'assets/game/diff/a_b.png',
        kind: 'icon',
        width: 128,
        height: 128,
      },
      {
        path: 'assets/game/diff/a/b.png',
        kind: 'icon',
        width: 128,
        height: 128,
      },
    ];
    expect(() => planScanBatches(collidingAssets, 4)).toThrowError(
      /Duplicate scan tag assets_game_diff_a_b_png_0 for assets\/game\/diff\/a\/b\.png/,
    );
  });

  it('fails loudly when the same asset path is included twice', () => {
    const duplicateAssets: ScanAsset[] = [
      {
        path: 'assets/game/spotit/dog.png',
        kind: 'icon',
        width: 128,
        height: 128,
      },
      {
        path: 'assets/game/spotit/dog.png',
        kind: 'icon',
        width: 128,
        height: 128,
      },
    ];
    expect(() => planScanBatches(duplicateAssets, 4)).toThrowError(/Duplicate scan tag/);
  });

  it('fails loudly when an asset has an invalid path', () => {
    const invalidAsset = { path: '', kind: 'icon', width: 128, height: 128 };
    expect(() => planScanBatches([invalidAsset], 4)).toThrowError(/missing valid path/);
  });
});

describe('writeScanPlan', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('writes planned batches as JSON under tools/audit_out relative to root', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-plan-test-'));

    const assets: ScanAsset[] = [
      {
        path: 'assets/game/spotit/dog.png',
        kind: 'icon',
        width: 128,
        height: 128,
      },
      {
        path: 'assets/game/diff/aquarium_base.png',
        kind: 'scene',
        width: 1536,
        height: 1024,
      },
    ];

    const writtenPath = writeScanPlan(assets, 'plan.json', 4, tempDir);
    const expectedPath = path.join(tempDir, 'tools', 'audit_out', 'plan.json');
    expect(writtenPath).toBe(expectedPath);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    const expected = planScanBatches(assets, 4);
    expect(parsed).toEqual(expected);
  });

  it('defaults to scan_plan.json fileName when not specified', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-plan-root-'));
    const assets: ScanAsset[] = [
      {
        path: 'assets/game/spotit/dog.png',
        kind: 'icon',
        width: 128,
        height: 128,
      },
    ];

    const writtenPath = writeScanPlan(assets, undefined, 4, tempDir);
    expect(writtenPath).toBe(path.join(tempDir, 'tools', 'audit_out', 'scan_plan.json'));
    expect(fs.existsSync(writtenPath)).toBe(true);
  });

  it('fails loudly when assets is not an array', () => {
    expect(() => writeScanPlan(null as unknown as readonly ScanAsset[])).toThrowError(/Expected assets to be an array/);
  });
});
