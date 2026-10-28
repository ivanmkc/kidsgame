import { describe, expect, it } from "vitest";
import { Lang } from "../../../lang";
import { manifest } from "../../../manifest";
import { makeRng } from "../../../rng";
import {
  makeRules,
  makeRulesRound,
  pickRuleIndex,
  rulesIntroLine,
  rulesLayout,
  rulesRecallLine,
  tileLabel,
} from "../logic";

describe("pickRuleIndex", () => {
  it("easy difficulty never recalls and advances rule indices consecutively", () => {
    const rng = makeRng(12345);
    const rules = makeRules(rng, 10);
    for (let idx = 0; idx < 10; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, Infinity, rules);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }
  });

  it("medium difficulty triggers recall only at round index 8 and advances consecutively", () => {
    const rng = makeRng(12345);
    const rules = makeRules(rng, 10);
    for (let idx = 0; idx < 8; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, 6, rules);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }
    const recallRound = pickRuleIndex(rng, 8, 6, rules);
    expect(recallRound.isRecall).toBe(true);
    expect(recallRound.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(recallRound.ruleIdx).toBeLessThanOrEqual(7);

    const nextRound = pickRuleIndex(rng, 9, 6, rules);
    expect(nextRound.isRecall).toBe(false);
    expect(nextRound.ruleIdx).toBe(8);

    // Newly introduced rules are sequentially numbered without skipping Rule #9
    const allRounds = Array.from({ length: 10 }, (_, i) =>
      pickRuleIndex(rng, i, 6, rules),
    );
    const introduced = allRounds
      .filter((r) => !r.isRecall)
      .map((r) => r.ruleIdx + 1);
    expect(introduced).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("hard difficulty triggers recall at rounds 5 and 8 and introduces rules consecutively", () => {
    const rng = makeRng(42);
    const rules = makeRules(rng, 10);
    for (let idx = 0; idx < 5; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, 3, rules);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }

    const round5 = pickRuleIndex(rng, 5, 3, rules);
    expect(round5.isRecall).toBe(true);
    expect(round5.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(round5.ruleIdx).toBeLessThanOrEqual(4);

    const round6 = pickRuleIndex(rng, 6, 3, rules);
    expect(round6.isRecall).toBe(false);
    expect(round6.ruleIdx).toBe(5);

    const round7 = pickRuleIndex(rng, 7, 3, rules);
    expect(round7.isRecall).toBe(false);
    expect(round7.ruleIdx).toBe(6);

    const round8 = pickRuleIndex(rng, 8, 3, rules);
    expect(round8.isRecall).toBe(true);
    expect(round8.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(round8.ruleIdx).toBeLessThanOrEqual(6);

    const round9 = pickRuleIndex(rng, 9, 3, rules);
    expect(round9.isRecall).toBe(false);
    expect(round9.ruleIdx).toBe(7);

    // Newly introduced rules are sequentially numbered 1 through 8 without skipping Rule #6 or #9
    const allRounds = Array.from({ length: 10 }, (_, i) =>
      pickRuleIndex(rng, i, 3, rules),
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
      const rules = makeRules(rng, 10);
      // Run through rounds 0..4 to advance rng state naturally
      for (let idx = 0; idx < 5; idx++) {
        pickRuleIndex(rng, idx, 3, rules);
      }
      const r5 = pickRuleIndex(rng, 5, 3, rules);
      expect(r5.isRecall).toBe(true);
      expect(r5.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r5.ruleIdx).toBeLessThanOrEqual(4);
      round5Recalled.add(r5.ruleIdx);

      pickRuleIndex(rng, 6, 3, rules);
      pickRuleIndex(rng, 7, 3, rules);

      const r8 = pickRuleIndex(rng, 8, 3, rules);
      expect(r8.isRecall).toBe(true);
      expect(r8.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r8.ruleIdx).toBeLessThanOrEqual(6);
      round8Recalled.add(r8.ruleIdx);

      if (r5.ruleIdx !== r8.ruleIdx) {
        differentRecallsInSameGame = true;
      }
    }

    // Rather than 100% ruleIndex === 2 (Rule #3), recall choices vary
    expect(round5Recalled.size).toBeGreaterThan(1);
    expect(round8Recalled.size).toBeGreaterThan(1);
    expect(round8Recalled.has(0) || round8Recalled.has(1)).toBe(true);
    expect(differentRecallsInSameGame).toBe(true);
  });

  it("medium mode recall round varies across seeds and tests earlier rules", () => {
    const recalled = new Set<number>();
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const rules = makeRules(rng, 10);
      for (let idx = 0; idx < 8; idx++) {
        pickRuleIndex(rng, idx, 6, rules);
      }
      const r8 = pickRuleIndex(rng, 8, 6, rules);
      expect(r8.isRecall).toBe(true);
      expect(r8.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r8.ruleIdx).toBeLessThanOrEqual(7);
      recalled.add(r8.ruleIdx);
    }
    expect(recalled.size).toBeGreaterThan(1);
    expect(recalled.has(0) || recalled.has(1)).toBe(true);
  });
});

describe("rule time logic", () => {
  it("hard difficulty does not repeat category on back-to-back rounds 6 and 7", () => {
    const recallFrom = 3;
    const tileCount = 9;
    const roundsToWin = 10;

    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const rules = makeRules(rng, roundsToWin);
      const rounds = [];

      for (let idx = 0; idx < roundsToWin; idx++) {
        const { ruleIdx, isRecall } = pickRuleIndex(
          rng,
          idx,
          recallFrom,
          rules,
        );
        const round = makeRulesRound(
          rng,
          manifest.spotit.icons,
          rules,
          ruleIdx,
          tileCount,
          isRecall,
        );
        rounds.push(round);
      }

      // Round 6 (idx 5, recall) and Round 7 (idx 6, non-recall)
      expect(rounds[5].isRecall).toBe(true);
      expect(rounds[6].isRecall).toBe(false);
      expect(rounds[5].rule.category).not.toBe(rounds[6].rule.category);
    }
  });

  it("no non-recall round following a recall round draws the same category", () => {
    const recallFrom = 3;
    const roundsToWin = 10;

    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const rules = makeRules(rng, roundsToWin);
      let prev = pickRuleIndex(rng, 0, recallFrom, rules);

      for (let idx = 1; idx < roundsToWin; idx++) {
        const curr = pickRuleIndex(rng, idx, recallFrom, rules);
        if (!curr.isRecall && prev.isRecall) {
          expect(rules[curr.ruleIdx].category).not.toBe(
            rules[prev.ruleIdx].category,
          );
        }
        prev = curr;
      }
    }
  });

  it("falls back gracefully when categories are heavily constrained", () => {
    const rng = makeRng(1);
    const rules = [
      { category: "c1", label: "L1" },
      { category: "c2", label: "L2" },
      { category: "c1", label: "L3" },
      { category: "c2", label: "L4" },
      { category: "c1", label: "L5" },
      { category: "c2", label: "L6" },
    ];
    const res = pickRuleIndex(rng, 5, 3, rules);
    expect(res.isRecall).toBe(true);
    expect(rules[res.ruleIdx].category).not.toBe(rules[5].category);

    const sameRules = Array.from({ length: 6 }, () => ({
      category: "c1",
      label: "L",
    }));
    const fallbackRes = pickRuleIndex(rng, 5, 3, sameRules);
    expect(fallbackRes.isRecall).toBe(true);
    expect(fallbackRes.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(fallbackRes.ruleIdx).toBeLessThanOrEqual(4);
  });
});

