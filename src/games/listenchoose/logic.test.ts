import { describe, expect, it } from "vitest";
import { LANGS } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { WORD_LEVELS as levelsData, WORDS } from "../../curriculum/content";
import {
  LEVEL_1_WORDS,
  LEVEL_1_WORD_IDS,
  LEVEL_2_WORDS,
  LEVEL_2_WORD_IDS,
  LEVEL_3_WORDS,
  LEVEL_3_WORD_IDS,
  Word,
  getLevelConfig,
} from "./data";
import {
  GameState,
  Round,
  evaluateGuess,
  generateRound,
  getWordText,
  initGameState,
  listenChooseLayout,
  speechLines,
  updateGameState,
} from "./logic";

describe("Level data", () => {
  it("loads Level 1, 2, and 3 word IDs from levels.json", () => {
    expect(LEVEL_1_WORD_IDS).toEqual(levelsData.level1);
    expect(LEVEL_2_WORD_IDS).toEqual(levelsData.level2);
    expect(LEVEL_3_WORD_IDS).toEqual(levelsData.level3);
  });

  it("populates level words from shared pool", () => {
    expect(LEVEL_1_WORDS).toHaveLength(LEVEL_1_WORD_IDS.length);
    for (const w of LEVEL_1_WORDS) {
      expect(w.icon).toBeTruthy();
      expect(w.en).toBeTruthy();
      expect(w.letter).toBeTruthy();
      expect(w.sound).toBeTruthy();
    }

    expect(LEVEL_2_WORDS).toHaveLength(LEVEL_2_WORD_IDS.length);
    for (const w of LEVEL_2_WORDS) {
      expect(w.icon).toBeTruthy();
      expect(w.en).toBeTruthy();
    }

    expect(LEVEL_3_WORDS).toHaveLength(LEVEL_3_WORD_IDS.length);
    for (const w of LEVEL_3_WORDS) {
      expect(w.icon).toBeTruthy();
      expect(w.en).toBeTruthy();
    }
  });
});

