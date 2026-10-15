import { describe, it, expect } from "vitest";
import { playablePool } from "../words";

describe("playablePool", () => {
  it("drops entries whose icon is not in the list", () => {
    // The master WORDS list includes 'dog' and many others.
    // We only pass a subset of icons.
    const pool = playablePool(["dog"]);
    expect(pool.length).toBe(1);
    expect(pool[0].icon).toBe("dog");

    // Passing icons not in WORDS list
    const emptyPool = playablePool(["not-an-icon"]);
    expect(emptyPool.length).toBe(0);
  });
});
