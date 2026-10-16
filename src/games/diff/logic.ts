import { t } from '../../i18n';
import { Lang } from '../../lang';

// Spoken prompt for the scene play screen across all four languages.
// English preserves the exact pre-rendered clip string; non-English modes
// provide localized instructions so speech fallback does not speak English.
export const DIFF_PLAY_PROMPTS: Record<Lang, string> = {
  en: 'Find all the sneaky changes!',
  ja: 'こっそり ちがうところを ぜんぶ みつけよう！',
  cmn: '找出所有藏起来的不同！',
  yue: '搵出所有匿埋嘅唔同！',
};

/**
 * Return the spoken prompt for Find the Difference: the localized scene
 * picker prompt when choosing a scene, or the play prompt inside a scene.
 */
export function diffPrompt(lang: Lang, inScene: boolean): string {
  return inScene ? DIFF_PLAY_PROMPTS[lang] : t(lang, 'picker.diff');
}
