import { describe, expect, it } from "vitest";
import { makeRng } from "../../../rng";
import {
  canTap,
  judgeTap,
  makeBellsRound,
  bellsLayout,
  bellLabel,
  BellsRound,
} from "../logic";

describe("judgeTap", () => {
  const round: BellsRound = {
    bells: [
      { midi: 60, color: "#E8564F" },
      { midi: 62, color: "#FFC24B" },
      { midi: 64, color: "#5FBF6E" },
      { midi: 67, color: "#2FB8AC" },
    ],
    sequence: [0, 1, 2],
  };

  it("immediately flags a wrong first tap on a 3-note sequence", () => {
    expect(judgeTap(round, [], 3)).toBe("wrong");
    expect(judgeTap(round, [], 1)).toBe("wrong");
  });

  it("returns continue on correct prefix taps", () => {
    expect(judgeTap(round, [], 0)).toBe("continue");
    expect(judgeTap(round, [0], 1)).toBe("continue");
  });

  it("immediately flags a wrong middle tap", () => {
    expect(judgeTap(round, [0], 0)).toBe("wrong");
    expect(judgeTap(round, [0], 3)).toBe("wrong");
  });

  it("returns complete on the final correct tap", () => {
    expect(judgeTap(round, [0, 1], 2)).toBe("complete");
  });

  it("flags a wrong final tap", () => {
    expect(judgeTap(round, [0, 1], 0)).toBe("wrong");
  });

  it("flags taps beyond sequence length as wrong", () => {
    expect(judgeTap(round, [0, 1, 2], 0)).toBe("wrong");
  });

  it("works with generated rounds", () => {
    const rng = makeRng(42);
    const r = makeBellsRound(rng, "medium");
    expect(r.sequence).toHaveLength(3);
    const firstCorrect = r.sequence[0];
    const firstWrong = (firstCorrect + 1) % r.bells.length;
    expect(judgeTap(r, [], firstWrong)).toBe("wrong");
    expect(judgeTap(r, [], firstCorrect)).toBe("continue");
  });
});

describe("canTap", () => {
  const round: BellsRound = {
    bells: [
      { midi: 60, color: "#E8564F" },
      { midi: 62, color: "#FFC24B" },
      { midi: 64, color: "#5FBF6E" },
    ],
    sequence: [0, 1, 2],
  };

  it("blocks taps when wrongFlash is active", () => {
    expect(canTap(round, [], "play", false, true)).toBe(false);
    expect(canTap(round, [0], "play", false, true)).toBe(false);
  });

  it("allows taps during active play when not flashing and incomplete", () => {
    expect(canTap(round, [], "play", false, false)).toBe(true);
    expect(canTap(round, [0], "play", false, false)).toBe(true);
  });
});

describe("bellsLayout", () => {
  it("scales down bellSize and gaps on mobile landscape viewports (800x360, 667x375, 568x320)", () => {
    // Android landscape (800x360)
    const androidLandscape = bellsLayout(800, 360, 5);
    expect(androidLandscape.isLandscape).toBe(true);
    expect(androidLandscape.shortH).toBe(true);
    expect(androidLandscape.gap).toBe(12);
    expect(androidLandscape.bellSize).toBe(82);
    expect(androidLandscape.bellSize).toBeLessThan(110);

    // iPhone SE landscape (667x375)
    const seLandscape = bellsLayout(667, 375, 5);
    expect(seLandscape.isLandscape).toBe(true);
    expect(seLandscape.shortH).toBe(true);
    expect(seLandscape.gap).toBe(12);
    expect(seLandscape.bellSize).toBe(87);
    expect(seLandscape.bellSize).toBeLessThan(110);

    // Compact landscape (568x320)
    const compactLandscape = bellsLayout(568, 320, 5);
    expect(compactLandscape.isLandscape).toBe(true);
    expect(compactLandscape.shortH).toBe(true);
    expect(compactLandscape.gap).toBe(8);
    expect(compactLandscape.bellSize).toBe(70);
    expect(compactLandscape.bellSize).toBeLessThan(110);
  });

  it("keeps total content height within mobile landscape viewports without clipping", () => {
    // GameShell header (~74px) + root bottom padding (10px) = 84px chrome.
    // Board contains statusRow (48px in shortH), tapDots (16px),
    // bell cards (1.2 * bellSize, scaled up to 1.06 in play phase), and 2 vertical gaps.
    const screenHeights = [320, 360, 375, 390, 414, 428];
    for (const height of screenHeights) {
      const layout = bellsLayout(800, height, 5);
      expect(layout.shortH).toBe(true);
      const bellRenderHeight = layout.bellSize * 1.2 * 1.06;
      const boardContentHeight = 48 + 16 + layout.gap * 2 + bellRenderHeight;
      const totalScreenHeight = 84 + boardContentHeight;
      expect(totalScreenHeight).toBeLessThan(height);

      // Verify the bottom edge of the bells remains within the viewport
      const boardAvailH = height - 84;
      const topMargin = (boardAvailH - boardContentHeight) / 2;
      const bellBottom =
        74 + topMargin + 48 + layout.gap + 16 + layout.gap + bellRenderHeight;
      expect(bellBottom).toBeLessThan(height);
    }
  });

  it("preserves full bell size and 28px gaps on portrait screens", () => {
    const portrait375 = bellsLayout(375, 667, 3);
    expect(portrait375.isLandscape).toBe(false);
    expect(portrait375.shortH).toBe(false);
    expect(portrait375.gap).toBe(28);
    expect(portrait375.bellSize).toBeCloseTo(102.3, 1);

    const portrait390 = bellsLayout(390, 844, 3);
    expect(portrait390.isLandscape).toBe(false);
    expect(portrait390.shortH).toBe(false);
    expect(portrait390.gap).toBe(28);
    expect(portrait390.bellSize).toBeCloseTo(107.3, 1);
  });

  it("preserves spacious layout on tablets in landscape (1024x768)", () => {
    const tablet = bellsLayout(1024, 768, 3);
    expect(tablet.isLandscape).toBe(true);
    expect(tablet.shortH).toBe(false);
    expect(tablet.bellSize).toBe(110);
    expect(tablet.gap).toBe(28);
  });

  it("clamps bellSize to accessible touch target on narrow viewports", () => {
    const tiny = bellsLayout(200, 200, 5);
    expect(tiny.bellSize).toBeGreaterThanOrEqual(44);
  });
});

describe("bellLabel", () => {
  it("formats bell accessibility label localized across languages", () => {
    expect(bellLabel(0, "en")).toBe("Bell 1");
    expect(bellLabel(1, "en")).toBe("Bell 2");
    expect(bellLabel(0, "ja")).toBe("ベル 1");
    expect(bellLabel(2, "ja")).toBe("ベル 3");
    expect(bellLabel(0, "cmn")).toBe("铃铛 1");
    expect(bellLabel(0, "yue")).toBe("鈴鐺 1");
  });
});
