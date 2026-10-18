import { describe, expect, it } from 'vitest';
import { LANGS, Lang } from '../../../lang';
import { SHADOW_PROMPTS, shadowPrompt } from '../logic';

describe('shadow prompt localization', () => {
  it('uses English baseline string in en mode', () => {
    expect(shadowPrompt('en')).toBe('Whose shadow is that? Match it!');
  });

  it('provides non-English spoken prompt across non-English modes', () => {
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      const prompt = shadowPrompt(lang);
      expect(prompt).not.toBe('Whose shadow is that? Match it!');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toBe(SHADOW_PROMPTS[lang]);
    }
  });

  it('covers all supported languages in SHADOW_PROMPTS', () => {
    for (const { id: lang } of LANGS) {
      expect(shadowPrompt(lang)).toBe(SHADOW_PROMPTS[lang]);
      expect(shadowPrompt(lang).length).toBeGreaterThan(0);
    }
  });

  it('defaults to en when no lang is provided', () => {
    expect(shadowPrompt()).toBe('Whose shadow is that? Match it!');
  });
});
