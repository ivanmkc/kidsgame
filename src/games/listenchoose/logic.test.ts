import { describe, expect, it } from "vitest";
import { makeRng } from "../../rng";
import { WORDS } from "../../words";
import { LEVEL_1_WORDS, LEVEL_1_WORD_IDS, Word } from "./data";
import {
  GameState,
  Round,
  evaluateGuess,
  generateRound,
  getWordText,
  initGameState,
  speechLines,
  updateGameState,
} from "./logic";

describe("Level 1 data", () => {
  it("exports Level 1 word IDs matching the approved design spec", () => {
    expect(LEVEL_1_WORD_IDS).toHaveLength(20);
    expect(new Set(LEVEL_1_WORD_IDS).size).toBe(20);

    // Starter animals from WORDS
    expect(LEVEL_1_WORD_IDS).toContain("cat");
    expect(LEVEL_1_WORD_IDS).toContain("dog");
    expect(LEVEL_1_WORD_IDS).toContain("fox");
    expect(LEVEL_1_WORD_IDS).toContain("frog");
    expect(LEVEL_1_WORD_IDS).toContain("lion");
    expect(LEVEL_1_WORD_IDS).toContain("panda");
    expect(LEVEL_1_WORD_IDS).toContain("rabbit");

    // Distinct rhyme words from RHYME_WORDS
    expect(LEVEL_1_WORD_IDS).toContain("bat");
    expect(LEVEL_1_WORD_IDS).toContain("bear");
    expect(LEVEL_1_WORD_IDS).toContain("bee");
    expect(LEVEL_1_WORD_IDS).toContain("boat");
    expect(LEVEL_1_WORD_IDS).toContain("box");
    expect(LEVEL_1_WORD_IDS).toContain("bun");
    expect(LEVEL_1_WORD_IDS).toContain("cake");
    expect(LEVEL_1_WORD_IDS).toContain("clock");
    expect(LEVEL_1_WORD_IDS).toContain("coat");
    expect(LEVEL_1_WORD_IDS).toContain("goat");
    expect(LEVEL_1_WORD_IDS).toContain("hat");
    expect(LEVEL_1_WORD_IDS).toContain("house");
    expect(LEVEL_1_WORD_IDS).toContain("jar");
  });

  it("exports LEVEL_1_WORDS populated from shared pool", () => {
    expect(LEVEL_1_WORDS).toHaveLength(LEVEL_1_WORD_IDS.length);
    for (const w of LEVEL_1_WORDS) {
      expect(w.icon).toBeTruthy();
      expect(w.en).toBeTruthy();
      expect(w.letter).toBeTruthy();
      expect(w.sound).toBeTruthy();
    }

    const cat = LEVEL_1_WORDS.find((w) => w.icon === "cat");
    expect(cat?.ja).toBeTruthy();
    expect(cat?.cmn).toBeTruthy();
    expect(cat?.yue).toBeTruthy();
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
    const avoid = "cat";
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const round = generateRound(rng, LEVEL_1_WORDS, avoid);
      expect(round.target.icon).not.toBe(avoid);
    }
  });

  it("throws an error if words pool has fewer than 2 items", () => {
    const rng = makeRng(1);
    expect(() => generateRound(rng, [LEVEL_1_WORDS[0]])).toThrow(
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
      const round = generateRound(rng, pool, "dog");
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

  it("accumulates streak across consecutive correct guesses", () => {
    const rng = makeRng(200);
    let state = initGameState(rng);

    for (let i = 1; i <= 5; i++) {
      state = updateGameState(state, state.currentRound.target.icon, rng);
      expect(state.streak).toBe(i);
      expect(state.wrongGuesses).toBe(0);
    }
  });

  it("resets streak and increments wrongGuesses on first incorrect guess without highlight", () => {
    const rng = makeRng(300);
    let state = initGameState(rng);
    state = updateGameState(state, state.currentRound.target.icon, rng);
    expect(state.streak).toBe(1);

    const distractorIcon = state.currentRound.distractor.icon;
    const roundBeforeWrong = state.currentRound;

    state = updateGameState(state, distractorIcon, rng);
    expect(state.streak).toBe(0);
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
});

describe("getWordText", () => {
  it("returns localized text when available for the given language", () => {
    const cat = LEVEL_1_WORDS.find((w) => w.icon === "cat");
    expect(cat).toBeDefined();
    if (!cat) return;

    expect(getWordText(cat, "en")).toBe("cat");
    expect(getWordText(cat, "ja")).toBe(cat.ja);
    expect(getWordText(cat, "cmn")).toBe(cat.cmn);
    expect(getWordText(cat, "yue")).toBe(cat.yue);
  });

  it("falls back to English when localization is not present", () => {
    const bat = LEVEL_1_WORDS.find((w) => w.icon === "bat");
    expect(bat).toBeDefined();
    if (!bat) return;

    expect(bat.ja).toBeUndefined();
    expect(getWordText(bat, "ja")).toBe("bat");
    expect(getWordText(bat, "cmn")).toBe("bat");
    expect(getWordText(bat, "yue")).toBe("bat");
  });
});

describe("speechLines", () => {
  it("returns all spoken lines for Level 1 words across supported languages", () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(LEVEL_1_WORDS.length);
    for (const w of LEVEL_1_WORDS) {
      expect(lines).toContain(w.en);
    }
    const cat = LEVEL_1_WORDS.find((w) => w.icon === "cat");
    expect(cat).toBeDefined();
    if (!cat) return;

    expect(lines).toContain(cat.ja);
    expect(lines).toContain(cat.cmn);
    expect(lines).toContain(cat.yue);
  });

  it("supports custom word pools", () => {
    const customWord: Word = {
      icon: "test",
      en: "testword",
      letter: "T",
      sound: "tuh",
    };
    const lines = speechLines([customWord]);
    expect(lines).toEqual(["testword"]);
  });
});
