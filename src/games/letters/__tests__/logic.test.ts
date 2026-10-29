import { describe, expect, it } from "vitest";
import { t } from "../../../i18n";
import { makeRng } from "../../../rng";
import {
  KANA_POOL,
  LETTER_SOUNDS,
  kanaConfusableGroup,
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
