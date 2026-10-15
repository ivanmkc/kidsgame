import { describe, expect, it } from "vitest";
import { makeQuizRound, spriteLT } from "../logic";
import { makeRng } from "../../../rng";

describe("spriteLT", () => {
  it("center stays put away from edges", () => {
    // cx = 50, cy = 50, half = 10 -> left = 40, top = 40
    expect(spriteLT(50, 50, 20, 100, 100)).toEqual({ left: 40, top: 40 });
  });

  it("at 0%/100% the sprite is pulled in by size/2 on each axis", () => {
    // 0, 0, size=20, stage=100x100 -> cx=10, cy=10 -> left=0, top=0
    expect(spriteLT(0, 0, 20, 100, 100)).toEqual({ left: 0, top: 0 });
    // 100, 100, size=20, stage=100x100 -> cx=90, cy=90 -> left=80, top=80
    expect(spriteLT(100, 100, 20, 100, 100)).toEqual({ left: 80, top: 80 });
  });

  it("when size > stage the result is left=top=0 side (half clamp)", () => {
    // 50, 50, size=200, stage=100x100 -> half=100
    // cx = min(max(50, 100), max(100, 0)) -> min(100, 100) = 100
    // left = cx - half = 0
    expect(spriteLT(50, 50, 200, 100, 100)).toEqual({ left: 0, top: 0 });
  });
});

describe("makeQuizRound", () => {
  const pool = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const toTile = (x: string) => ({ key: x, label: x });
  const keyOf = (x: string) => x;

  it("tiles.length === tileCount when the pool is large enough", () => {
    const rng = makeRng(1);
    const round = makeQuizRound(rng, pool, 3, toTile, keyOf);
    expect(round.tiles.length).toBe(3);
  });

  it("tiles have unique keys", () => {
    const rng = makeRng(1);
    const round = makeQuizRound(rng, pool, 4, toTile, keyOf);
    const keys = round.tiles.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("tiles[answerIdx].key === keyOf(target)", () => {
    const rng = makeRng(1);
    const round = makeQuizRound(rng, pool, 4, toTile, keyOf);
    expect(round.tiles[round.answerIdx].key).toBe(keyOf(round.target));
  });

  it("avoidTargetKey is never the target", () => {
    const rng = makeRng(1);
    for (let i = 0; i < 20; i++) {
      const round = makeQuizRound(rng, pool, 3, toTile, keyOf, undefined, "A");
      expect(round.target).not.toBe("A");
    }
  });

  it("confusable distractors come before random ones", () => {
    let i = 0;
    const mockRng = () => (i++ % 100) / 100;
    const conf = (target: string, x: string) => target === "A" && x === "C";
    const r = makeQuizRound(mockRng, pool, 2, toTile, keyOf, conf);
    expect(r.target).toBe("A");
    expect(r.tiles.find((t) => t.key !== "A")?.key).toBe("C");
  });

  it("same seed gives the same round", () => {
    const r1 = makeQuizRound(makeRng(42), pool, 4, toTile, keyOf);
    const r2 = makeQuizRound(makeRng(42), pool, 4, toTile, keyOf);
    expect(r1).toEqual(r2);
  });
});
