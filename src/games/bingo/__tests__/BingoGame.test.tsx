import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      if (props.testID === 'bingo-prompt') {
        capturedPromptProps = props;
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
});
