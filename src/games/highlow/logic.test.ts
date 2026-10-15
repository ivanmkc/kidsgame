import { describe, expect, it } from "vitest";
import { makeRng } from "../../rng";
import { makeHighLowRound, getDotOffset } from "./logic";

describe("highlow logic", () => {
  it("getDotOffset returns negative for high, positive for low", () => {
    const rng = makeRng(42);
    for (let i = 0; i < 50; i++) {
      const r = makeHighLowRound(rng, "easy");
      if (r.answer === "high") {
        expect(getDotOffset(r)).toBeLessThan(0);
      } else {
        expect(getDotOffset(r)).toBeGreaterThan(0);
      }
    }
  });
});
