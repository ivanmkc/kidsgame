import { describe, expect, it } from "vitest";
import { t } from "../../../i18n";
import { makeRng } from "../../../rng";
import {
  KANA_POOL,
  LETTER_SOUNDS,
  kanaConfusableGroup,
  lettersLayout,
  makeLetterRound,
  settingsForLetters,
  shouldShowGlyph,
  speechLines,
} from "../logic";

describe("shouldShowGlyph", () => {
  it("hides the glyph by default", () => {
    expect(shouldShowGlyph(0, false)).toBe(false);
  });

  it("reveals the glyph after 2 misses", () => {
    expect(shouldShowGlyph(1, false)).toBe(false);
    expect(shouldShowGlyph(2, false)).toBe(true);
    expect(shouldShowGlyph(3, false)).toBe(true);
  });

  it("forces the glyph if forceShow is true", () => {
    expect(shouldShowGlyph(0, true)).toBe(true);
    expect(shouldShowGlyph(1, true)).toBe(true);
  });
});

describe("LETTER_SOUNDS phonics pool", () => {
  it("includes letter A and letter O with distinct sounds", () => {
    const entryA = LETTER_SOUNDS.find((s) => s.letter === "A");
    const entryO = LETTER_SOUNDS.find((s) => s.letter === "O");
    expect(entryA).toEqual({ letter: "A", sound: "aa" });
    expect(entryO).toEqual({ letter: "O", sound: "ah" });
  });

  it("sound tier produces distinct prompt lines for A and O", () => {
    const idxA = LETTER_SOUNDS.findIndex((s) => s.letter === "A");
    const rngA = () => (idxA + 0.5) / LETTER_SOUNDS.length;
    const roundA = makeLetterRound(rngA, "sound", 8);
    expect(roundA.targetKey).toBe("A");
    expect(roundA.promptLine).toBe("Which letter says aa?");

    const idxO = LETTER_SOUNDS.findIndex((s) => s.letter === "O");
    const rngO = () => (idxO + 0.5) / LETTER_SOUNDS.length;
    const roundO = makeLetterRound(rngO, "sound", 8);
    expect(roundO.targetKey).toBe("O");
    expect(roundO.promptLine).toBe("Which letter says ah?");
  });
});

describe("settingsForLetters", () => {
  it("scaffolds JA settings across easy, medium, and hard with distinct tile counts", () => {
    const easy = settingsForLetters("easy", "ja");
    const med = settingsForLetters("medium", "ja");
    const hard = settingsForLetters("hard", "ja");

    expect(easy).toEqual({ rounds: 8, tiles: 6, tier: "kana" });
    expect(med).toEqual({ rounds: 10, tiles: 8, tier: "kana" });
    expect(hard).toEqual({ rounds: 12, tiles: 12, tier: "kana" });

    expect(hard.tiles).toBeGreaterThan(med.tiles);
    expect(med.tiles).toBeGreaterThan(easy.tiles);
  });

  it("preserves EN settings", () => {
    expect(settingsForLetters("easy", "en")).toEqual({
      rounds: 8,
      tiles: 6,
      tier: "upper",
    });
    expect(settingsForLetters("medium", "en")).toEqual({
      rounds: 10,
      tiles: 8,
      tier: "mixed",
    });
    expect(settingsForLetters("hard", "en")).toEqual({
      rounds: 12,
      tiles: 8,
      tier: "sound",
    });
  });
});

describe("makeLetterRound: kana tier", () => {
  it("excludes confusables on easy mode (tiles <= 6)", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = makeLetterRound(makeRng(seed), "kana", 6);
      const group = kanaConfusableGroup(r.targetKey);
      if (group.length === 0) continue;
      const confusables = group.filter((k) => k !== r.targetKey);
      const tileLabels = r.tiles.map((t) => t.label);
      for (const confusable of confusables) {
        expect(tileLabels).not.toContain(confusable);
      }
    }
  });

  it("prioritizes confusables on medium (8 tiles) and hard (12 tiles)", () => {
    for (const tiles of [8, 12] as const) {
      let confusableTargetCount = 0;
      let confusableInDistractorsCount = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const r = makeLetterRound(makeRng(seed), "kana", tiles);
        const group = kanaConfusableGroup(r.targetKey);
        if (group.length === 0) continue;
        confusableTargetCount++;
        const otherConfusables = group.filter((k) => k !== r.targetKey);
        const distractorLabels = r.tiles
          .filter((t) => !t.isAnswer)
          .map((t) => t.label);
        if (otherConfusables.some((c) => distractorLabels.includes(c))) {
          confusableInDistractorsCount++;
        }
      }
      expect(confusableTargetCount).toBeGreaterThan(0);
      expect(
        confusableInDistractorsCount / confusableTargetCount,
      ).toBeGreaterThan(0.9);
    }
  });

  it("produces 12 distinct tiles with single answer on hard mode", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = makeLetterRound(makeRng(seed), "kana", 12);
      expect(r.tiles).toHaveLength(12);
      expect(new Set(r.tiles.map((t) => t.key)).size).toBe(12);
      expect(r.tiles[r.answerIdx].isAnswer).toBe(true);
      expect(r.tiles.filter((t) => t.isAnswer)).toHaveLength(1);
    }
  });

  it("hard mode (tiles >= 10) biases targets toward confusable kana", () => {
    let confusableCount = 0;
    const total = 200;
    for (let seed = 1; seed <= total; seed++) {
      const r = makeLetterRound(makeRng(seed), "kana", 12);
      if (kanaConfusableGroup(r.targetKey).length > 0) {
        confusableCount++;
      }
    }
    // 13/25 is ~52% uniform; 75% bias pushes it well above 65%
    expect(confusableCount / total).toBeGreaterThan(0.65);
  });
});