describe("tileLabel", () => {
  it("translates known icons across languages", () => {
    expect(tileLabel("blossom", "en")).toBe("flower");
    expect(tileLabel("blossom", "ja")).toBe("はな");
    expect(tileLabel("blossom", "cmn")).toBe("花");
    expect(tileLabel("blossom", "yue")).toBe("花");

    expect(tileLabel("soccer", "en")).toBe("ball");
    expect(tileLabel("soccer", "ja")).toBe("ボール");
    expect(tileLabel("soccer", "cmn")).toBe("足球");
    expect(tileLabel("soccer", "yue")).toBe("足球");

    expect(tileLabel("icecream", "en")).toBe("ice cream");
    expect(tileLabel("icecream", "ja")).toBe("アイスクリーム");
    expect(tileLabel("icecream", "cmn")).toBe("冰淇淋");
    expect(tileLabel("icecream", "yue")).toBe("雪糕");
  });

  it("defaults to en when lang is omitted", () => {
    expect(tileLabel("blossom")).toBe("flower");
    expect(tileLabel("soccer")).toBe("ball");
  });

  it("covers all spotit manifest icons in all supported languages", () => {
    const langs: Lang[] = ["en", "ja", "cmn", "yue"];
    for (const icon of manifest.spotit.icons) {
      for (const lang of langs) {
        const label = tileLabel(icon, lang);
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it("throws loudly on unknown icon", () => {
    expect(() => tileLabel("nonexistent_icon", "en")).toThrow(
      "Unknown rules icon: nonexistent_icon",
    );
  });
});

describe("rules spoken lines", () => {
  it("rulesIntroLine returns English intro for en", () => {
    expect(rulesIntroLine("en")).toBe(
      "Rule Time! Do what the rule says as fast as you can.",
    );
    expect(rulesIntroLine()).toBe(
      "Rule Time! Do what the rule says as fast as you can.",
    );
  });

  it("rulesIntroLine returns localized title and subtitle for non-English languages", () => {
    expect(rulesIntroLine("ja")).toBe("ルールタイム！ ルールどおりに はやく タップ！");
    expect(rulesIntroLine("cmn")).toBe("规则时间！ 按规则尽快点对的图");
    expect(rulesIntroLine("yue")).toBe("規則時間！ 跟住規則盡快撳啱嘅圖");
  });

  it("rulesRecallLine returns English prompt for en", () => {
    expect(rulesRecallLine(1, "en")).toBe(
      "Memory check! Do rule number 1 again. Do you remember it?",
    );
    expect(rulesRecallLine(5)).toBe(
      "Memory check! Do rule number 5 again. Do you remember it?",
    );
  });

  it("rulesRecallLine returns localized prompt for non-English languages", () => {
    expect(rulesRecallLine(1, "ja")).toBe(
      "きおくクイズ！ ルール #1 を もういちど — おぼえてる？ 🤔",
    );
    expect(rulesRecallLine(2, "cmn")).toBe(
      "记忆挑战！ 再做一次规则 #2 — 还记得吗？🤔",
    );
    expect(rulesRecallLine(3, "yue")).toBe(
      "記憶挑戰！ 再做一次規則 #3 — 仲記得嗎？🤔",
    );
  });
});

describe("rulesLayout", () => {
  it("portrait (phone): sets landscape false, gap 12, cols 3", () => {
    const l = rulesLayout(390, 844, 9);
    expect(l.isLandscape).toBe(false);
    expect(l.cols).toBe(3);
    expect(l.rows).toBe(3);
    expect(l.gap).toBe(12);
    expect(l.tile).toBeGreaterThan(44);
  });

  it("landscape (phone): sets landscape true, gap 10, touch targets >= 64px for 9 tiles", () => {
    const l = rulesLayout(844, 390, 9);
    expect(l.isLandscape).toBe(true);
    expect(l.cols).toBe(3);
    expect(l.rows).toBe(3);
    expect(l.gap).toBe(10);
    expect(l.tile).toBeGreaterThanOrEqual(64);
  });

  it("landscape (667x375): fits without vertical overflow on all difficulties", () => {
    const headerHeight = 84;
    const ruleCardHeight = 120;
    const hintAreaHeight = 26;

    // Test across Hard (9), Medium (8), and Easy (6)
    for (const count of [9, 8, 6]) {
      const l = rulesLayout(667, 375, count);
      expect(l.isLandscape).toBe(true);
      expect(l.tile).toBeGreaterThanOrEqual(64);

      const gridHeight = l.rows * l.tile + (l.rows - 1) * l.gap;
      const gridAreaHeight = gridHeight + hintAreaHeight;
      // In side-by-side layout, required height is header plus max of card and grid area
      const totalRequiredHeight =
        headerHeight + Math.max(ruleCardHeight, gridAreaHeight);

      expect(totalRequiredHeight).toBeLessThanOrEqual(375);
    }
  });

  it("landscape (568x320): preserves minimum 44px thumb target floor", () => {
    const l = rulesLayout(568, 320, 9);
    expect(l.isLandscape).toBe(true);
    expect(l.tile).toBeGreaterThanOrEqual(44);
  });
});