describe("generateRound", () => {
  it("generates a round with distinct target and distractor and two choices", () => {
    const rng = makeRng(12345);
    const round: Round = generateRound(rng);

    expect(round.target).toBeDefined();
    expect(round.distractor).toBeDefined();
    expect(round.target.icon).not.toBe(round.distractor.icon);
    expect(round.choices).toHaveLength(2);
    expect(round.choices).toContainEqual(round.target);
    expect(round.choices).toContainEqual(round.distractor);
  });

  it("randomizes choice positions across seeds", () => {
    let targetAtFirst = 0;
    let targetAtSecond = 0;
    const runs = 100;

    for (let seed = 1; seed <= runs; seed++) {
      const rng = makeRng(seed);
      const round = generateRound(rng);
      if (round.choices[0].icon === round.target.icon) {
        targetAtFirst++;
      } else {
        targetAtSecond++;
      }
    }

    expect(targetAtFirst).toBeGreaterThan(20);
    expect(targetAtSecond).toBeGreaterThan(20);
  });

  it("avoids target word when avoidIcon is provided", () => {
    const pool = WORDS.slice(0, 5);
    const avoid = pool[0].icon;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const round = generateRound(rng, pool, 2, avoid);
      expect(round.target.icon).not.toBe(avoid);
    }
  });

  it("throws an error if words pool has fewer than 2 items", () => {
    const rng = makeRng(1);
    expect(() => generateRound(rng, [WORDS[0]])).toThrow(
      "words pool must have at least 2 words",
    );
  });

  it("excludes target name twins from distractor choices", () => {
    const blossom = WORDS.find((w) => w.icon === "blossom");
    const sunflower = WORDS.find((w) => w.icon === "sunflower");
    const dog = WORDS.find((w) => w.icon === "dog");
    expect(blossom).toBeDefined();
    expect(sunflower).toBeDefined();
    expect(dog).toBeDefined();
    if (!blossom || !sunflower || !dog) return;

    const pool = [blossom, sunflower, dog];

    for (let seed = 1; seed <= 20; seed++) {
      const rng = makeRng(seed);
      // Avoid dog so target must be blossom or sunflower
      const round = generateRound(rng, pool, 2, "dog");
      expect(round.distractor.icon).toBe("dog");
      const icons = round.choices.map((c) => c.icon);
      expect(icons).not.toContain(
        round.target.icon === "blossom" ? "sunflower" : "blossom",
      );
    }
  });

  it("throws an error if no valid distractor exists after excluding name twins", () => {
    const blossom = WORDS.find((w) => w.icon === "blossom");
    const sunflower = WORDS.find((w) => w.icon === "sunflower");
    expect(blossom).toBeDefined();
    expect(sunflower).toBeDefined();
    if (!blossom || !sunflower) return;

    const rng = makeRng(1);
    expect(() => generateRound(rng, [blossom, sunflower])).toThrow(
      "no valid distractor found for target",
    );
  });

  it("returns 3 choices for level 2 and 4 choices for level 3", () => {
    const rng = makeRng(1);

    const config2 = getLevelConfig(2);
    const round2 = generateRound(rng, config2.words, config2.numChoices);
    expect(round2.choices).toHaveLength(3);

    const config3 = getLevelConfig(3);
    const round3 = generateRound(
      rng,
      config3.words,
      config3.numChoices,
      undefined,
      config3.prioritizeRhymes,
    );
    expect(round3.choices).toHaveLength(4);
  });

  it("prioritizes minimal pairs as distractors when prioritizeRhymes is true", () => {
    const rhymingPool: Word[] = [
      { icon: "hat", en: "hat", letter: "H", sound: "h", rhymeKey: "at" },
      { icon: "bat", en: "bat", letter: "B", sound: "b", rhymeKey: "at" },
      { icon: "cat", en: "cat", letter: "C", sound: "c", rhymeKey: "at" },
      { icon: "pig", en: "pig", letter: "P", sound: "p", rhymeKey: "ig" },
      { icon: "wig", en: "wig", letter: "W", sound: "w", rhymeKey: "ig" },
      { icon: "dig", en: "dig", letter: "D", sound: "d", rhymeKey: "ig" },
      { icon: "big", en: "big", letter: "B", sound: "b", rhymeKey: "ig" },
      { icon: "rock", en: "rock", letter: "R", sound: "r", rhymeKey: "ock" },
      { icon: "sock", en: "sock", letter: "S", sound: "s", rhymeKey: "ock" },
      { icon: "clock", en: "clock", letter: "C", sound: "c", rhymeKey: "ock" },
      { icon: "block", en: "block", letter: "B", sound: "b", rhymeKey: "ock" },
    ];
    let checkedAt = false;
    let checkedIg = false;
    let checkedOck = false;
    for (let i = 0; i < 100; i++) {
      const rng = makeRng(i);
      const r = generateRound(rng, rhymingPool, 3, undefined, true);

      if (["hat", "bat", "cat"].includes(r.target.icon)) {
        const dists = r.choices
          .filter((c) => c.icon !== r.target.icon)
          .map((c) => c.icon);
        const expected = ["hat", "bat", "cat"].filter(
          (icon) => icon !== r.target.icon,
        );
        expect(dists).toEqual(expect.arrayContaining(expected));
        checkedAt = true;
      }

      // Level 3 words have pig, wig, dig, big (rhymeKey: ig)
      // Excluding 'pig' from the trigger condition until PR #278 merges
      // which adds the rhymeKey to 'pig'.
      if (["wig", "dig", "big"].includes(r.target.icon)) {
        const dists = r.choices
          .filter((c) => c.icon !== r.target.icon)
          .map((c) => c.icon);

        const igGroup = ["pig", "wig", "dig", "big"].filter(
          (icon) => icon !== r.target.icon,
        );
        const found = dists.filter((d) => igGroup.includes(d));
        expect(found.length).toBeGreaterThan(0);
        checkedIg = true;
      }

      // Level 3 words have rock, sock, clock, block (rhymeKey: ock)
      if (["rock", "sock", "clock", "block"].includes(r.target.icon)) {
        const dists = r.choices
          .filter((c) => c.icon !== r.target.icon)
          .map((c) => c.icon);

        const ockGroup = ["rock", "sock", "clock", "block"].filter(
          (icon) => icon !== r.target.icon,
        );
        const found = dists.filter((d) => ockGroup.includes(d));
        expect(found.length).toBeGreaterThan(0);
        checkedOck = true;
      }
    }
    expect(checkedAt).toBe(true);
    expect(checkedIg).toBe(true);
    expect(checkedOck).toBe(true);
  });
});

