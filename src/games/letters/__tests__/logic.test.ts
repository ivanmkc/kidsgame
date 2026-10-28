import { describe, expect, it } from "vitest";
import { LETTER_SOUNDS, makeLetterRound, shouldShowGlyph } from "../logic";

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
