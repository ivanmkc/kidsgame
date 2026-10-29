import { describe, expect, it } from "vitest";
import { makeRng } from "../../rng";
import {
  makeHighLowRound,
  roundsToWin,
  correctAnswer,
  isCorrect,
  getInstructionalFeedback,
  nextScoreValue,
  speechLines,
  HighLowRound,
  highLowLayout,
  MELODY_DOT_OFFSET_Y,
  melodyDotOffsetY,
} from "./logic";

describe("highlow logic", () => {
  it("generates rounds with distinct notes", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const rng = makeRng(seed);
        const r = makeHighLowRound(rng, d);
        expect(r.noteA).not.toBe(r.noteB);
        expect(Math.abs(r.noteB - r.noteA)).toBeGreaterThan(0);
        expect(["high", "low"]).toContain(correctAnswer(r));
      }
    }
  });

  it("correctAnswer and isCorrect match the direction of noteB relative to noteA", () => {
    const highRound: HighLowRound = { noteA: 60, noteB: 72 };
    const lowRound: HighLowRound = { noteA: 72, noteB: 60 };

    expect(correctAnswer(highRound)).toBe("high");
    expect(isCorrect(highRound, "high")).toBe(true);
    expect(isCorrect(highRound, "low")).toBe(false);

    expect(correctAnswer(lowRound)).toBe("low");
    expect(isCorrect(lowRound, "low")).toBe(true);
    expect(isCorrect(lowRound, "high")).toBe(false);
  });

  it("roundsToWin scales with difficulty", () => {
    expect(roundsToWin("easy")).toBe(8);
    expect(roundsToWin("medium")).toBe(10);
    expect(roundsToWin("hard")).toBe(12);
  });

  it("increments score unconditionally", () => {
    expect(nextScoreValue(0)).toBe(1);
    expect(nextScoreValue(5)).toBe(6);
  });

  it("provides instructional feedback stating the correct direction and listen prompt across languages", () => {
    const highRound: HighLowRound = { noteA: 60, noteB: 72 };
    const lowRound: HighLowRound = { noteA: 72, noteB: 60 };

    expect(getInstructionalFeedback(highRound, "en")).toEqual([
      "Higher",
      "Listen...",
    ]);
    expect(getInstructionalFeedback(lowRound, "en")).toEqual([
      "Lower",
      "Listen...",
    ]);

    expect(getInstructionalFeedback(highRound, "ja")).toEqual([
      "たかくなった",
      "きいてね…",
    ]);
    expect(getInstructionalFeedback(lowRound, "ja")).toEqual([
      "ひくくなった",
      "きいてね…",
    ]);

    expect(getInstructionalFeedback(highRound, "cmn")).toEqual([
      "更高",
      "听一听…",
    ]);
    expect(getInstructionalFeedback(lowRound, "cmn")).toEqual([
      "更低",
      "听一听…",
    ]);

    expect(getInstructionalFeedback(highRound, "yue")).toEqual([
      "高咗",
      "聽下…",
    ]);
    expect(getInstructionalFeedback(lowRound, "yue")).toEqual([
      "低咗",
      "聽下…",
    ]);
  });

  it("correctly scores relative melodic direction for high soprano and low bass rounds", () => {
    // High soprano drop (A4 440Hz -> F#4 370Hz)
    const sopranoDrop: HighLowRound = { noteA: 69, noteB: 66 };
    expect(correctAnswer(sopranoDrop)).toBe("low");
    expect(isCorrect(sopranoDrop, "low")).toBe(true);
    expect(isCorrect(sopranoDrop, "high")).toBe(false);
    expect(getInstructionalFeedback(sopranoDrop, "en")).toEqual([
      "Lower",
      "Listen...",
    ]);
    expect(getInstructionalFeedback(sopranoDrop, "ja")).toEqual([
      "ひくくなった",
      "きいてね…",
    ]);

    // Low bass rise (F#3 185Hz -> C#4 277Hz)
    const bassRise: HighLowRound = { noteA: 54, noteB: 61 };
    expect(correctAnswer(bassRise)).toBe("high");
    expect(isCorrect(bassRise, "high")).toBe(true);
    expect(isCorrect(bassRise, "low")).toBe(false);
    expect(getInstructionalFeedback(bassRise, "en")).toEqual([
      "Higher",
      "Listen...",
    ]);
    expect(getInstructionalFeedback(bassRise, "ja")).toEqual([
      "たかくなった",
      "きいてね…",
    ]);
  });

  it("speechLines exports unique non-empty phrases spanning all languages", () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines).toContain("Higher");
    expect(lines).toContain("Lower");
    expect(lines).toContain("Listen...");
    expect(lines).toContain("たかくなった");
    expect(lines).toContain("更高");
    expect(lines).toContain("高咗");
    expect(lines).toContain("にばんめの おとは たかくなった？ ひくくなった？");
  });

  describe("highLowLayout", () => {
    it("adapts layout for compact portrait viewports (< 430px) so buttons fit without clipping", () => {
      const portrait360 = highLowLayout(360);
      expect(portrait360.gap).toBe(10);
      expect(portrait360.pickBtnPaddingHorizontal).toBe(8);
      expect(portrait360.pickBtnMinWidth).toBe(96);
      expect(portrait360.replaySize).toBe(56);
      expect(portrait360.replayFontSize).toBe(28);
      expect(portrait360.pickLabelFontSize).toBe(16);

      const viewports = [320, 360, 375, 390, 414];
      for (const width of viewports) {
        const layout = highLowLayout(width);
        const containerWidth = width - 32;
        const minRowWidth =
          layout.pickBtnMinWidth * 2 + layout.replaySize + layout.gap * 2;
        expect(minRowWidth).toBeLessThanOrEqual(containerWidth);
        expect(layout.pickBtnMinWidth).toBe(96);
      }
    });

    it("adapts layout for ultra-compact 320px portrait viewport", () => {
      const layout = highLowLayout(320);
      expect(layout.gap).toBe(10);
      expect(layout.pickBtnPaddingHorizontal).toBe(8);
      expect(layout.pickBtnMinWidth).toBe(96);
      expect(layout.replaySize).toBe(56);
      expect(layout.replayFontSize).toBe(28);

      const containerWidth = 320 - 32;
      const minRowWidth =
        layout.pickBtnMinWidth * 2 + layout.replaySize + layout.gap * 2;
      expect(minRowWidth).toBeLessThanOrEqual(containerWidth);
      expect(layout.pickBtnMinWidth).toBe(96);
    });

    it("preserves spacious layout on standard mobile, tablets, and desktop (>= 430px)", () => {
      const portrait430 = highLowLayout(430);
      expect(portrait430.gap).toBe(12);
      expect(portrait430.pickBtnPaddingHorizontal).toBe(16);
      expect(portrait430.pickBtnMinWidth).toBe(130);
      expect(portrait430.replaySize).toBe(72);
      expect(portrait430.replayFontSize).toBe(36);
      expect(portrait430.pickLabelFontSize).toBe(22);

      const tablet = highLowLayout(768);
      expect(tablet.gap).toBe(12);
      expect(tablet.pickBtnPaddingHorizontal).toBe(16);
      expect(tablet.pickBtnMinWidth).toBe(130);
      expect(tablet.replaySize).toBe(72);
      expect(tablet.replayFontSize).toBe(36);
      expect(tablet.pickLabelFontSize).toBe(22);

      const desktop = highLowLayout(1024);
      expect(desktop.gap).toBe(12);
      expect(desktop.pickBtnPaddingHorizontal).toBe(16);
      expect(desktop.pickBtnMinWidth).toBe(130);
      expect(desktop.replaySize).toBe(72);
      expect(desktop.replayFontSize).toBe(36);
    });

    it("falls back to default layout when width is unmeasured or zero", () => {
      const fallback = highLowLayout(0);
      expect(fallback.gap).toBe(12);
      expect(fallback.pickBtnPaddingHorizontal).toBe(16);
      expect(fallback.pickBtnMinWidth).toBe(130);
      expect(fallback.replaySize).toBe(72);
      expect(fallback.replayFontSize).toBe(36);
    });
  });

  describe("melodyDotOffsetY", () => {
    it("offsets higher note upward (-20) and lower note downward (+20)", () => {
      const highRound: HighLowRound = { noteA: 60, noteB: 72 };
      const lowRound: HighLowRound = { noteA: 72, noteB: 60 };

      // Ascending round: note 0 is lower (+20), note 1 is higher (-20)
      expect(melodyDotOffsetY(highRound, 0)).toBe(MELODY_DOT_OFFSET_Y);
      expect(melodyDotOffsetY(highRound, 1)).toBe(-MELODY_DOT_OFFSET_Y);

      // Descending round: note 0 is higher (-20), note 1 is lower (+20)
      expect(melodyDotOffsetY(lowRound, 0)).toBe(-MELODY_DOT_OFFSET_Y);
      expect(melodyDotOffsetY(lowRound, 1)).toBe(MELODY_DOT_OFFSET_Y);
    });

    it("returns 0 when notes have identical pitch", () => {
      const equalRound: HighLowRound = { noteA: 60, noteB: 60 };
      expect(melodyDotOffsetY(equalRound, 0)).toBe(0);
      expect(melodyDotOffsetY(equalRound, 1)).toBe(0);
    });

    it("guarantees visual slope matches correctAnswer across all generated rounds", () => {
      for (let seed = 1; seed <= 50; seed++) {
        for (const d of ["easy", "medium", "hard"] as const) {
          const rng = makeRng(seed);
          const r = makeHighLowRound(rng, d);
          const y0 = melodyDotOffsetY(r, 0);
          const y1 = melodyDotOffsetY(r, 1);
          if (correctAnswer(r) === "high") {
            // Second note is higher, so its Y coordinate is lower (-20 < 20)
            expect(y1).toBeLessThan(y0);
            expect(y1).toBe(-MELODY_DOT_OFFSET_Y);
            expect(y0).toBe(MELODY_DOT_OFFSET_Y);
          } else {
            // Second note is lower, so its Y coordinate is higher (20 > -20)
            expect(y1).toBeGreaterThan(y0);
            expect(y1).toBe(MELODY_DOT_OFFSET_Y);
            expect(y0).toBe(-MELODY_DOT_OFFSET_Y);
          }
        }
      }
    });
  });
});
