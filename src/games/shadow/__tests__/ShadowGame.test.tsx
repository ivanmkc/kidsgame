// @vitest-environment happy-dom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ShadowGame } from '../ShadowGame';
import { SHADOW_PROMPTS } from '../logic';
import { LANGS, Lang } from '../../../lang';
import { t } from '../../../i18n';

describe('ShadowGame', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly across all languages', () => {
    for (const { id: lang } of LANGS) {
      const { container, unmount } = render(<ShadowGame onHome={noop} difficulty="easy" lang={lang} />);
      expect(container.innerHTML).toContain(t(lang, 'shell.shadow.title'));
      unmount();
    }
  });

  it('speaks localized prompt via speechSynthesis when launched in non-English modes', () => {
    const spokenUtterances: string[] = [];
    class MockUtterance {
      text: string;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const mockSpeechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((u: MockUtterance) => {
        spokenUtterances.push(u.text);
      }),
    };
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
    window.speechSynthesis = mockSpeechSynthesis as unknown as SpeechSynthesis;

    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      spokenUtterances.length = 0;
      const { unmount } = render(<ShadowGame onHome={noop} difficulty="easy" lang={lang} />);
      expect(spokenUtterances).toContain(SHADOW_PROMPTS[lang]);
      expect(spokenUtterances).not.toContain('Whose shadow is that? Match it!');
      unmount();
    }

    vi.unstubAllGlobals();
  });
});
