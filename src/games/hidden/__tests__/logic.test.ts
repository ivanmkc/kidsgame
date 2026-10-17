import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../../i18n';
import { LANGS, Lang } from '../../../lang';
import { manifest } from '../../../manifest';
import { HiddenGame } from '../HiddenGame';
import { HIDDEN_PLAY_PROMPTS, hiddenPrompt, turnPrompt } from '../logic';

describe('hidden prompt localization', () => {
  it('uses English baseline strings in en mode', () => {
    expect(hiddenPrompt('en', false)).toBe('Where do you want to search?');
    expect(hiddenPrompt('en', true)).toBe('Find all the hidden things!');
    expect(turnPrompt('en', 'Foxy')).toBe("Foxy's turn!");
    expect(turnPrompt('en', 'Bunny')).toBe("Bunny's turn!");
  });

  it('matches picker.hidden translation for picker across all languages', () => {
    for (const { id: lang } of LANGS) {
      expect(hiddenPrompt(lang, false)).toBe(t(lang, 'picker.hidden'));
    }
  });

  it('provides non-English spoken prompt for scene across non-English modes', () => {
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      const prompt = hiddenPrompt(lang, true);
      expect(prompt).not.toBe('Find all the hidden things!');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toBe(HIDDEN_PLAY_PROMPTS[lang]);
    }
  });

  it('provides non-English spoken prompt for picker across non-English modes', () => {
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      const prompt = hiddenPrompt(lang, false);
      expect(prompt).not.toBe('Where do you want to search?');
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it('provides localized turn narration across all languages', () => {
    expect(turnPrompt('en', 'Foxy')).toBe("Foxy's turn!");
    expect(turnPrompt('ja', 'Foxy')).toBe('Foxyの ばん！');
    expect(turnPrompt('cmn', 'Foxy')).toBe('轮到Foxy了！');
    expect(turnPrompt('yue', 'Foxy')).toBe('輪到Foxy喇！');

    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      const prompt = turnPrompt(lang, 'Foxy');
      expect(prompt).not.toBe("Foxy's turn!");
      expect(prompt).toContain('Foxy');
    }
  });
});

describe('HiddenGame component rendering', () => {
  const noop = () => {};

  it('renders picker in English and Japanese', () => {
    const enHtml = renderToString(
      React.createElement(HiddenGame, {
        onHome: noop,
        difficulty: 'medium',
        twoPlayerEnabled: false,
        onPickScene: noop,
        onBackToPicker: noop,
        lang: 'en',
      }),
    );
    expect(enHtml).toContain('Where do you want to search?');

    const jaHtml = renderToString(
      React.createElement(HiddenGame, {
        onHome: noop,
        difficulty: 'medium',
        twoPlayerEnabled: false,
        onPickScene: noop,
        onBackToPicker: noop,
        lang: 'ja',
      }),
    );
    expect(jaHtml).toContain('どこで さがす？');
  });

  it('renders scene play in English and Japanese', () => {
    const scene = manifest.hidden[0];
    const enHtml = renderToString(
      React.createElement(HiddenGame, {
        onHome: noop,
        difficulty: 'medium',
        filter: 'medium',
        twoPlayerEnabled: false,
        sceneId: scene.id,
        onPickScene: noop,
        onBackToPicker: noop,
        lang: 'en',
      }),
    );
    expect(enHtml).toContain('hidden-checklist');

    const jaHtml = renderToString(
      React.createElement(HiddenGame, {
        onHome: noop,
        difficulty: 'medium',
        filter: 'medium',
        twoPlayerEnabled: false,
        sceneId: scene.id,
        onPickScene: noop,
        onBackToPicker: noop,
        lang: 'ja',
      }),
    );
    expect(jaHtml).toContain('hidden-checklist');
  });
});