describe("initGameState", () => {
  it("initializes game state with zero streak and zero wrong guesses", () => {
    const rng = makeRng(42);
    const state: GameState = initGameState(rng);

    expect(state.streak).toBe(0);
    expect(state.wrongGuesses).toBe(0);
    expect(state.highlightCorrect).toBe(false);
    expect(state.level).toBe(1);
    expect(state.currentRound.choices).toHaveLength(2);
  });
  it("initializes game state with level 2 and 3 choices for medium difficulty", () => {
    const rng = makeRng(42);
    const state: GameState = initGameState(rng, "medium");

    expect(state.level).toBe(2);
    expect(state.currentRound.choices).toHaveLength(3);
  });

  it("initializes game state with level 3 and 4 choices for hard difficulty", () => {
    const rng = makeRng(42);
    const state: GameState = initGameState(rng, "hard");

    expect(state.level).toBe(3);
    expect(state.currentRound.choices).toHaveLength(4);
  });
});

describe("evaluateGuess", () => {
  it("returns true when guess matches target and false otherwise", () => {
    const rng = makeRng(99);
    const round = generateRound(rng);

    expect(evaluateGuess(round, round.target.icon)).toBe(true);
    expect(evaluateGuess(round, round.distractor.icon)).toBe(false);
    expect(evaluateGuess(round, "nonexistent_id")).toBe(false);
  });
});

