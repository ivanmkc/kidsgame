import { describe, expect, it } from "vitest";
import { canTap, echoBeatLayout, evaluationDelayMs } from "./logic";

describe("echoBeatLayout", () => {
  it("scales down drum and gaps on mobile landscape viewports (667x375, 568x320)", () => {
    const seLandscape = echoBeatLayout(667, 375);
    expect(seLandscape.isLandscape).toBe(true);
    expect(seLandscape.shortH).toBe(true);
    expect(seLandscape.drumSize).toBe(142);
    expect(seLandscape.drumSize).toBeGreaterThanOrEqual(90);
    expect(seLandscape.drumSize).toBeLessThanOrEqual(180);
    expect(seLandscape.gap).toBe(12);

    const compactLandscape = echoBeatLayout(568, 320);
    expect(compactLandscape.isLandscape).toBe(true);
    expect(compactLandscape.shortH).toBe(true);
    expect(compactLandscape.drumSize).toBe(121);
    expect(compactLandscape.drumSize).toBeGreaterThanOrEqual(90);
    expect(compactLandscape.drumSize).toBeLessThanOrEqual(180);
    expect(compactLandscape.gap).toBe(8);
  });

  it("keeps total content height within mobile landscape viewports without clipping or header collision", () => {
    // GameShell header (~74px) + root bottom padding (10px) = 84px chrome.
    // Board contains statusCard (42px in shortH), drum, tapDots (16px), and 2 vertical gaps.
    const screenHeights = [320, 360, 375, 390, 414, 428];
    for (const height of screenHeights) {
      const layout = echoBeatLayout(800, height);
      expect(layout.shortH).toBe(true);
      const boardContentHeight = 42 + layout.drumSize + 16 + layout.gap * 2;
      const totalScreenHeight = 84 + boardContentHeight;
      expect(totalScreenHeight).toBeLessThan(height);
    }
  });

  it("preserves full 180px drum and 28px gaps on portrait screens", () => {
    const portrait375 = echoBeatLayout(375, 667);
    expect(portrait375.isLandscape).toBe(false);
    expect(portrait375.shortH).toBe(false);
    expect(portrait375.drumSize).toBe(180);
    expect(portrait375.gap).toBe(28);

    const portrait390 = echoBeatLayout(390, 844);
    expect(portrait390.isLandscape).toBe(false);
    expect(portrait390.shortH).toBe(false);
    expect(portrait390.drumSize).toBe(180);
    expect(portrait390.gap).toBe(28);

    const compactPortrait = echoBeatLayout(320, 568);
    expect(compactPortrait.isLandscape).toBe(false);
    expect(compactPortrait.shortH).toBe(false);
    expect(compactPortrait.drumSize).toBe(180);
    expect(compactPortrait.gap).toBe(28);
  });

  it("preserves spacious layout on tablets in landscape (1024x768)", () => {
    const tablet = echoBeatLayout(1024, 768);
    expect(tablet.isLandscape).toBe(true);
    expect(tablet.shortH).toBe(false);
    expect(tablet.drumSize).toBe(180);
    expect(tablet.gap).toBe(28);
  });
});

describe("canTap", () => {
  const round = { gaps: [0.4, 0.4], hitCount: 3 };

  it("allows tapping during tap phase when tapCount is below hitCount", () => {
    expect(canTap(round, 0, "tap")).toBe(true);
    expect(canTap(round, 1, "tap")).toBe(true);
    expect(canTap(round, 2, "tap")).toBe(true);
  });

  it("disables tapping once tapCount reaches or exceeds hitCount", () => {
    expect(canTap(round, 3, "tap")).toBe(false);
    expect(canTap(round, 4, "tap")).toBe(false);
  });

  it("blocks tapping during listen phase", () => {
    expect(canTap(round, 0, "listen")).toBe(false);
    expect(canTap(round, 1, "listen")).toBe(false);
  });

  it("blocks tapping when game is won or round result is active", () => {
    expect(canTap(round, 0, "tap", true)).toBe(false);
    expect(canTap(round, 0, "tap", false, "good")).toBe(false);
    expect(canTap(round, 0, "tap", false, "bad")).toBe(false);
  });
});

describe("evaluationDelayMs", () => {
  const round = { gaps: [0.4, 0.4], hitCount: 3 };

  it("returns 0ms when tapCount reaches hitCount for immediate evaluation", () => {
    expect(evaluationDelayMs(round, 3)).toBe(0);
    expect(evaluationDelayMs(round, 4)).toBe(0);
  });

  it("returns 1200ms when sequence is incomplete to await further taps", () => {
    expect(evaluationDelayMs(round, 0)).toBe(1200);
    expect(evaluationDelayMs(round, 1)).toBe(1200);
    expect(evaluationDelayMs(round, 2)).toBe(1200);
  });
});
