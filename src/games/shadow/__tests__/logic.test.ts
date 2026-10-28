import { describe, expect, it } from "vitest";
import { LANGS, Lang } from "../../../lang";
import { makeRng } from "../../../rng";
import { ICON_CATEGORIES } from "../../iconCategories";
import { SHADOW_PROMPTS, makeShadowRound, shadowPrompt } from "../logic";

describe("shadow prompt localization", () => {
  it("uses English baseline string in en mode", () => {
    expect(shadowPrompt("en")).toBe("Whose shadow is that? Match it!");
  });

  it("provides non-English spoken prompt across non-English modes", () => {
    const nonEnLangs: Lang[] = ["ja", "cmn", "yue"];
    for (const lang of nonEnLangs) {
      const prompt = shadowPrompt(lang);
      expect(prompt).not.toBe("Whose shadow is that? Match it!");
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toBe(SHADOW_PROMPTS[lang]);
    }
  });

  it("covers all supported languages in SHADOW_PROMPTS", () => {
    for (const { id: lang } of LANGS) {
      expect(shadowPrompt(lang)).toBe(SHADOW_PROMPTS[lang]);
      expect(shadowPrompt(lang).length).toBeGreaterThan(0);
    }
  });

  it("defaults to en when no lang is provided", () => {
    expect(shadowPrompt()).toBe("Whose shadow is that? Match it!");
  });
});

describe("makeShadowRound", () => {
  it("includes all available same-category distractors for small categories on hard tier", () => {
    const icons = [
      ...ICON_CATEGORIES.nature,
      "car",
      "plane",
      "rocket",
      "apple",
      "banana",
      "cat",
      "dog",
    ];
    const hardDiff = { choices: 5, categoryDistractors: true, transform: true };

    for (const answer of ICON_CATEGORIES.nature) {
      const answerIndex = icons.indexOf(answer);
      for (let seed = 1; seed <= 20; seed++) {
        const baseRng = makeRng(seed);
        let first = true;
        const rng = () => {
          if (first) {
            first = false;
            return answerIndex / icons.length;
          }
          return baseRng();
        };

        const round = makeShadowRound(rng, icons, hardDiff);
        expect(round.answer).toBe(answer);
        expect(round.options).toHaveLength(5);
        expect(new Set(round.options).size).toBe(5);

        const expectedNatureDistractors = ICON_CATEGORIES.nature.filter(
          (i) => i !== answer,
        );
        for (const distractor of expectedNatureDistractors) {
          expect(round.options).toContain(distractor);
        }
      }
    }
  });
});
