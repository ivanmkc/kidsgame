import { describe, expect, it } from "vitest";
import { CURRICULUM } from "../../../curriculum/content";
import { makeRng } from "../../../rng";
import {
  MIN_STAGE_H,
  makeSumChoices,
  makeSumsRound,
  pickTwoCritters,
  sumsLayout,
  sumsSettings,
} from "../logic";

describe("sumsLayout", () => {
  it("enforces minimum stage height floor on mobile landscape viewports", () => {
    const androidLandscape = sumsLayout(800, 360, 10);
    expect(androidLandscape.isLandscape).toBe(true);
    expect(androidLandscape.stageH).toBeGreaterThanOrEqual(MIN_STAGE_H);
    expect(androidLandscape.stageH).toBe(260);

    const iphoneLandscape = sumsLayout(667, 375, 9);
    expect(iphoneLandscape.isLandscape).toBe(true);
    expect(iphoneLandscape.stageH).toBeGreaterThanOrEqual(MIN_STAGE_H);
    expect(iphoneLandscape.stageH).toBe(275);

    const compactLandscape = sumsLayout(568, 320, 10);
    expect(compactLandscape.isLandscape).toBe(true);
    expect(compactLandscape.stageH).toBeGreaterThanOrEqual(MIN_STAGE_H);
    expect(compactLandscape.stageH).toBe(220);
  });

  it("sizes critters so 3 rows on hard difficulty never vertically collide or overlap", () => {
    const viewports = [
      { w: 800, h: 360 },
      { w: 667, h: 375 },
      { w: 568, h: 320 },
      { w: 844, h: 390 },
    ];
    for (const { w, h } of viewports) {
      const layout = sumsLayout(w, h, 10);
      expect(layout.isLandscape).toBe(true);
      // 3 rows of critters must fit within stageH with vertical clearance
      expect(3 * layout.critterSize).toBeLessThan(layout.stageH);
      expect(layout.critterSize).toBeGreaterThanOrEqual(30);
    }
  });

  it("sizes critters so 4 rows on higher difficulties (total >= 16) never vertically collide or overlap", () => {
    const viewports = [
      { w: 800, h: 360 },
      { w: 667, h: 375 },
      { w: 568, h: 320 },
      { w: 844, h: 390 },
      { w: 360, h: 800 },
      { w: 320, h: 480 },
      { w: 432, h: 450 },
      { w: 320, h: 400 },
    ];
    for (const { w, h } of viewports) {
      const layout = sumsLayout(w, h, 16);
      // 4 rows of critters must fit within stageH with vertical clearance
      expect(4 * layout.critterSize).toBeLessThan(layout.stageH);
      expect(layout.critterSize).toBeGreaterThanOrEqual(30);
    }
  });

  it("uses standard vertical layout and preserves stage height on portrait screens", () => {
    const portrait360 = sumsLayout(360, 800, 5);
    expect(portrait360.isLandscape).toBe(false);
    expect(portrait360.stageH).toBeGreaterThanOrEqual(MIN_STAGE_H);
    expect(portrait360.stageW).toBe(328);

    const compactPortrait = sumsLayout(320, 480, 4);
    expect(compactPortrait.isLandscape).toBe(false);
    expect(compactPortrait.stageH).toBeGreaterThanOrEqual(MIN_STAGE_H);
  });

  it("uses standard spacious layout on tablet in landscape", () => {
    const tablet = sumsLayout(1024, 768, 10);
    expect(tablet.isLandscape).toBe(false);
    expect(tablet.stageH).toBe(403);
    expect(tablet.stageW).toBe(560);
    expect(tablet.stageH).toBeGreaterThanOrEqual(MIN_STAGE_H);
  });

  it("clamps stageW to a minimum of 0 on extremely narrow viewports to avoid negative dimensions", () => {
    const narrowPortrait = sumsLayout(30, 600, 2);
    expect(narrowPortrait.stageW).toBeGreaterThanOrEqual(0);
    expect(narrowPortrait.isLandscape).toBe(false);

    const narrowLandscape = sumsLayout(40, 30, 2);
    expect(narrowLandscape.stageW).toBeGreaterThanOrEqual(0);
    expect(narrowLandscape.isLandscape).toBe(true);
  });
});

describe("sumsSettings", () => {
  it("returns appropriate rounds and maxSum per difficulty", () => {
    expect(sumsSettings("easy")).toEqual({ rounds: 5, maxSum: 5 });
    expect(sumsSettings("medium")).toEqual({ rounds: 6, maxSum: 7 });
    expect(sumsSettings("hard")).toEqual({ rounds: 8, maxSum: 10 });
  });
});

describe("makeSumChoices", () => {
  it("returns three unique choices containing the answer", () => {
    const rng = makeRng(42);
    for (let sum = 2; sum <= 10; sum++) {
      const choices = makeSumChoices(rng, sum, 10);
      expect(choices).toHaveLength(3);
      expect(new Set(choices).size).toBe(3);
      expect(choices).toContain(sum);
    }
  });
});

describe("makeSumsRound", () => {
  it("creates valid round with non-overlapping partitioned positions and distinct icons", () => {
    const rng = makeRng(12345);
    const round = makeSumsRound(rng, "hard");
    expect(round.a + round.b).toBe(round.sum);
    expect(round.aPositions).toHaveLength(round.a);
    expect(round.bPositions).toHaveLength(round.b);
    expect(round.choices).toContain(round.sum);
    expect(round.icon).not.toBe(round.bIcon);
    expect(CURRICULUM.critters).toContain(round.icon);
    expect(CURRICULUM.critters).toContain(round.bIcon);
    const maxAx = Math.max(...round.aPositions.map((p) => p.x));
    const minBx = Math.min(...round.bPositions.map((p) => p.x));
    expect(maxAx).toBeLessThanOrEqual(minBx);
  });

  it("pickTwoCritters returns two distinct curriculum critters", () => {
    const rng = makeRng(99);
    for (let i = 0; i < 50; i++) {
      const [first, second] = pickTwoCritters(rng);
      expect(first).not.toBe(second);
      expect(CURRICULUM.critters).toContain(first);
      expect(CURRICULUM.critters).toContain(second);
    }
  });
});
