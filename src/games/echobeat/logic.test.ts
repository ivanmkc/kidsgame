import { describe, expect, it } from "vitest";
import { makeRng } from "../../rng";
import {
  canTap,
  checkEcho,
  echoBeatLayout,
  evaluationDelayMs,
  makeEchoBeatRound,
} from "./logic";

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

  it("returns 3000ms when sequence is incomplete to await further taps", () => {
    expect(evaluationDelayMs(round, 0)).toBe(3000);
    expect(evaluationDelayMs(round, 1)).toBe(3000);
    expect(evaluationDelayMs(round, 2)).toBe(3000);
  });
});

describe("makeEchoBeatRound", () => {
  it("generates musical rhythmic patterns with quantized musical durations and bpm metronome tempo", () => {
    const validIntervals = [0.25, 0.5, 0.6, 0.75, 1.0, 1 / 3];
    for (let seed = 1; seed <= 50; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const round = makeEchoBeatRound(makeRng(seed), d);
        expect(round.hitCount).toBe(round.gaps.length + 1);
        expect(round.bpm).toBeGreaterThanOrEqual(100);
        expect(round.bpm).toBeLessThanOrEqual(120);
        for (const gap of round.gaps) {
          const matchesKnownInterval = validIntervals.some(
            (v) => Math.abs(v - gap) < 1e-4,
          );
          expect(matchesKnownInterval).toBe(true);
        }
      }
    }
  });

  it("respects difficulty hitCount ranges", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const easyRound = makeEchoBeatRound(makeRng(seed), "easy");
      expect(easyRound.hitCount).toBeGreaterThanOrEqual(2);
      expect(easyRound.hitCount).toBeLessThanOrEqual(3);

      const medRound = makeEchoBeatRound(makeRng(seed), "medium");
      expect(medRound.hitCount).toBeGreaterThanOrEqual(3);
      expect(medRound.hitCount).toBeLessThanOrEqual(5);

      const hardRound = makeEchoBeatRound(makeRng(seed), "hard");
      expect(hardRound.hitCount).toBeGreaterThanOrEqual(4);
      expect(hardRound.hitCount).toBeLessThanOrEqual(6);
    }
  });
});

describe("checkEcho", () => {
  it("passes when tapping rhythm with exact relative ratios at 30% slower tempo on hard (repro F1db861)", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const round = makeEchoBeatRound(makeRng(seed), "hard");
      let time = 0;
      const taps = [time];
      for (const gap of round.gaps) {
        time += gap * 1.3 * 1000;
        taps.push(time);
      }
      const result = checkEcho(round, taps, "hard");
      expect(result.countCorrect).toBe(true);
      expect(result.timingCorrect).toBe(true);
    }
  });

  it("passes when tapping rhythm with exact relative ratios at 30% faster tempo on hard", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const round = makeEchoBeatRound(makeRng(seed), "hard");
      let time = 0;
      const taps = [time];
      for (const gap of round.gaps) {
        time += gap * 0.7 * 1000;
        taps.push(time);
      }
      const result = checkEcho(round, taps, "hard");
      expect(result.countCorrect).toBe(true);
      expect(result.timingCorrect).toBe(true);
    }
  });

  it("tolerates child motor timing jitter on 250ms eighth notes", () => {
    const round = { gaps: [0.25, 0.25, 0.5], hitCount: 4 };
    // +70ms jitter on first note, -60ms on second
    const taps = [0, 320, 510, 1010];
    const result = checkEcho(round, taps, "hard");
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(true);
  });

  it("rejects wrong rhythm proportions even when tap count matches", () => {
    // Expected: eighth, eighth, quarter (1:1:2 ratio)
    const round = { gaps: [0.25, 0.25, 0.5], hitCount: 4 };
    // Player taps uniform quarter notes (1:1:1 ratio)
    const taps = [0, 333, 666, 1000];
    const result = checkEcho(round, taps, "hard");
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(false);
  });

  it("rejects inverted rhythm patterns", () => {
    // Expected: eighth, quarter (1:2 ratio)
    const round = { gaps: [0.25, 0.5], hitCount: 3 };
    // Player taps inverted: quarter, eighth (2:1 ratio)
    const taps = [0, 500, 750];
    const result = checkEcho(round, taps, "medium");
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(false);
  });

  it("rejects accidental double-taps under 50ms", () => {
    const round = { gaps: [0.25, 0.5], hitCount: 3 };
    const taps = [0, 20, 520];
    const result = checkEcho(round, taps, "medium");
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(false);
  });

  it("rejects extreme tempo drift outside 0.4x to 2.5x range", () => {
    const round = { gaps: [0.5, 0.5], hitCount: 3 };
    // 3.5x slower (3.5s total instead of 1.0s)
    const slowTaps = [0, 1750, 3500];
    expect(checkEcho(round, slowTaps, "medium").timingCorrect).toBe(false);

    // 0.2x faster (0.2s total instead of 1.0s)
    const fastTaps = [0, 100, 200];
    expect(checkEcho(round, fastTaps, "medium").timingCorrect).toBe(false);
  });

  it("evaluates rhythm on easy difficulty with generous tolerance and rejects double-taps", () => {
    const round = { gaps: [0.5, 0.5], hitCount: 3, bpm: 120 };
    // Matching steady rhythm passes
    expect(checkEcho(round, [0, 500, 1000], "easy").timingCorrect).toBe(true);

    // Rhythm at 30% slower tempo with exact relative ratios passes on easy
    expect(checkEcho(round, [0, 650, 1300], "easy").timingCorrect).toBe(true);

    // Accidental double-taps (<= 50ms) are rejected on easy
    expect(checkEcho(round, [0, 10, 500], "easy").timingCorrect).toBe(false);

    // Extreme irregular timing is rejected on easy
    expect(checkEcho(round, [0, 80, 2500], "easy").timingCorrect).toBe(false);
  });

  it("evaluates single gap rounds against tolerance window", () => {
    const round = { gaps: [0.5], hitCount: 2 };
    expect(checkEcho(round, [0, 520], "medium").timingCorrect).toBe(true);
    expect(checkEcho(round, [0, 900], "hard").timingCorrect).toBe(false);
  });
});
