import { describe, expect, it } from "vitest";
import { t } from "../../../i18n";
import { LANGS, Lang } from "../../../lang";
import {
  DIFF_PLAY_PROMPTS,
  MIN_DIFF_SCENE_W,
  diffPrompt,
  diffSceneWidth,
} from "../logic";

describe("diff prompt localization", () => {
  it("uses English baseline strings in en mode", () => {
    expect(diffPrompt("en", false)).toBe("Where do you want to play?");
    expect(diffPrompt("en", true)).toBe("Find all the sneaky changes!");
  });

  it("matches picker.diff translation for picker across all languages", () => {
    for (const { id: lang } of LANGS) {
      expect(diffPrompt(lang, false)).toBe(t(lang, "picker.diff"));
    }
  });

  it("provides non-English spoken prompt for scene across non-English modes", () => {
    const nonEnLangs: Lang[] = ["ja", "cmn", "yue"];
    for (const lang of nonEnLangs) {
      const prompt = diffPrompt(lang, true);
      expect(prompt).not.toBe("Find all the sneaky changes!");
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toBe(DIFF_PLAY_PROMPTS[lang]);
    }
  });

  it("provides non-English spoken prompt for picker across non-English modes", () => {
    const nonEnLangs: Lang[] = ["ja", "cmn", "yue"];
    for (const lang of nonEnLangs) {
      const prompt = diffPrompt(lang, false);
      expect(prompt).not.toBe("Where do you want to play?");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("diffSceneWidth", () => {
  it("computes width correctly on standard landscape viewport", () => {
    // 1000x600 landscape with diffHint:
    // (1000 - 44) / 2 = 478
    // availH = 600 - 84 - 54 = 462; availH - 26 = 436; 436 * 16 / 9 = ~775.1
    // min(478, 775.1, 760) = 478
    expect(diffSceneWidth(1000, 600, true)).toBe(478);
  });

  it("computes width correctly on standard portrait viewport", () => {
    // 390x844 portrait with diffHint:
    // width - 24 = 366
    // availH = 844 - 84 - 54 = 706; availH - 60 = 646; (646 / 2) * 16 / 9 = ~574.2
    // min(366, 574.2, 640) = 366
    expect(diffSceneWidth(390, 844, true)).toBe(366);
  });

  it("clamps to MIN_DIFF_SCENE_W on short landscape viewport (800x140)", () => {
    // 800x140 landscape:
    // availH = 140 - 84 - 54 = 2; availH - 26 = -24
    // Without minimum clamp, sceneWidth would evaluate to negative (-42.67px).
    const width = diffSceneWidth(800, 140, true);
    expect(width).toBe(MIN_DIFF_SCENE_W);
    expect(width).toBe(160);
  });

  it("clamps to MIN_DIFF_SCENE_W on extreme short viewport (800x65)", () => {
    // 800x65 landscape:
    // availH = 65 - 84 - 54 = -73; availH - 26 = -99; -99 * (16/9) = -176px
    // Without clamp, sceneWidth yields -176px.
    const width = diffSceneWidth(800, 65, true);
    expect(width).toBe(MIN_DIFF_SCENE_W);
    expect(width).toBe(160);
  });

  it("clamps to MIN_DIFF_SCENE_W on short portrait viewport (390x140)", () => {
    // 390x140 portrait:
    // availH = 140 - 84 - 54 = 2; availH - 60 = -58
    // Without clamp, portrait height scaling evaluates to negative.
    const width = diffSceneWidth(390, 140, true);
    expect(width).toBe(MIN_DIFF_SCENE_W);
    expect(width).toBe(160);
  });

  it("clamps to MIN_DIFF_SCENE_W on unmeasured 0x0 viewport during initial layout", () => {
    expect(diffSceneWidth(0, 0, true)).toBe(MIN_DIFF_SCENE_W);
    expect(diffSceneWidth(0, 0, false)).toBe(MIN_DIFF_SCENE_W);
  });

  it("accounts for diffHint header allowance when diffHint is disabled", () => {
    // With diffHint = false, allowance is 12 instead of 54.
    // 800x200 landscape:
    // With diffHint false: availH = 200 - 84 - 12 = 104; availH - 26 = 78; 78 * 16 / 9 = 138.67
    // Clamped to 160.
    // With diffHint true: availH = 200 - 84 - 54 = 62; availH - 26 = 36; 36 * 16 / 9 = 64
    // Also clamped to 160.
    // At height 250:
    // With false: availH = 250 - 84 - 12 = 154; availH - 26 = 128; 128 * 16 / 9 = ~227.5
    // With true: availH = 250 - 84 - 54 = 112; availH - 26 = 86; 86 * 16 / 9 = ~152.8 (clamped to 160)
    expect(diffSceneWidth(800, 250, false)).toBeCloseTo(227.5, 0);
    expect(diffSceneWidth(800, 250, true)).toBe(160);
  });
});
