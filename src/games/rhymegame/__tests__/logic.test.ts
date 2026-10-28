import { describe, expect, it } from "vitest";
import { manifest } from "../../../manifest";
import {
  availableEntries,
  makeRhymeRound,
  playableFamilies,
  rhymeLayout,
} from "../logic";

describe("rhymeLayout", () => {
  it("prioritizes answer tiles on mobile landscape viewports (844x390, 667x375)", () => {
    // Repro case: viewport 844x390 shrank tiles to 44px dots while leaving prompt card >150px
    const landscape844 = rhymeLayout(844, 390);
    expect(landscape844.shortH).toBe(true);
    expect(landscape844.tile).toBeGreaterThanOrEqual(80);
    expect(landscape844.tile).toBeLessThanOrEqual(100);
    expect(landscape844.tile).toBe(91);
    expect(landscape844.promptIcon).toBeLessThanOrEqual(68);
    expect(landscape844.promptIcon).toBeGreaterThanOrEqual(56);
    expect(landscape844.promptIcon).toBe(68);

    // Repro case: viewport 667x375
    const landscape667 = rhymeLayout(667, 375);
    expect(landscape667.shortH).toBe(true);
    expect(landscape667.tile).toBeGreaterThanOrEqual(80);
    expect(landscape667.tile).toBeLessThanOrEqual(100);
    expect(landscape667.tile).toBe(87);
    expect(landscape667.promptIcon).toBe(68);
  });

  it("allocates 80-100px for answer tiles across mobile landscape screen heights", () => {
    const screenHeights = [360, 375, 390, 414, 428];
    for (const height of screenHeights) {
      const layout = rhymeLayout(800, height);
      expect(layout.shortH).toBe(true);
      expect(layout.tile).toBeGreaterThanOrEqual(80);
      expect(layout.tile).toBeLessThanOrEqual(100);
      expect(layout.promptIcon).toBeLessThanOrEqual(68);
      expect(layout.promptIcon).toBeGreaterThanOrEqual(48);
    }
  });

  it("preserves full tile and prompt sizing on mobile portrait screens", () => {
    // iPhone 12/13/14 portrait (390x844)
    const portrait390 = rhymeLayout(390, 844);
    expect(portrait390.shortH).toBe(false);
    expect(portrait390.tile).toBe(110);
    expect(portrait390.promptIcon).toBe(110);

    // iPhone SE portrait (375x667)
    const portrait375 = rhymeLayout(375, 667);
    expect(portrait375.shortH).toBe(false);
    expect(portrait375.tile).toBe(105);
    expect(portrait375.promptIcon).toBe(110);
  });

  it("preserves spacious layout on tablets in landscape (1024x768)", () => {
    const tablet = rhymeLayout(1024, 768);
    expect(tablet.shortH).toBe(false);
    expect(tablet.tile).toBe(160);
    expect(tablet.promptIcon).toBe(110);
  });

  it("clamps tile and promptIcon gracefully on extreme small viewports", () => {
    const tiny = rhymeLayout(320, 320);
    expect(tiny.shortH).toBe(true);
    expect(tiny.tile).toBeGreaterThanOrEqual(44);
    expect(tiny.promptIcon).toBeGreaterThanOrEqual(48);
  });
});

