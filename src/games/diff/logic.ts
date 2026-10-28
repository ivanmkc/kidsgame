import { t } from "../../i18n";
import { Lang } from "../../lang";
import { DiffScene } from "../../manifest";
import { sample } from "../../rng";

// Spoken prompt for the scene play screen across all four languages.
// English preserves the exact pre-rendered clip string; non-English modes
// provide localized instructions so speech fallback does not speak English.
export const DIFF_PLAY_PROMPTS: Record<Lang, string> = {
  en: "Find all the sneaky changes!",
  ja: "こっそり ちがうところを ぜんぶ みつけよう！",
  cmn: "找出所有藏起来的不同！",
  yue: "搵出所有匿埋嘅唔同！",
};

/**
 * Return the spoken prompt for Find the Difference: the localized scene
 * picker prompt when choosing a scene, or the play prompt inside a scene.
 */
export function diffPrompt(lang: Lang, inScene: boolean): string {
  return inScene ? DIFF_PLAY_PROMPTS[lang] : t(lang, "picker.diff");
}

export const MIN_DIFF_SCENE_W = 160;

/**
 * Fit both pictures in the viewport — side by side in landscape, stacked
 * in portrait. Clamps to at least MIN_DIFF_SCENE_W so short screens or
 * unmeasured viewports never produce negative dimensions or unplayable scenes.
 */
export function diffSceneWidth(
  width: number,
  height: number,
  diffHint = true,
  ar = 16 / 9,
): number {
  const isLandscape = width > height;
  const headerAllowance = 84;
  const labelAllowance = 26;
  const availH = height - headerAllowance - (diffHint ? 54 : 12);
  let sceneWidth: number;
  if (isLandscape) {
    sceneWidth = Math.min(
      (width - 44) / 2,
      Math.max(0, availH - labelAllowance) * ar,
      760,
    );
  } else {
    sceneWidth = Math.min(
      width - 24,
      (Math.max(0, availH - 2 * labelAllowance - 8) / 2) * ar,
      640,
    );
  }
  return Math.max(MIN_DIFF_SCENE_W, sceneWidth);
}

export function buildDiffRound(rng: () => number, scene: DiffScene | null, diffDraw: number) {
  const round =
    scene?.pool && scene.image
      ? sample(rng, scene.pool, diffDraw).map((p) => ({
          box: p,
          patch: p.patch as string | undefined,
          patchOnA: rng() < 0.5,
        }))
      : (scene?.diffs ?? []).map((d) => ({
          box: d,
          patch: undefined as string | undefined,
          patchOnA: false,
        }));
  return {
    total: round.length,
    boxes: round.map((r, i) => ({ id: String(i), box: r.box })),
    overlaysA: round
      .filter((r) => r.patch && r.patchOnA)
      .map((r) => ({ box: r.box, source: r.patch! })),
    overlaysB: round
      .filter((r) => r.patch && !r.patchOnA)
      .map((r) => ({ box: r.box, source: r.patch! })),
  };
}
