import { describe, expect, it } from "vitest";
import { makeRng } from "../../../rng";
import { pickRuleIndex } from "../logic";

describe("pickRuleIndex", () => {
  it("easy difficulty never recalls and advances rule indices consecutively", () => {
    const rng = makeRng(12345);
    for (let idx = 0; idx < 10; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, Infinity);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }
  });

  it("medium difficulty triggers recall only at round index 8 and advances consecutively", () => {
    const rng = makeRng(12345);
    for (let idx = 0; idx < 8; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, 6);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }
    const recallRound = pickRuleIndex(rng, 8, 6);
    expect(recallRound.isRecall).toBe(true);
    expect(recallRound.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(recallRound.ruleIdx).toBeLessThanOrEqual(7);

    const nextRound = pickRuleIndex(rng, 9, 6);
    expect(nextRound.isRecall).toBe(false);
    expect(nextRound.ruleIdx).toBe(8);

    // Newly introduced rules are sequentially numbered without skipping Rule #9
    const allRounds = Array.from({ length: 10 }, (_, i) =>
      pickRuleIndex(rng, i, 6),
    );
    const introduced = allRounds
      .filter((r) => !r.isRecall)
      .map((r) => r.ruleIdx + 1);
    expect(introduced).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("hard difficulty triggers recall at rounds 5 and 8 and introduces rules consecutively", () => {
    const rng = makeRng(42);
    for (let idx = 0; idx < 5; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, 3);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }

    const round5 = pickRuleIndex(rng, 5, 3);
    expect(round5.isRecall).toBe(true);
    expect(round5.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(round5.ruleIdx).toBeLessThanOrEqual(4);

    const round6 = pickRuleIndex(rng, 6, 3);
    expect(round6.isRecall).toBe(false);
    expect(round6.ruleIdx).toBe(5);

    const round7 = pickRuleIndex(rng, 7, 3);
    expect(round7.isRecall).toBe(false);
    expect(round7.ruleIdx).toBe(6);

    const round8 = pickRuleIndex(rng, 8, 3);
    expect(round8.isRecall).toBe(true);
    expect(round8.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(round8.ruleIdx).toBeLessThanOrEqual(6);

    const round9 = pickRuleIndex(rng, 9, 3);
    expect(round9.isRecall).toBe(false);
    expect(round9.ruleIdx).toBe(7);

    // Newly introduced rules are sequentially numbered 1 through 8 without skipping Rule #6 or #9
    const allRounds = Array.from({ length: 10 }, (_, i) =>
      pickRuleIndex(rng, i, 3),
    );
    const introduced = allRounds
      .filter((r) => !r.isRecall)
      .map((r) => r.ruleIdx + 1);
    expect(introduced).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("hard mode recall rounds vary across seeds and are not locked to Rule #3", () => {
    const round5Recalled = new Set<number>();
    const round8Recalled = new Set<number>();
    let differentRecallsInSameGame = false;

    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      // Run through rounds 0..4 to advance rng state naturally
      for (let idx = 0; idx < 5; idx++) {
        pickRuleIndex(rng, idx, 3);
      }
      const r5 = pickRuleIndex(rng, 5, 3);
      expect(r5.isRecall).toBe(true);
      expect(r5.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r5.ruleIdx).toBeLessThanOrEqual(4);
      round5Recalled.add(r5.ruleIdx);

      pickRuleIndex(rng, 6, 3);
      pickRuleIndex(rng, 7, 3);

      const r8 = pickRuleIndex(rng, 8, 3);
      expect(r8.isRecall).toBe(true);
      expect(r8.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r8.ruleIdx).toBeLessThanOrEqual(6);
      round8Recalled.add(r8.ruleIdx);

      if (r5.ruleIdx !== r8.ruleIdx) {
        differentRecallsInSameGame = true;
      }
    }

    // Rather than 100% ruleIndex === 2 (Rule #3), earlier rules (0 and 1) are tested
    expect(round5Recalled.size).toBeGreaterThan(1);
    expect(round5Recalled.has(0)).toBe(true);
    expect(round5Recalled.has(1)).toBe(true);
    expect(round8Recalled.size).toBeGreaterThan(1);
    expect(differentRecallsInSameGame).toBe(true);
  });

  it("medium mode recall round varies across seeds and tests earlier rules", () => {
    const recalled = new Set<number>();
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      for (let idx = 0; idx < 8; idx++) {
        pickRuleIndex(rng, idx, 6);
      }
      const r8 = pickRuleIndex(rng, 8, 6);
      expect(r8.isRecall).toBe(true);
      expect(r8.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r8.ruleIdx).toBeLessThanOrEqual(7);
      recalled.add(r8.ruleIdx);
    }
    expect(recalled.size).toBeGreaterThan(1);
    expect(recalled.has(0) || recalled.has(1)).toBe(true);
  });
});
