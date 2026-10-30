import { describe, expect, it } from "vitest";
import { makeOddOneRound } from "../logic";
import { CURRICULUM } from "../../../curriculum/content";

describe("makeOddOneRound", () => {
  it("does not pick an intruder that is also in the base category", () => {
    // Mock the categories to have an overlap
    const originalCategories = CURRICULUM.categories;
    CURRICULUM.categories = {
      fruit: ["apple", "banana"],
      food: ["apple", "pizza"],
    };

    try {
      let calls = 0;
      // We want the base to be 'fruit' (apple, banana) and the odd to be 'food' (apple, pizza).
      // If rng picks 'fruit' as base, baseMembers = ['apple', 'banana'].
      // The odd category will be 'food', oddMembers before filter = ['apple', 'pizza'].
      // The intruder must be 'pizza', not 'apple', because 'apple' is in the base category.
      const badRng = () => {
        const val = calls === 0 ? 0 : calls === 1 ? 0 : 0;
        calls++;
        return val;
      };

      const icons = ["apple", "banana", "pizza"];
      const round = makeOddOneRound(badRng, icons, 3);

      expect(round.baseCategory).toBe("fruit");
      expect(round.oddCategory).toBe("food");
      expect(round.odd).toBe("pizza"); // Should not be 'apple'
    } finally {
      CURRICULUM.categories = originalCategories;
    }
  });
});
