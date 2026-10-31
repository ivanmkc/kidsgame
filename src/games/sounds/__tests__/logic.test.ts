import { describe, expect, it } from "vitest";
import { WORDS, soundsFor } from "../../../curriculum/content";
import { manifest } from "../../../manifest";
import { makeRng } from "../../../rng";
import {
  makeSoundsRound,
  resolveSoundsPrompts,
  settingsForSounds,
  soundsLayout,
  speechLines,
} from "../logic";

describe("soundsLayout", () => {
  it("enlarges tiles to 1x4 row across mobile landscape screens", () => {
    // Android landscape (780x360) with 4 tiles (Medium/Hard)
    const androidLandscape = soundsLayout(780, 360, 4);
    expect(androidLandscape.tile).toBe(139.5);
    expect(androidLandscape.gridWidth).toBe(600);
    expect(androidLandscape.gap).toBe(14);

    // iPhone landscape (844x390)
    const iphoneLandscape = soundsLayout(844, 390, 4);
    expect(iphoneLandscape.tile).toBe(139.5);
    expect(iphoneLandscape.gridWidth).toBe(600);

    // Compact landscape (667x375)
    const compactLandscape = soundsLayout(667, 375, 4);
    expect(compactLandscape.tile).toBe(139.5);
    expect(compactLandscape.gridWidth).toBe(600);

    // Small landscape (568x320)
    const smallLandscape = soundsLayout(568, 320, 4);
    expect(smallLandscape.tile).toBe(106);
    expect(smallLandscape.gridWidth).toBe(466);
  });

  it("preserves 2x2 grid with 170px tiles on tablet/desktop landscape", () => {
    // iPad landscape (1024x768)
    const tabletLandscape = soundsLayout(1024, 768, 4);
    expect(tabletLandscape.tile).toBe(170);
    expect(tabletLandscape.gridWidth).toBe(354);

    // Desktop/laptop landscape (1366x768)
    const desktopLandscape = soundsLayout(1366, 768, 4);
    expect(desktopLandscape.tile).toBe(170);
    expect(desktopLandscape.gridWidth).toBe(354);
  });

  it("preserves 2x2 grid with 170px tiles on mobile portrait", () => {
    // iPhone portrait (390x844) with 4 tiles
    const iphonePortrait = soundsLayout(390, 844, 4);
    expect(iphonePortrait.tile).toBe(170);
    expect(iphonePortrait.gridWidth).toBe(354);
  });

  it("sizes 3 tiles correctly across orientations", () => {
    // Landscape (780x360) with 3 tiles (Easy)
    const landscape3 = soundsLayout(780, 360, 3);
    expect(landscape3.tile).toBe(146);
    expect(landscape3.gridWidth).toBe(466);

    // Portrait (390x844) with 3 tiles (Easy)
    const portrait3 = soundsLayout(390, 844, 3);
    expect(portrait3.tile).toBe(110);
    expect(portrait3.gridWidth).toBe(358);
  });

  it("keeps 2x2 grid with 170px tiles on square screen", () => {
    const square = soundsLayout(600, 600, 4);
    expect(square.tile).toBe(170);
    expect(square.gridWidth).toBe(354);
  });

  it("clamps tile size to 0 on short or narrow screens where dimensions would be negative", () => {
    // Screen height less than 214px (e.g. 210px or 200px)
    const shortLandscape4 = soundsLayout(800, 210, 4);
    expect(shortLandscape4.tile).toBe(0);

    const shortLandscape3 = soundsLayout(800, 200, 3);
    expect(shortLandscape3.tile).toBe(0);

    // Narrow screen (e.g. width < 32px)
    const narrowScreen = soundsLayout(20, 600, 4);
    expect(narrowScreen.tile).toBe(0);

    const tinyScreen = soundsLayout(20, 100, 4);
    expect(tinyScreen.tile).toBe(0);
  });
});