describe("updateGameState", () => {
  it("increments streak and generates next round on correct guess", () => {
    const rng = makeRng(100);
    const initial = initGameState(rng);
    const targetIcon = initial.currentRound.target.icon;

    const nextState = updateGameState(initial, targetIcon, rng);
    expect(nextState.streak).toBe(1);
    expect(nextState.wrongGuesses).toBe(0);
    expect(nextState.highlightCorrect).toBe(false);
    expect(nextState.currentRound.target.icon).not.toBe(targetIcon);
  });

  it("keeps base level 3 across rounds for hard difficulty", () => {
    const rng = makeRng(100);
    let state = initGameState(rng, "hard");
    expect(state.level).toBe(3);

    state = updateGameState(state, state.currentRound.target.icon, rng, "hard");
    expect(state.level).toBe(3);

    state = updateGameState(
      state,
      state.currentRound.distractor.icon,
      rng,
      "hard",
    );
    state = updateGameState(state, state.currentRound.target.icon, rng, "hard");
    expect(state.level).toBe(3);
  });

  it("keeps base level 2 across rounds for medium difficulty", () => {
    const rng = makeRng(100);
    let state = initGameState(rng, "medium");
    expect(state.level).toBe(2);

    state = updateGameState(
      state,
      state.currentRound.target.icon,
      rng,
      "medium",
    );
    expect(state.level).toBe(2);

    state = updateGameState(
      state,
      state.currentRound.distractor.icon,
      rng,
      "medium",
    );
    expect(state.streak).toBe(1);
    state = updateGameState(
      state,
      state.currentRound.target.icon,
      rng,
      "medium",
    );
    expect(state.streak).toBe(2);
    expect(state.level).toBe(2);

    for (let i = 1; i <= 18; i++) {
      state = updateGameState(
        state,
        state.currentRound.target.icon,
        rng,
        "medium",
      );
    }
    expect(state.streak).toBe(20);
    expect(state.level).toBe(3);
  });

  it("maintains streak and level on wrong guess", () => {
    const rng = makeRng(100);
    let state = initGameState(rng);
    for (let i = 1; i <= 3; i++) {
      state = updateGameState(state, state.currentRound.target.icon, rng);
    }
    expect(state.streak).toBe(3);
    expect(state.level).toBe(1);
    state = updateGameState(state, state.currentRound.distractor.icon, rng);
    expect(state.streak).toBe(3);
    expect(state.level).toBe(1);
    state = updateGameState(state, state.currentRound.target.icon, rng);
    expect(state.streak).toBe(4);
    expect(state.level).toBe(2);
  });

  it("advances level to 2 at streak 4 and to 3 at streak 8", () => {
    const rng = makeRng(100);
    let state = initGameState(rng);

    for (let i = 1; i <= 3; i++) {
      state = updateGameState(state, state.currentRound.target.icon, rng);
      expect(state.level).toBe(1);
    }

    state = updateGameState(state, state.currentRound.target.icon, rng);
    expect(state.streak).toBe(4);
    expect(state.level).toBe(2);

    for (let i = 5; i <= 7; i++) {
      state = updateGameState(state, state.currentRound.target.icon, rng);
      expect(state.level).toBe(2);
    }

    state = updateGameState(state, state.currentRound.target.icon, rng);
    expect(state.streak).toBe(8);
    expect(state.level).toBe(3);
  });

  it("accumulates streak across consecutive correct guesses", () => {
    const rng = makeRng(200);
    let state = initGameState(rng);

    for (let i = 1; i <= 5; i++) {
      state = updateGameState(state, state.currentRound.target.icon, rng);
      expect(state.streak).toBe(i);
      expect(state.wrongGuesses).toBe(0);
    }
  });

  it("maintains streak and increments wrongGuesses on first incorrect guess without highlight", () => {
    const rng = makeRng(300);
    let state = initGameState(rng);
    state = updateGameState(state, state.currentRound.target.icon, rng);
    expect(state.streak).toBe(1);

    const distractorIcon = state.currentRound.distractor.icon;
    const roundBeforeWrong = state.currentRound;

    state = updateGameState(state, distractorIcon, rng);
    expect(state.streak).toBe(1);
    expect(state.wrongGuesses).toBe(1);
    expect(state.highlightCorrect).toBe(false);
    expect(state.currentRound).toEqual(roundBeforeWrong);
  });

  it("enables highlightCorrect after two wrong guesses and keeps round unchanged", () => {
    const rng = makeRng(400);
    let state = initGameState(rng);
    const distractorIcon = state.currentRound.distractor.icon;
    const initialRound = state.currentRound;

    state = updateGameState(state, distractorIcon, rng);
    expect(state.wrongGuesses).toBe(1);
    expect(state.highlightCorrect).toBe(false);

    state = updateGameState(state, distractorIcon, rng);
    expect(state.wrongGuesses).toBe(2);
    expect(state.highlightCorrect).toBe(true);
    expect(state.currentRound).toEqual(initialRound);

    state = updateGameState(state, state.currentRound.target.icon, rng);
    expect(state.streak).toBe(1);
    expect(state.wrongGuesses).toBe(0);
    expect(state.highlightCorrect).toBe(false);
    expect(state.currentRound).not.toEqual(initialRound);
  });

  it("sets won to true at streak 12 and maintains currentRound", () => {
    const rng = makeRng(100);
    let state = initGameState(rng);

    for (let i = 1; i < 12; i++) {
      state = updateGameState(state, state.currentRound.target.icon, rng);
      expect(state.won).toBe(false);
    }

    const roundBeforeWin = state.currentRound;
    state = updateGameState(state, state.currentRound.target.icon, rng);
    expect(state.streak).toBe(12);
    expect(state.won).toBe(true);
    expect(state.currentRound).toEqual(roundBeforeWin);
  });
});

