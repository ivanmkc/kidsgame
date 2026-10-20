import { describe, expect, it } from "vitest";
import { makeRng } from "../../../rng";
import { QuizTile, makeQuizRound, spriteLT } from "../logic";

describe("makeQuizRound", () => {
  interface Item {
    id: string;
    label: string;
    group?: string;
  }

  const pool: Item[] = [
    { id: "a", label: "Apple", group: "fruit" },
    { id: "b", label: "Banana", group: "fruit" },
    { id: "c", label: "Cherry", group: "fruit" },
    { id: "d", label: "Dog", group: "animal" },
    { id: "e", label: "Elephant", group: "animal" },
    { id: "f", label: "Fox", group: "animal" },
  ];

  const toTile = (item: Item): QuizTile => ({
    key: item.id,
    label: item.label,
  });

  const keyOf = (item: Item): string => item.id;

  it("throws an error if the pool is smaller than tileCount", () => {
    const rng = makeRng(42);
    expect(() =>
      makeQuizRound(rng, pool.slice(0, 2), 4, toTile, keyOf),
    ).toThrow("pool smaller than tileCount (2 < 4)");
  });

  it("generates a round with the requested number of unique tiles", () => {
    const rng = makeRng(42);
    const round = makeQuizRound(rng, pool, 4, toTile, keyOf);

    expect(round.tiles).toHaveLength(4);
    const keys = round.tiles.map((t) => t.key);
    expect(new Set(keys).size).toBe(4);
  });

  it("places target in tiles and points answerIdx to it", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const round = makeQuizRound(rng, pool, 3, toTile, keyOf);

      expect(round.answerIdx).toBeGreaterThanOrEqual(0);
      expect(round.answerIdx).toBeLessThan(round.tiles.length);
      expect(round.tiles[round.answerIdx].key).toBe(round.target.id);
      expect(round.tiles[round.answerIdx].label).toBe(round.target.label);
    }
  });

  it("respects avoidTargetKey by never picking the avoided key as target", () => {
    const avoid = "a";
    for (let seed = 1; seed <= 100; seed++) {
      const rng = makeRng(seed);
      const round = makeQuizRound(
        rng,
        pool,
        3,
        toTile,
        keyOf,
        undefined,
        avoid,
      );
      expect(round.target.id).not.toBe(avoid);
      expect(keyOf(round.target)).not.toBe(avoid);
    }
  });

  it("falls back to pool when avoidTargetKey removes all candidates", () => {
    const singlePool = [pool[0]];
    const rng = makeRng(42);
    const round = makeQuizRound(
      rng,
      singlePool,
      1,
      toTile,
      keyOf,
      undefined,
      singlePool[0].id,
    );
    expect(round.target.id).toBe(singlePool[0].id);
    expect(round.tiles).toHaveLength(1);
    expect(round.tiles[0].key).toBe(singlePool[0].id);
    expect(round.answerIdx).toBe(0);
  });

  it("biases distractors towards confusables when available", () => {
    const confusable = (target: Item, candidate: Item): boolean =>
      target.group !== undefined && target.group === candidate.group;

    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const round = makeQuizRound(rng, pool, 3, toTile, keyOf, confusable);
      const targetGroup = round.target.group;
      const distractorKeys = round.tiles
        .filter((_, idx) => idx !== round.answerIdx)
        .map((t) => t.key);

      for (const key of distractorKeys) {
        const item = pool.find((p) => p.id === key);
        expect(item?.group).toBe(targetGroup);
      }
    }
  });

  it("falls back to rest of pool when preferred confusables are fewer than needed", () => {
    const confusable = (_target: Item, candidate: Item): boolean =>
      candidate.id === "f";
    const rng = makeRng(123);
    const round = makeQuizRound(
      rng,
      pool.slice(0, 5),
      4,
      toTile,
      keyOf,
      confusable,
    );

    expect(round.tiles).toHaveLength(4);
    expect(new Set(round.tiles.map((t) => t.key)).size).toBe(4);
  });

  it("distributes answerIdx across positions uniformly over different seeds", () => {
    const counts = [0, 0, 0, 0];
    const totalRuns = 200;
    for (let seed = 1; seed <= totalRuns; seed++) {
      const rng = makeRng(seed);
      const round = makeQuizRound(rng, pool, 4, toTile, keyOf);
      counts[round.answerIdx]++;
    }

    for (const count of counts) {
      expect(count).toBeGreaterThan(20);
    }
  });

  it("deduplicates distractors by keyOf when pool items share keys", () => {
    interface WordItem {
      word: string;
      letter: string;
    }
    const sharedPool: WordItem[] = [
      { word: "apple", letter: "a" },
      { word: "ant", letter: "a" },
      { word: "axe", letter: "a" },
      { word: "bear", letter: "b" },
      { word: "bird", letter: "b" },
      { word: "bat", letter: "b" },
      { word: "cat", letter: "c" },
      { word: "cup", letter: "c" },
      { word: "car", letter: "c" },
      { word: "dog", letter: "d" },
      { word: "duck", letter: "d" },
      { word: "door", letter: "d" },
    ];
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const round = makeQuizRound(
        rng,
        sharedPool,
        3,
        (item) => ({ key: item.letter, label: item.word }),
        (item) => item.letter,
      );
      expect(round.tiles).toHaveLength(3);
      const keys = round.tiles.map((t) => t.key);
      expect(new Set(keys).size).toBe(3);
    }
  });

  it("deduplicates confusable distractors by keyOf when multiple confusables share keys", () => {
    interface WordItem {
      word: string;
      letter: string;
      confusableGroup?: string;
    }
    const sharedPool: WordItem[] = [
      { word: "bear", letter: "b", confusableGroup: "tall" },
      { word: "bird", letter: "b", confusableGroup: "tall" },
      { word: "dog", letter: "d", confusableGroup: "tall" },
      { word: "duck", letter: "d", confusableGroup: "tall" },
      { word: "pig", letter: "p", confusableGroup: "tall" },
      { word: "pen", letter: "p", confusableGroup: "tall" },
      { word: "cat", letter: "c", confusableGroup: "other" },
    ];
    const confusable = (target: WordItem, candidate: WordItem) =>
      target.confusableGroup !== undefined &&
      target.confusableGroup === candidate.confusableGroup;

    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const round = makeQuizRound(
        rng,
        sharedPool,
        3,
        (item) => ({ key: item.letter, label: item.word }),
        (item) => item.letter,
        confusable,
      );
      expect(round.tiles).toHaveLength(3);
      const keys = round.tiles.map((t) => t.key);
      expect(new Set(keys).size).toBe(3);
    }
  });
});