describe("makeSoundsRound", () => {
  it('excludes plane as distractor when target sound is "aa"', () => {
    // Plane can be called "airplane" ('aa'), so it must not be a distractor
    // when prompting for 'aa' (e.g. apple).
    const icons = ["apple", "plane", "rocket"];
    const rng = () => 0;
    const round = makeSoundsRound(rng, icons, "en", 3);
    expect(round.target.icon).toBe("apple");
    const tileIcons = round.tiles.map((t) => t.icon);
    expect(tileIcons).not.toContain("plane");
  });

  it('excludes ladybug as distractor when target sound is "buh"', () => {
    // Ladybug can be called "bug" ('buh'), so it must not be a distractor
    // when prompting for 'buh' (e.g. butterfly).
    const icons = ["butterfly", "ladybug", "rocket"];
    const rng = () => 0;
    const round = makeSoundsRound(rng, icons, "en", 3);
    expect(round.target.icon).toBe("butterfly");
    const tileIcons = round.tiles.map((t) => t.icon);
    expect(tileIcons).not.toContain("ladybug");
  });

  it("indexes master WORDS array in tile wordIdx", () => {
    const icons = ["apple", "rocket", "butterfly"];
    const rng = () => 0;
    const round = makeSoundsRound(rng, icons, "en", 3);
    for (const tile of round.tiles) {
      expect(WORDS[tile.wordIdx].icon).toBe(tile.icon);
    }
  });

  it("does not select distractors that share phonic sounds via altSounds", () => {
    // Rabbit has sound 'rrr' and altSound 'buh' (bunny). Banana has sound 'buh'.
    // Target is star ('sss'). Distractors must not include both rabbit and banana.
    const icons = ["star", "rabbit", "banana", "dog", "lion"];
    const round = makeSoundsRound(() => 0, icons, "en", 4);
    const distractorIcons = round.tiles
      .filter((t) => !t.isAnswer)
      .map((t) => t.icon);
    const hasRabbit = distractorIcons.includes("rabbit");
    const hasBanana = distractorIcons.includes("banana");
    expect(hasRabbit && hasBanana).toBe(false);
  });

  it("avoids distractor phonic collisions across rounds on hard difficulty", () => {
    for (const seed of [5, 8, 9]) {
      const round = makeSoundsRound(
        makeRng(seed),
        manifest.spotit.icons,
        "en",
        6,
      );
      const distractors = round.tiles
        .filter((t) => !t.isAnswer)
        .map((t) => WORDS[t.wordIdx]);
      const seenSounds = new Set<string>();
      for (const w of distractors) {
        for (const s of soundsFor(w)) {
          expect(seenSounds.has(s)).toBe(false);
          seenSounds.add(s);
        }
      }
    }
  });
});

describe("settingsForSounds", () => {
  it("scales rounds and tiles with difficulty", () => {
    expect(settingsForSounds("easy")).toEqual({ rounds: 8, tiles: 3 });
    expect(settingsForSounds("medium")).toEqual({ rounds: 10, tiles: 4 });
    expect(settingsForSounds("hard")).toEqual({ rounds: 12, tiles: 6 });
  });
});
describe("soundsLayout 6 tiles", () => {
  it("computes reasonable sizes for 6 tiles", () => {
    const l1 = soundsLayout(780, 360, 6);
    expect(l1.tile).toBeGreaterThan(0);
    const l2 = soundsLayout(390, 844, 6);
    expect(l2.tile).toBeGreaterThan(0);
    const l3 = soundsLayout(1024, 768, 6);
    expect(l3.tile).toBeGreaterThan(0);
  });
});

describe("resolveSoundsPrompts", () => {
  it("provides localized confirmation lines without English translation in non-EN languages", () => {
    const cat = WORDS.find((w) => w.en === "cat")!;
    expect(resolveSoundsPrompts(cat, "ja").confirmLines).toEqual(["ねこ！"]);
    expect(resolveSoundsPrompts(cat, "cmn").confirmLines).toEqual(["猫！"]);
    expect(resolveSoundsPrompts(cat, "yue").confirmLines).toEqual(["貓！"]);
  });

  it("provides English confirmation lines in English mode", () => {
    const cat = WORDS.find((w) => w.en === "cat")!;
    expect(resolveSoundsPrompts(cat, "en").confirmLines).toEqual([
      "Cat!",
      "Cat starts with kuh!",
    ]);
  });

  it("returns newly combined translated prompts as single prompt line", () => {
    const cat = WORDS.find((w) => w.en === "cat")!;
    expect(resolveSoundsPrompts(cat, "ja").promptLines).toEqual([
      "どれかな？ ねこ",
    ]);
    expect(resolveSoundsPrompts(cat, "ja").displayPrompt).toBe(
      "どれかな？ ねこ",
    );
    expect(resolveSoundsPrompts(cat, "cmn").promptLines).toEqual([
      "哪一个是 猫？",
    ]);
    expect(resolveSoundsPrompts(cat, "cmn").displayPrompt).toBe("哪一个是 猫？");
    expect(resolveSoundsPrompts(cat, "yue").promptLines).toEqual([
      "邊個係 貓？",
    ]);
    expect(resolveSoundsPrompts(cat, "yue").displayPrompt).toBe("邊個係 貓？");
    expect(resolveSoundsPrompts(cat, "en").promptLines).toEqual([
      "Which one starts with kuh?",
    ]);
    expect(resolveSoundsPrompts(cat, "en").displayPrompt).toBe(
      "Which one starts with kuh?",
    );
  });
});

describe("speechLines", () => {
  it("returns newly combined translated prompts across languages without standalone carrier strings", () => {
    const lines = speechLines();
    expect(lines).toContain("Which one starts with kuh?");
    expect(lines).toContain("どれかな？ ねこ");
    expect(lines).toContain("哪一个是 猫？");
    expect(lines).toContain("邊個係 貓？");
    expect(lines).not.toContain("どれかな？");
    expect(lines).not.toContain("哪一个是？");
    expect(lines).not.toContain("邊個係？");
  });
});
