import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as i18n from '../../../i18n';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { BingoGame } from '../BingoGame';

let mockWon = false;
let callCount = 0;

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useState: (init: unknown) => {
      callCount++;
      if (mockWon) {
        // In BingoGame, call 3 is marked cells and call 6 is winLine.
        if (callCount === 3) {
          return [[true, true, true, false, false, false, false, false, false], () => {}];
        }
        if (callCount === 6) {
          return [[0, 1, 2], () => {}];
        }
      }
      return actual.useState(init);
    },
  };
});

let capturedPromptProps: {
  disabled?: boolean;
  onPress?: () => void;
  [key: string]: unknown;
} | null = null;

const capturedPressableMap: Record<string, {
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  [key: string]: unknown;
}> = {};

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      if (props.testID === 'bingo-prompt') {
        capturedPromptProps = props;
      }
      if (typeof props.testID === 'string') {
        capturedPressableMap[props.testID] = props;
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

describe('BingoGame prompt', () => {
  beforeEach(() => {
    mockWon = false;
    callCount = 0;
    capturedPromptProps = null;
    for (const key of Object.keys(capturedPressableMap)) {
      delete capturedPressableMap[key];
    }
    vi.restoreAllMocks();
  });

  it('during active play, prompt is interactive and speaks the prompt on press', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const saySequenceSpy = vi.spyOn(sound, 'saySequence').mockImplementation(() => {});

    const html = renderToString(<BingoGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(html).not.toContain('data-testid="win-overlay"');
    expect(capturedPromptProps).not.toBeNull();
    expect(capturedPromptProps?.disabled).toBeFalsy();
    expect(html).not.toContain('aria-disabled="true"');

    capturedPromptProps?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(saySequenceSpy).toHaveBeenCalledOnce();
  });

  it('when won, prompt button is disabled and does not speak on press', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const saySequenceSpy = vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    mockWon = true;

    const html = renderToString(<BingoGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Verify the game entered the won state with the win overlay visible
    expect(html).toContain('data-testid="win-overlay"');

    // Prompt must be disabled when won
    expect(capturedPromptProps?.disabled).toBe(true);

    // Pressing prompt while won must not trigger tap sfx or saySequence
    capturedPromptProps?.onPress?.();
    expect(sfxTapSpy).not.toHaveBeenCalled();
    expect(saySequenceSpy).not.toHaveBeenCalled();
  });

  it('tiles have localized spoken word accessibility labels matching language', () => {
    renderToString(<BingoGame onHome={() => {}} difficulty="easy" lang="ja" />);

    const tile0 = capturedPressableMap['bingo-cell-0'];
    expect(tile0).toBeDefined();
    expect(tile0.accessibilityRole).toBe('button');
    expect(tile0.accessibilityLabel).toBeDefined();
    expect(tile0.accessibilityLabel).toMatch(/[\u3040-\u30ff\u4e00-\u9faf]/);
  });

  it('renders displayPrompt through i18n translation table for all languages', () => {
    const tSpy = vi.spyOn(i18n, 't');
    for (const lang of ['en', 'ja', 'cmn', 'yue'] as const) {
      tSpy.mockClear();
      renderToString(<BingoGame onHome={() => {}} difficulty="easy" lang={lang} />);
      expect(tSpy).toHaveBeenCalledWith(
        lang,
        'bingo.prompt',
        expect.objectContaining({ word: expect.any(String) }),
      );
    }
  });

  it('renders phonics displayPrompt through i18n translation table in phonics mode', () => {
    const tSpy = vi.spyOn(i18n, 't');
    renderToString(<BingoGame onHome={() => {}} difficulty="medium" lang="en" />);
    expect(tSpy).toHaveBeenCalledWith(
      'en',
      'bingo.promptPhonics',
      expect.objectContaining({ sound: expect.any(String) }),
    );
  });
});