describe("makeLetterRound: prompt line localization", () => {
  it("localizes upper/mixed tier prompt across all languages", () => {
    const rng = () => 0;
    expect(makeLetterRound(rng, "upper", 6, undefined, "en").promptLine).toBe(
      "Find the letter A!",
    );
    expect(makeLetterRound(rng, "upper", 6, undefined, "ja").promptLine).toBe(
      "「A」をさがして！",
    );
    expect(makeLetterRound(rng, "upper", 6, undefined, "cmn").promptLine).toBe(
      "找一找字母 A！",
    );
    expect(makeLetterRound(rng, "upper", 6, undefined, "yue").promptLine).toBe(
      "搵一搵字母 A！",
    );
  });

  it("localizes sound tier prompt across all languages", () => {
    const idxA = LETTER_SOUNDS.findIndex((s) => s.letter === "A");
    const rngA = () => (idxA + 0.5) / LETTER_SOUNDS.length;
    expect(makeLetterRound(rngA, "sound", 8, undefined, "en").promptLine).toBe(
      "Which letter says aa?",
    );
    expect(makeLetterRound(rngA, "sound", 8, undefined, "ja").promptLine).toBe(
      "「aa」の おとの もじは どれ？",
    );
    expect(makeLetterRound(rngA, "sound", 8, undefined, "cmn").promptLine).toBe(
      "哪个字母发 aa 的音？",
    );
    expect(makeLetterRound(rngA, "sound", 8, undefined, "yue").promptLine).toBe(
      "邊個字母發 aa 嘅音？",
    );
  });

  it("localizes kana tier prompt across all languages", () => {
    const rng = () => 0;
    expect(makeLetterRound(rng, "kana", 6, undefined, "ja").promptLine).toBe(
      "「あ」をさがして！",
    );
    expect(makeLetterRound(rng, "kana", 6, undefined, "en").promptLine).toBe(
      "Find the kana あ!",
    );
    expect(makeLetterRound(rng, "kana", 6, undefined, "cmn").promptLine).toBe(
      "找一找假名 あ！",
    );
    expect(makeLetterRound(rng, "kana", 6, undefined, "yue").promptLine).toBe(
      "搵一搵假名 あ！",
    );
  });
});

describe("speechLines", () => {
  it("only generates reachable prompts per language", () => {
    const lines = speechLines();
    const lineSet = new Set(lines);

    // Total should only include valid combinations:
    // 25 kana (ja) + 3 * (26 letters + 18 sounds) = 157.
    expect(lines).toHaveLength(
      KANA_POOL.length + 3 * (26 + LETTER_SOUNDS.length),
    );

    // Valid combinations included:
    expect(lineSet.has(t("ja", "letters.findKana", { kana: "あ" }))).toBe(true);
    expect(lineSet.has(t("en", "letters.find", { letter: "A" }))).toBe(true);
    expect(lineSet.has(t("en", "letters.sound", { sound: "aa" }))).toBe(true);
    expect(lineSet.has(t("cmn", "letters.find", { letter: "A" }))).toBe(true);
    expect(lineSet.has(t("yue", "letters.sound", { sound: "aa" }))).toBe(true);

    // Unreachable combinations excluded:
    // Non-JA languages never play kana tier
    expect(lineSet.has(t("en", "letters.findKana", { kana: "あ" }))).toBe(
      false,
    );
    expect(lineSet.has(t("cmn", "letters.findKana", { kana: "あ" }))).toBe(
      false,
    );
    expect(lineSet.has(t("yue", "letters.findKana", { kana: "あ" }))).toBe(
      false,
    );

    // JA never plays alphabet or phonics sound tiers
    expect(lineSet.has(t("ja", "letters.find", { letter: "A" }))).toBe(false);
    expect(lineSet.has(t("ja", "letters.sound", { sound: "aa" }))).toBe(false);
  });
});

