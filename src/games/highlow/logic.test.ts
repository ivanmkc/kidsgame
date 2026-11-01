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
        const r = makeHighLowRound(rng, d, 0);
        expect(r.noteA).not.toBe(r.noteB);
        expect(Math.abs(r.noteB - r.noteA)).toBeGreaterThan(0);
        expect(["high", "low"]).toContain(correctAnswer(r));
      }
    }
  });

  it("scaffolds interval widths across session round progress", () => {
    const rng = makeRng(123);
    // Easy: 8 rounds. Rounds 1-4: 12 semitones, Rounds 5-8: 9 semitones.
    for (let i = 0; i < 4; i++) {
      const r = makeHighLowRound(rng, "easy", i);
      expect(Math.abs(r.noteB - r.noteA)).toBe(12);
    }
    for (let i = 4; i < 8; i++) {
      const r = makeHighLowRound(rng, "easy", i);
      expect(Math.abs(r.noteB - r.noteA)).toBe(9);
    }

    // Medium: 10 rounds. Rounds 1-4: 7; Rounds 5-7: 5; Rounds 8-10: 4.
    for (let i = 0; i < 4; i++) {
      const r = makeHighLowRound(rng, "medium", i);
      expect(Math.abs(r.noteB - r.noteA)).toBe(7);
    }
    for (let i = 4; i < 7; i++) {
      const r = makeHighLowRound(rng, "medium", i);
      expect(Math.abs(r.noteB - r.noteA)).toBe(5);
    }
    for (let i = 7; i < 10; i++) {
      const r = makeHighLowRound(rng, "medium", i);
      expect(Math.abs(r.noteB - r.noteA)).toBe(4);
    }

    // Hard: 12 rounds. Fixed at 3 semitones.
    for (let i = 0; i < 12; i++) {
      const r = makeHighLowRound(rng, "hard", i);
      expect(Math.abs(r.noteB - r.noteA)).toBe(3);
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

    it("scales down buttons, padding, and gaps on compact mobile landscape viewports", () => {
      // Ultra-compact mobile landscape (568x320)
      const compact320 = highLowLayout(568, 320);
      expect(compact320.isLandscape).toBe(true);
      expect(compact320.shortH).toBe(true);
      expect(compact320.gap).toBe(6);
      expect(compact320.pickBtnPaddingVertical).toBe(8);
      expect(compact320.pickBtnPaddingHorizontal).toBe(12);
      expect(compact320.pickBtnMinWidth).toBe(96);
      expect(compact320.pickEmojiFontSize).toBe(32);
      expect(compact320.pickLabelFontSize).toBe(16);
      expect(compact320.replaySize).toBe(44);
      expect(compact320.replayFontSize).toBe(22);
      expect(compact320.melodyDotRowHeight).toBe(48);

      // Compact mobile landscape (667x375)
      const compact375 = highLowLayout(667, 375);
      expect(compact375.isLandscape).toBe(true);
      expect(compact375.shortH).toBe(true);
      expect(compact375.gap).toBe(8);
      expect(compact375.pickBtnPaddingVertical).toBe(10);
      expect(compact375.pickBtnPaddingHorizontal).toBe(16);
      expect(compact375.pickBtnMinWidth).toBe(110);
      expect(compact375.pickEmojiFontSize).toBe(36);
      expect(compact375.pickLabelFontSize).toBe(18);
      expect(compact375.replaySize).toBe(48);
      expect(compact375.replayFontSize).toBe(24);
      expect(compact375.melodyDotRowHeight).toBe(48);

      // Compact mobile landscape (740x360)
      const compact360 = highLowLayout(740, 360);
      expect(compact360.isLandscape).toBe(true);
      expect(compact360.shortH).toBe(true);
      expect(compact360.gap).toBe(8);
      expect(compact360.pickBtnPaddingVertical).toBe(10);
      expect(compact360.replaySize).toBe(48);
    });

    it("keeps total board content height comfortably within 220-250px so it fits mobile landscape viewports", () => {
      // GameShell chrome is ~80px.
      // Board contains melodyDotRow, replay button, choice buttons, and 2 gaps.
      const screenHeights = [320, 360, 375, 390, 414, 428];
      for (const h of screenHeights) {
        const layout = highLowLayout(800, h);
        expect(layout.shortH).toBe(true);
        const choiceBtnHeight =
          layout.pickBtnPaddingVertical * 2 +
          layout.pickEmojiFontSize +
          4 +
          layout.pickLabelFontSize +
          6;
        const boardContentHeight =
          layout.melodyDotRowHeight +
          layout.gap * 2 +
          layout.replaySize +
          choiceBtnHeight;
        expect(boardContentHeight).toBeLessThanOrEqual(250);
        const totalScreenHeight = 80 + boardContentHeight;
        expect(totalScreenHeight).toBeLessThan(h);
      }
    });

    it("preserves spacious layout on standard mobile, tablets, and desktop (>= 430px)", () => {
      const portrait430 = highLowLayout(430);
      expect(portrait430.gap).toBe(12);
      expect(portrait430.pickBtnPaddingHorizontal).toBe(16);
      expect(portrait430.pickBtnPaddingVertical).toBe(28);
      expect(portrait430.pickBtnMinWidth).toBe(130);
      expect(portrait430.replaySize).toBe(72);
      expect(portrait430.replayFontSize).toBe(36);
      expect(portrait430.pickLabelFontSize).toBe(22);
      expect(portrait430.melodyDotRowHeight).toBe(60);
      expect(portrait430.shortH).toBe(false);

      const tablet = highLowLayout(768, 1024);
      expect(tablet.isLandscape).toBe(false);
      expect(tablet.shortH).toBe(false);
      expect(tablet.gap).toBe(12);
      expect(tablet.pickBtnPaddingHorizontal).toBe(16);
      expect(tablet.pickBtnMinWidth).toBe(130);
      expect(tablet.replaySize).toBe(72);
      expect(tablet.replayFontSize).toBe(36);
      expect(tablet.pickLabelFontSize).toBe(22);

      const desktop = highLowLayout(1024, 768);
      expect(desktop.isLandscape).toBe(true);
      expect(desktop.shortH).toBe(false);
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
      expect(fallback.shortH).toBe(false);
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
          const r = makeHighLowRound(rng, d, 0);
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