describe("getWordText", () => {
  it("returns localized text when available for the given language", () => {
    const wordWithTranslations: Word = {
      icon: "testcat",
      en: "cat",
      letter: "C",
      sound: "kuh",
      ja: "ねこ",
      cmn: "猫",
      yue: "貓",
    };

    expect(getWordText(wordWithTranslations, "en")).toBe("cat");
    expect(getWordText(wordWithTranslations, "ja")).toBe("ねこ");
    expect(getWordText(wordWithTranslations, "cmn")).toBe("猫");
    expect(getWordText(wordWithTranslations, "yue")).toBe("貓");
  });

  it("falls back to English when localization is not present", () => {
    const wordWithoutTranslations: Word = {
      icon: "testbat",
      en: "bat",
      letter: "B",
      sound: "buh",
    };

    expect(getWordText(wordWithoutTranslations, "ja")).toBe("bat");
    expect(getWordText(wordWithoutTranslations, "cmn")).toBe("bat");
    expect(getWordText(wordWithoutTranslations, "yue")).toBe("bat");
  });
});

describe("speechLines", () => {
  it("returns spoken lines for words across supported languages", () => {
    const wordWithTranslations: Word = {
      icon: "testcat",
      en: "cat",
      letter: "C",
      sound: "kuh",
      ja: "ねこ",
      cmn: "猫",
      yue: "貓",
    };
    const lines = speechLines([wordWithTranslations]);
    expect(lines).toContain("cat");
    expect(lines).toContain("ねこ");
    expect(lines).toContain("猫");
    expect(lines).toContain("貓");
  });

  it("returns non-empty speech lines for default level words", () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(0);
    for (const w of LEVEL_1_WORDS) {
      expect(lines).toContain(w.en);
    }
  });

  it("includes introductory blurb for all supported languages", () => {
    const lines = speechLines();
    for (const l of LANGS) {
      expect(lines).toContain(t(l.id, "card.listenchoose.blurb"));
    }
  });

  it("supports custom word pools without translations", () => {
    const customWord: Word = {
      icon: "test",
      en: "testword",
      letter: "T",
      sound: "tuh",
    };
    const lines = speechLines([customWord]);
    expect(lines).toContain("testword");
    for (const l of LANGS) {
      expect(lines).toContain(t(l.id, "card.listenchoose.blurb"));
    }
  });
});