describe("lettersLayout", () => {
  it("scales down prompt and sizes tiles appropriately on compact mobile landscape (568x320)", () => {
    // 8 tiles mode (Medium mode)
    const layout8 = lettersLayout(568, 320, 8);
    expect(layout8.shortH).toBe(true);
    expect(layout8.isLandscape).toBe(true);
    expect(layout8.cols).toBe(4);
    expect(layout8.rows).toBe(2);
    expect(layout8.speakerSize).toBe(56);
    expect(layout8.speakerIconSize).toBe(26);
    expect(layout8.boardGap).toBe(10);
    expect(layout8.tileGap).toBe(10);
    // Tile size must remain playable and well above 44px
    expect(layout8.tile).toBeGreaterThanOrEqual(44);
    expect(layout8.tile).toBe(45);

    // Total vertical height of board content + wrapped header must not overflow 320px
    const headerHeight = 136;
    const promptHeight = 74;
    const boardContentH =
      promptHeight +
      layout8.boardGap +
      (layout8.rows * layout8.tile + (layout8.rows - 1) * layout8.tileGap);
    expect(headerHeight + boardContentH).toBeLessThanOrEqual(320);
  });

  it("adapts 12 tiles in landscape to 6 columns x 2 rows, keeping tiles above 44px", () => {
    // 12 tiles mode (Japanese Hard mode) on 568x320 landscape
    const layout12 = lettersLayout(568, 320, 12);
    expect(layout12.shortH).toBe(true);
    expect(layout12.isLandscape).toBe(true);
    expect(layout12.cols).toBe(6);
    expect(layout12.rows).toBe(2);
    // Tiles must not shrink to unplayable 27px; they should be well above 44px
    expect(layout12.tile).toBeGreaterThanOrEqual(44);
    expect(layout12.tile).toBe(45);
  });

  it("preserves 4 columns x 3 rows for 12 tiles in portrait orientation", () => {
    // Standard phone portrait (375x667)
    const layout = lettersLayout(375, 667, 12);
    expect(layout.shortH).toBe(false);
    expect(layout.isLandscape).toBe(false);
    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(3);
    expect(layout.speakerSize).toBe(80);
    expect(layout.speakerIconSize).toBe(36);
    expect(layout.boardGap).toBe(16);
    expect(layout.tileGap).toBe(12);
    expect(layout.tile).toBeGreaterThanOrEqual(44);
  });

  it("sizes tiles for easy mode (6 tiles) across landscape and portrait", () => {
    const landscape = lettersLayout(568, 320, 6);
    expect(landscape.cols).toBe(3);
    expect(landscape.rows).toBe(2);
    expect(landscape.tile).toBe(45);

    const portrait = lettersLayout(375, 667, 6);
    expect(portrait.cols).toBe(3);
    expect(portrait.rows).toBe(2);
  });

  it("computes responsive layout on modern landscape phones (667x375 and 844x390)", () => {
    const seLandscape = lettersLayout(667, 375, 8);
    expect(seLandscape.shortH).toBe(true);
    expect(seLandscape.cols).toBe(4);
    expect(seLandscape.rows).toBe(2);
    expect(seLandscape.tile).toBeGreaterThanOrEqual(80);

    const modernLandscape = lettersLayout(844, 390, 12);
    expect(modernLandscape.shortH).toBe(true);
    expect(modernLandscape.cols).toBe(6);
    expect(modernLandscape.rows).toBe(2);
    expect(modernLandscape.tile).toBeGreaterThanOrEqual(80);
  });

  it("handles tablet landscape and compact portrait dimensions", () => {
    const tablet = lettersLayout(1024, 768, 12);
    expect(tablet.shortH).toBe(false);
    expect(tablet.isLandscape).toBe(true);
    expect(tablet.cols).toBe(6);
    expect(tablet.rows).toBe(2);
    expect(tablet.speakerSize).toBe(80);

    const compactPortrait = lettersLayout(320, 480, 8);
    expect(compactPortrait.shortH).toBe(true);
    expect(compactPortrait.isLandscape).toBe(false);
    expect(compactPortrait.cols).toBe(4);
    expect(compactPortrait.rows).toBe(2);
  });
});
