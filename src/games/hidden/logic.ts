import { t } from '../../i18n';
import { Lang } from '../../lang';

// Spoken prompt for the scene play screen across all four languages.
// English preserves the exact pre-rendered clip string; non-English modes
// provide localized instructions so speech fallback does not speak English.
export const HIDDEN_PLAY_PROMPTS: Record<Lang, string> = {
  en: 'Find all the hidden things!',
  ja: 'かくれている ものを ぜんぶ みつけよう！',
  cmn: '找出所有藏起来的东西！',
  yue: '搵出所有匿埋嘅嘢！',
};

/**
 * Return the spoken prompt for Hidden Objects: the localized scene
 * picker prompt when choosing a scene, or the play prompt inside a scene.
 */
export function hiddenPrompt(lang: Lang, inScene: boolean): string {
  return inScene ? HIDDEN_PLAY_PROMPTS[lang] : t(lang, 'picker.hidden');
}

/**
 * Return the localized turn narration for 2-player co-op play.
 */
export function turnPrompt(lang: Lang, name: string): string {
  switch (lang) {
    case 'ja':
      return `${name}の ばん！`;
    case 'cmn':
      return `轮到${name}了！`;
    case 'yue':
      return `輪到${name}喇！`;
    default:
      return `${name}'s turn!`;
  }
}
