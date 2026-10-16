import { describe, expect, it } from 'vitest';
import { t } from '../../../i18n';
import { LANGS, Lang } from '../../../lang';
import { DIFF_PLAY_PROMPTS, diffPrompt } from '../logic';

describe('diff prompt localization', () => {
  it('uses English baseline strings in en mode', () => {
    expect(diffPrompt('en', false)).toBe('Where do you want to play?');
    expect(diffPrompt('en', true)).toBe('Find all the sneaky changes!');
  });

  it('matches picker.diff translation for picker across all languages', () => {
    for (const { id: lang } of LANGS) {
      expect(diffPrompt(lang, false)).toBe(t(lang, 'picker.diff'));
    }
  });

  it('provides non-English spoken prompt for scene across non-English modes', () => {
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      const prompt = diffPrompt(lang, true);
      expect(prompt).not.toBe('Find all the sneaky changes!');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toBe(DIFF_PLAY_PROMPTS[lang]);
    }
  });

  it('provides non-English spoken prompt for picker across non-English modes', () => {
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      const prompt = diffPrompt(lang, false);
      expect(prompt).not.toBe('Where do you want to play?');
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});
