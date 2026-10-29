import { describe, expect, it } from "vitest";
import { makeRng } from "../../rng";
import {
  makeFastSlowRound,
  getActualSpeed,
  isCorrect as fsCorrect,
  roundsToWin as fsRounds,
  getInstructionalFeedback,
  nextScoreValue,
  fastSlowLayout,
} from "./logic";
import { renderToString } from "react-dom/server";
import React from "react";
import { FastSlowGame } from "./FastSlowGame";

describe("fast or slow", () => {
  it("prevents streaks of more than 2 of the same speed", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng1 = makeRng(seed);
      const r1 = makeFastSlowRound(rng1, "easy", ["fast", "fast"]);
      expect(getActualSpeed(r1)).toBe("slow");

      const rng2 = makeRng(seed);
      const r2 = makeFastSlowRound(rng2, "easy", ["slow", "slow"]);
      expect(getActualSpeed(r2)).toBe("fast");
    }
  });

  it("transposes melody pitches and varies melodies", () => {
    let transposed = false;
    const melodySignatures = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const rng = makeRng(i);
      const r = makeFastSlowRound(rng, "easy");
      if (r.notes[0].m !== 60) transposed = true;
      melodySignatures.add(r.notes.map((n) => n.m - r.notes[0].m).join(","));
    }
    expect(transposed).toBe(true);
    expect(melodySignatures.size).toBeGreaterThan(1);
  });

  it("generates rounds with valid speed and varying BPMs within difficulty bounds", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      const fastBpms = new Set<number>();
      const slowBpms = new Set<number>();
      for (let seed = 1; seed <= 50; seed++) {
        const rng = makeRng(seed);
        const r = makeFastSlowRound(rng, d);
        const speed = getActualSpeed(r);
        if (speed === "fast") {
          fastBpms.add(r.bpm);
          if (d === "easy") {
            expect(r.bpm).toBeGreaterThanOrEqual(150);
            expect(r.bpm).toBeLessThanOrEqual(170);
          } else if (d === "medium") {
            expect(r.bpm).toBeGreaterThanOrEqual(145);
            expect(r.bpm).toBeLessThanOrEqual(165);
          } else {
            expect(r.bpm).toBeGreaterThanOrEqual(140);
            expect(r.bpm).toBeLessThanOrEqual(160);
          }
        } else {
          slowBpms.add(r.bpm);
          if (d === "easy") {
            expect(r.bpm).toBeGreaterThanOrEqual(70);
            expect(r.bpm).toBeLessThanOrEqual(90);
          } else if (d === "medium") {
            expect(r.bpm).toBeGreaterThanOrEqual(75);
            expect(r.bpm).toBeLessThanOrEqual(95);
          } else {
            expect(r.bpm).toBeGreaterThanOrEqual(80);
            expect(r.bpm).toBeLessThanOrEqual(100);
          }
        }
      }
      expect(fastBpms.size).toBeGreaterThan(2);
      expect(slowBpms.size).toBeGreaterThan(2);
    }
  });

  it("uses history-weighted probability when history length is >= 1", () => {
    let fastFollowedBySlow = 0;
    let slowFollowedByFast = 0;
    const trials = 200;
    for (let i = 1; i <= trials; i++) {
      const rng = makeRng(i);
      const r1 = makeFastSlowRound(rng, "easy", ["fast"]);
      if (getActualSpeed(r1) === "slow") fastFollowedBySlow++;

      const rng2 = makeRng(i);
      const r2 = makeFastSlowRound(rng2, "easy", ["slow"]);
      if (getActualSpeed(r2) === "fast") slowFollowedByFast++;
    }
    // Weighted probabilities are configured to favor switching (70% chance of opposite speed)
    expect(fastFollowedBySlow / trials).toBeGreaterThan(0.5);
    expect(slowFollowedByFast / trials).toBeGreaterThan(0.5);
  });

  it("isCorrect agrees with the tempo played, and rounds do not store answer", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const r = makeFastSlowRound(makeRng(seed), d);
        expect("answer" in r).toBe(false);
        const speed = getActualSpeed(r);
        expect(fsCorrect(r, speed)).toBe(true);
        expect(fsCorrect(r, speed === "fast" ? "slow" : "fast")).toBe(false);
        seen.add(speed);
      }
    }
    expect(seen).toEqual(new Set(["fast", "slow"]));
  });

  it("roundsToWin increases with difficulty", () => {
    expect(fsRounds("easy")).toBeLessThan(fsRounds("medium"));
    expect(fsRounds("medium")).toBeLessThan(fsRounds("hard"));
  });

  it("provides instructional feedback stating actual tempo and listen prompt across languages", () => {
    const fastRound = { notes: [{ m: 60, b: 1 }], bpm: 155 };
    const slowRound = { notes: [{ m: 60, b: 1 }], bpm: 80 };

    expect(getInstructionalFeedback(fastRound, "en")).toEqual([
      "Fast",
      "Listen...",
    ]);
    expect(getInstructionalFeedback(slowRound, "en")).toEqual([
      "Slow",
      "Listen...",
    ]);
    expect(getInstructionalFeedback(fastRound, "ja")).toEqual([
      "はやい",
      "きいてね…",
    ]);
    expect(getInstructionalFeedback(slowRound, "ja")).toEqual([
      "おそい",
      "きいてね…",
    ]);
    expect(getInstructionalFeedback(fastRound, "cmn")).toEqual([
      "快",
      "听一听…",
    ]);
    expect(getInstructionalFeedback(slowRound, "cmn")).toEqual([
      "慢",
      "听一听…",
    ]);
    expect(getInstructionalFeedback(fastRound, "yue")).toEqual(["快", "聽下…"]);
    expect(getInstructionalFeedback(slowRound, "yue")).toEqual(["慢", "聽下…"]);
  });

  it("increments score unconditionally", () => {
    expect(nextScoreValue(0)).toBe(1);
    expect(nextScoreValue(5)).toBe(6);
  });

  it("renders FastSlowGame and displays localized strings", () => {
    const html = renderToString(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "en",
      }),
    );
    expect(html).toContain("Fast or Slow");
    expect(html).toContain("Listen");
  });

  describe("fastSlowLayout", () => {
    it("adapts layout for mobile portrait viewports (390px, 375px, 360px) so buttons fit without clipping", () => {
      const portrait390 = fastSlowLayout(390);
      expect(portrait390.gap).toBe(12);
      expect(portrait390.pickBtnPaddingHorizontal).toBe(18);
      expect(portrait390.pickBtnMinWidth).toBe(110);
      expect(portrait390.replaySize).toBe(64);
      expect(portrait390.replayFontSize).toBe(32);

      const viewports = [360, 375, 390];
      for (const width of viewports) {
        const layout = fastSlowLayout(width);
        const containerWidth = width - 32;
        const minRowWidth =
          layout.pickBtnMinWidth * 2 + layout.replaySize + layout.gap * 2;
        expect(minRowWidth).toBeLessThanOrEqual(containerWidth);
      }
    });

    it("adapts layout for ultra-compact 320px portrait viewport", () => {
      const layout = fastSlowLayout(320);
      expect(layout.gap).toBe(10);
      expect(layout.pickBtnPaddingHorizontal).toBe(14);
      expect(layout.pickBtnMinWidth).toBe(96);
      expect(layout.replaySize).toBe(56);
      expect(layout.replayFontSize).toBe(28);

      const containerWidth = 320 - 32;
      const minRowWidth =
        layout.pickBtnMinWidth * 2 + layout.replaySize + layout.gap * 2;
      expect(minRowWidth).toBeLessThanOrEqual(containerWidth);
    });

    it("preserves spacious layout on tablets and desktop (>= 500px)", () => {
      const tablet = fastSlowLayout(768);
      expect(tablet.gap).toBe(20);
      expect(tablet.pickBtnPaddingHorizontal).toBe(32);
      expect(tablet.pickBtnMinWidth).toBe(130);
      expect(tablet.replaySize).toBe(72);
      expect(tablet.replayFontSize).toBe(36);

      const desktop = fastSlowLayout(1024);
      expect(desktop.gap).toBe(20);
      expect(desktop.pickBtnPaddingHorizontal).toBe(32);
      expect(desktop.pickBtnMinWidth).toBe(130);
      expect(desktop.replaySize).toBe(72);
      expect(desktop.replayFontSize).toBe(36);
    });
  });
});