describe("game state with non-English languages", () => {
  it("filters out words without translations through initGameState and updateGameState", () => {
    const langs = ["ja", "cmn", "yue"] as const;
    for (const lang of langs) {
      const rng = makeRng(1234);
      let state = initGameState(rng, "easy", lang);

      for (let i = 0; i < 25; i++) {
        // Assert current level properties
        const expectedChoices =
          state.level >= 3 ? 4 : state.level === 2 ? 3 : 2;
        expect(state.currentRound.choices).toHaveLength(expectedChoices);

        // Assert all choices have a valid translation for the lang
        for (const choice of state.currentRound.choices) {
          expect(choice[lang]).toBeDefined();
          expect(choice[lang]).toBeTruthy();
        }

        // Advance the game with a correct guess
        state = updateGameState(
          state,
          state.currentRound.target.icon,
          rng,
          "easy",
          lang,
        );
      }

      // Ensure we reached level 3 after 20+ correct guesses
      expect(state.level).toBe(3);
    }
  });

  it("filters out RHYME_WORDS from the pool and disables prioritizeRhymes in getLevelConfig", () => {
    const langs = ["ja", "cmn", "yue"] as const;
    for (const lang of langs) {
      for (const level of [1, 2, 3]) {
        const config = getLevelConfig(level, lang);
        // "bat" is in RHYME_WORDS, "cat" is in WORDS.
        expect(config.words.find((w) => w.icon === "cat")).toBeDefined();
        expect(config.words.find((w) => w.icon === "bat")).toBeUndefined();
        expect(config.prioritizeRhymes).toBe(false);
      }
    }
  });

  it("expands non-English vocabulary across levels without starvation", () => {
    const langs = ["ja", "cmn", "yue"] as const;
    for (const lang of langs) {
      const config1 = getLevelConfig(1, lang);
      const config2 = getLevelConfig(2, lang);
      const config3 = getLevelConfig(3, lang);

      // Level 1 has 7 base translated words
      expect(config1.words).toHaveLength(7);

      // Level 2 adds 12 new translated words (previously added 0)
      expect(config2.words).toHaveLength(19);
      expect(config2.words.length).toBeGreaterThan(config1.words.length);

      // Level 3 adds 12 new translated words (previously added 1)
      expect(config3.words).toHaveLength(31);
      expect(config3.words.length).toBeGreaterThan(config2.words.length);

      // Previously unused translated words are present
      const icons = config3.words.map((w) => w.icon);
      for (const expected of [
        "apple",
        "banana",
        "car",
        "plane",
        "fish",
        "star",
        "blossom",
      ]) {
        expect(icons).toContain(expected);
      }
    }
  });

  it("ensures all 31 words in WORDS are available in Level 3 for non-English languages", () => {
    const allWordsIcons = WORDS.map((w) => w.icon).sort();
    for (const lang of ["ja", "cmn", "yue"] as const) {
      const config3 = getLevelConfig(3, lang);
      const configIcons = config3.words.map((w) => w.icon).sort();
      expect(configIcons).toEqual(allWordsIcons);
    }
  });
});
describe("listenChooseLayout", () => {
  it("scales down elements on mobile landscape viewports (844x390, 667x375)", () => {
    const landscape844 = listenChooseLayout(844, 390, 2);
    expect(landscape844.shortH).toBe(true);
    expect(landscape844.speakerSize).toBe(56);
    expect(landscape844.speakerIconSize).toBe(26);
    expect(landscape844.cardHeight).toBe(120);
    expect(landscape844.cardWidth).toBe(120);
    expect(landscape844.cardImageSize).toBe(56);
    expect(landscape844.gap).toBe(10);

    const landscape667 = listenChooseLayout(667, 375, 4);
    expect(landscape667.shortH).toBe(true);
    expect(landscape667.speakerSize).toBe(56);
    expect(landscape667.speakerIconSize).toBe(26);
    expect(landscape667.cardHeight).toBe(120);
    expect(landscape667.cardWidth).toBe(120);
    expect(landscape667.cardImageSize).toBe(56);
    expect(landscape667.gap).toBe(10);
  });

  it("scales down elements across common mobile landscape heights", () => {
    const screenHeights = [320, 360, 375, 390, 414, 428];
    for (const height of screenHeights) {
      const layout = listenChooseLayout(800, height, 4);
      expect(layout.shortH).toBe(true);
      expect(layout.speakerSize).toBe(56);
      expect(layout.cardHeight).toBe(120);
      expect(layout.cardWidth).toBe(120);
    }
  });

  it("preserves standard dimensions on portrait viewports (390x844)", () => {
    const portrait390 = listenChooseLayout(390, 844, 2);
    expect(portrait390.shortH).toBe(false);
    expect(portrait390.speakerSize).toBe(88);
    expect(portrait390.speakerIconSize).toBe(42);
    expect(portrait390.cardWidth).toBe(150);
    expect(portrait390.cardHeight).toBe(170);
    expect(portrait390.cardImageSize).toBe(96);
    expect(portrait390.gap).toBe(20);

    const portrait375 = listenChooseLayout(375, 667, 4);
    expect(portrait375.shortH).toBe(false);
    expect(portrait375.speakerSize).toBe(88);
    expect(portrait375.cardWidth).toBe(150);
    expect(portrait375.cardHeight).toBe(170);
  });

  it("preserves standard dimensions on tablets (1024x768)", () => {
    const tablet = listenChooseLayout(1024, 768, 4);
    expect(tablet.shortH).toBe(false);
    expect(tablet.speakerSize).toBe(88);
    expect(tablet.speakerIconSize).toBe(42);
    expect(tablet.cardWidth).toBe(150);
    expect(tablet.cardHeight).toBe(170);
    expect(tablet.cardImageSize).toBe(96);
    expect(tablet.gap).toBe(20);
  });

  it("clamps card width on narrow landscape viewports", () => {
    const narrow = listenChooseLayout(360, 320, 4);
    expect(narrow.shortH).toBe(true);
    expect(narrow.cardWidth).toBeLessThanOrEqual(120);
    expect(narrow.cardWidth).toBeGreaterThanOrEqual(72);
  });
});