describe("spriteLT", () => {
  it("positions sprite center at given stage percentages when away from edges", () => {
    const pos = spriteLT(50, 50, 100, 1000, 800);
    expect(pos).toEqual({ left: 450, top: 350 });
  });

  it("clamps sprite inside stage boundaries near top and left edges", () => {
    const atOrigin = spriteLT(0, 0, 100, 1000, 800);
    expect(atOrigin).toEqual({ left: 0, top: 0 });

    const pastOrigin = spriteLT(-20, -50, 100, 1000, 800);
    expect(pastOrigin).toEqual({ left: 0, top: 0 });

    const nearLeft = spriteLT(2, 3, 100, 1000, 800);
    expect(nearLeft.left).toBe(0);
  });

  it("clamps sprite inside stage boundaries near bottom and right edges", () => {
    const atFarEdge = spriteLT(100, 100, 100, 1000, 800);
    expect(atFarEdge).toEqual({ left: 900, top: 700 });

    const pastFarEdge = spriteLT(120, 150, 100, 1000, 800);
    expect(pastFarEdge).toEqual({ left: 900, top: 700 });
  });

  it("handles small stages where size exceeds stage dimensions", () => {
    const pos = spriteLT(50, 50, 100, 60, 40);
    expect(pos).toEqual({ left: 0, top: 0 });
  });

  it("clamps sprite inside inset boundary when inset is provided", () => {
    const pos = spriteLT(100, 0, 40, 500, 300, 16);
    expect(pos).toEqual({ left: 500 - 16 - 40, top: 16 });

    const origin = spriteLT(0, 0, 40, 500, 300, 16);
    expect(origin).toEqual({ left: 16, top: 16 });

    const far = spriteLT(100, 100, 40, 500, 300, 16);
    expect(far).toEqual({ left: 500 - 16 - 40, top: 300 - 16 - 40 });
  });
});