describe("makeRhymeRound", () => {
  it("filters out distractors that share a nameTwin with target or correct answer", () => {
    const entries: import("../logic").RhymeEntry[] = [
      {
        icon: "blossom",
        en: "blossom",
        word: "blossom",
        roman: "",
        rhymeKey: "A",
        bucket: "spotit",
        nameTwins: ["sunflower"],
      },
      {
        icon: "possum",
        en: "possum",
        word: "possum",
        roman: "",
        rhymeKey: "A",
        bucket: "spotit",
      },
      {
        icon: "tower",
        en: "tower",
        word: "tower",
        roman: "",
        rhymeKey: "B",
        bucket: "spotit",
      },
      {
        icon: "sunflower",
        en: "sunflower",
        word: "sunflower",
        roman: "",
        rhymeKey: "B",
        bucket: "spotit",
        nameTwins: ["blossom"],
      },
      {
        icon: "frog",
        en: "frog",
        word: "frog",
        roman: "",
        rhymeKey: "C",
        bucket: "spotit",
      },
      {
        icon: "dog",
        en: "dog",
        word: "dog",
        roman: "",
        rhymeKey: "C",
        bucket: "spotit",
      },
    ];
    const rng = () => 0; // Picks Family A, 'blossom'
    const round = makeRhymeRound(rng, entries, 3, "en");

    expect(round.target.icon).toBe("blossom");
    const answer = round.tiles.find((t) => t.isAnswer);
    expect(answer?.icon).toBe("possum");
    const distractorIcons = round.tiles
      .filter((t) => !t.isAnswer)
      .map((t) => t.icon);
    expect(distractorIcons).not.toContain("sunflower");
    expect(distractorIcons).toContain("tower");
    expect(distractorIcons).toHaveLength(2);
  });

  it('attaches localized word to each RhymeTile in the round', () => {
    const entries: import('../logic').RhymeEntry[] = [
      { icon: 'blossom', en: 'flower', word: 'はな', roman: 'hana', rhymeKey: 'A', bucket: 'spotit' },
      { icon: 'frog', en: 'frog', word: 'かえる', roman: 'kaeru', rhymeKey: 'A', bucket: 'spotit' },
      { icon: 'cat', en: 'cat', word: 'ねこ', roman: 'neko', rhymeKey: 'B', bucket: 'spotit' },
      { icon: 'dog', en: 'dog', word: 'いぬ', roman: 'inu', rhymeKey: 'B', bucket: 'spotit' },
    ];
    const rng = () => 0;
    const round = makeRhymeRound(rng, entries, 3, 'ja');
    expect(round.tiles).toHaveLength(3);
    for (const tile of round.tiles) {
      const matchingEntry = entries.find((e) => e.icon === tile.icon);
      expect(matchingEntry).toBeDefined();
      expect(tile.word).toBe(matchingEntry!.word);
    }
  });
});


describe("Mandarin rhyme families", () => {
  it("separates -ie and -yu from -u, and excludes singleton car", () => {
    const cmnEntries = availableEntries("cmn", manifest.spotit.icons);
    const families = playableFamilies(cmnEntries);

    expect(families["ie"].map((e) => e.icon).sort()).toEqual([
      "butterfly",
      "crab",
    ]);
    expect(families["yu"].map((e) => e.icon).sort()).toEqual([
      "fish",
      "octopus",
    ]);
    expect(families["u"].map((e) => e.icon).sort()).toEqual(["gift", "pig"]);
    expect(families["e"]).toBeUndefined();
    expect(cmnEntries.some((e) => e.icon === "car")).toBe(false);
  });

  it("correctly rhymes -ie pair (crab / butterfly) and -yu pair (fish / octopus)", () => {
    const cmnEntries = availableEntries("cmn", manifest.spotit.icons);
    const ieEntries = cmnEntries.filter((e) => e.rhymeKey === "ie");
    const yuEntries = cmnEntries.filter((e) => e.rhymeKey === "yu");
    const uEntries = cmnEntries.filter((e) => e.rhymeKey === "u");
    const pool = [...ieEntries, ...yuEntries, ...uEntries];

    // Target crab in -ie family
    const crabRound = makeRhymeRound(() => 0, pool, 3, "cmn", ["yu", "u"]);
    expect(crabRound.target.icon).toBe("crab");
    expect(crabRound.tiles[crabRound.answerIdx].icon).toBe("butterfly");
    expect(crabRound.confirmLines).toEqual(["螃蟹，蝴蝶！押韵！"]);

    // Target octopus in -yu family
    const yuRound = makeRhymeRound(() => 0, pool, 3, "cmn", ["ie", "u"]);
    expect(yuRound.target.icon).toBe("octopus");
    expect(yuRound.tiles[yuRound.answerIdx].icon).toBe("fish");
    expect(yuRound.confirmLines).toEqual(["章鱼，鱼！押韵！"]);

    // Target pig in -u family
    const uRound = makeRhymeRound(() => 0, pool, 3, "cmn", ["ie", "yu"]);
    expect(uRound.target.icon).toBe("pig");
    expect(uRound.tiles[uRound.answerIdx].icon).toBe("gift");
    expect(uRound.confirmLines).toEqual(["猪，礼物！押韵！"]);
  });
});
