import { describe, expect, it } from "vitest";
import { RHYME_WORDS, WORDS, soundsFor, wordFor } from "../words";

describe("RHYME_WORDS", () => {
  it("contains Level 2 minimal pairs with correct phonics and rhymeKeys", () => {
    const level2Words = [
      { icon: "cap", en: "cap", letter: "C", sound: "kuh", rhymeKey: "ap" },
      { icon: "cup", en: "cup", letter: "C", sound: "kuh", rhymeKey: "up" },
      { icon: "pan", en: "pan", letter: "P", sound: "puh", rhymeKey: "an" },
      { icon: "pen", en: "pen", letter: "P", sound: "puh", rhymeKey: "en" },
      { icon: "pin", en: "pin", letter: "P", sound: "puh", rhymeKey: "in" },
    ];

    for (const expected of level2Words) {
      const match = RHYME_WORDS.find((w) => w.icon === expected.icon);
      expect(match).toEqual(expected);
    }
  });

  it("contains Level 3 words with correct phonics and rhymeKeys", () => {
    const level3Words = [
      { icon: "wig", en: "wig", letter: "W", sound: "wuh", rhymeKey: "ig" },
      { icon: "dig", en: "dig", letter: "D", sound: "duh", rhymeKey: "ig" },
      { icon: "big", en: "big", letter: "B", sound: "buh", rhymeKey: "ig" },
      {
        icon: "block",
        en: "block",
        letter: "B",
        sound: "buh",
        rhymeKey: "ock",
      },
    ];

    for (const expected of level3Words) {
      const match = RHYME_WORDS.find((w) => w.icon === expected.icon);
      expect(match).toEqual(expected);
    }
  });

  it("has consistent letter, sound, and rhymeKey on all entries", () => {
    for (const entry of RHYME_WORDS) {
      expect(entry.icon).toBeTruthy();
      expect(entry.en).toBeTruthy();
      expect(entry.letter).toMatch(/^[A-Z]$/);
      expect(entry.sound).toBeTruthy();
      expect(entry.rhymeKey).toBeTruthy();
    }
  });
});

describe("words helpers", () => {
  it("wordFor returns localized word and romanization", () => {
    const cat = WORDS.find((w) => w.icon === "cat")!;
    expect(wordFor(cat, "en")).toEqual({ text: "cat", roman: "" });
    expect(wordFor(cat, "ja")).toEqual({ text: cat.ja, roman: cat.jaR });
    expect(wordFor(cat, "cmn")).toEqual({ text: cat.cmn, roman: cat.cmnR });
    expect(wordFor(cat, "yue")).toEqual({ text: cat.yue, roman: cat.yueR });
  });

  it("soundsFor returns sound and any alternate sounds", () => {
    const gift = WORDS.find((w) => w.icon === "gift")!;
    expect(soundsFor(gift)).toEqual(["puh", "guh"]);

    const plane = WORDS.find((w) => w.icon === "plane")!;
    expect(soundsFor(plane)).toEqual(["puh", "aa"]);

    const ladybug = WORDS.find((w) => w.icon === "ladybug")!;
    expect(soundsFor(ladybug)).toEqual(["lll", "buh"]);

    const cat = WORDS.find((w) => w.icon === "cat")!;
    expect(soundsFor(cat)).toEqual(["kuh"]);
  });
});

describe("WORDS", () => {
  it('assigns rhymeKey "ig" to pig for minimal pairs', () => {
    const pig = WORDS.find((w) => w.icon === "pig");
    expect(pig?.rhymeKey).toBe("ig");
  });

  it("assigns accurate Mandarin rhyme finals distinguishing -ie, -yu, -u, and excludes singleton car", () => {
    const crab = WORDS.find((w) => w.icon === "crab");
    const butterfly = WORDS.find((w) => w.icon === "butterfly");
    const fish = WORDS.find((w) => w.icon === "fish");
    const octopus = WORDS.find((w) => w.icon === "octopus");
    const pig = WORDS.find((w) => w.icon === "pig");
    const gift = WORDS.find((w) => w.icon === "gift");
    const car = WORDS.find((w) => w.icon === "car");

    expect(crab?.cmnRhyme).toBe("ie");
    expect(butterfly?.cmnRhyme).toBe("ie");
    expect(fish?.cmnRhyme).toBe("yu");
    expect(octopus?.cmnRhyme).toBe("yu");
    expect(pig?.cmnRhyme).toBe("u");
    expect(gift?.cmnRhyme).toBe("u");
    expect(car?.cmnRhyme).toBeUndefined();
  });

  it("differentiates short-a in apple from short-o in octopus", () => {
    const apple = WORDS.find((w) => w.icon === "apple");
    const octopus = WORDS.find((w) => w.icon === "octopus");
    expect(apple?.sound).toBe("aa");
    expect(octopus?.sound).toBe("ah");
  });
});
