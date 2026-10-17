import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GestureResponderEvent, PressableProps } from 'react-native';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { WinOverlay } from '../../../components/WinOverlay';
import { CompareGame } from '../CompareGame';
import { MORE_PROMPT } from '../logic';

type FakePressableProps = Partial<Omit<PressableProps, 'onPress'>> & {
  onPress?: (event?: Partial<GestureResponderEvent>) => void;
};
type FakeWinOverlayProps = Partial<React.ComponentProps<typeof WinOverlay>>;

const capturedPressables: Record<string, FakePressableProps> = {};
let capturedWinOverlay: FakeWinOverlayProps | null = null;

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<FakePressableProps>;
  return {
    ...actual,
    Pressable: (props: Partial<React.ComponentProps<typeof ActualPressable>>) => {
      if (typeof props.testID === 'string') {
        capturedPressables[props.testID] = props;
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

vi.mock('../../../components/WinOverlay', () => ({
  WinOverlay: (props: FakeWinOverlayProps) => {
    capturedWinOverlay = props;
    return null;
  },
}));

describe('CompareGame wrong answer timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedWinOverlay = null;
    for (const key of Object.keys(capturedPressables)) {
      delete capturedPressables[key];
    }
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cancels the wrong-answer repeat prompt when correct plate is tapped', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'sayThen').mockImplementation(() => {});
    vi.spyOn(sfx, 'wrong').mockReturnValue();
    vi.spyOn(sfx, 'good').mockReturnValue();

    renderToString(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plateKeys = Object.keys(capturedPressables).filter((k) => k.startsWith('compare-plate-'));
    const wrongKey = plateKeys.find((k) => !k.endsWith('-correct'));
    const correctKey = plateKeys.find((k) => k.endsWith('-correct'));

    expect(wrongKey).toBeDefined();
    expect(correctKey).toBeDefined();

    const wrongPlate = capturedPressables[wrongKey ?? ''];
    const correctPlate = capturedPressables[correctKey ?? ''];

    // Tap wrong plate, scheduling repeat prompt at 500ms
    wrongPlate.onPress?.();

    // Tap correct plate 150ms later
    vi.advanceTimersByTime(150);
    correctPlate.onPress?.();

    // Advance past the initial 500ms timer
    vi.advanceTimersByTime(500);

    // Prompt must NOT be re-spoken because correct answer cancelled the timer
    expect(saySpy).not.toHaveBeenCalledWith(MORE_PROMPT.en);
  });

  it('speaks repeat prompt after 500ms when wrong plate is tapped and not answered', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sfx, 'wrong').mockReturnValue();

    renderToString(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plateKeys = Object.keys(capturedPressables).filter((k) => k.startsWith('compare-plate-'));
    const wrongKey = plateKeys.find((k) => !k.endsWith('-correct'));
    expect(wrongKey).toBeDefined();
    const wrongPlate = capturedPressables[wrongKey ?? ''];

    wrongPlate.onPress?.();

    // Before 500ms, not spoken
    vi.advanceTimersByTime(499);
    expect(saySpy).not.toHaveBeenCalledWith(MORE_PROMPT.en);

    // At 500ms, repeat prompt is spoken
    vi.advanceTimersByTime(1);
    expect(saySpy).toHaveBeenCalledWith(MORE_PROMPT.en);
  });

  it('resets the timer when wrong plate is tapped repeatedly', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sfx, 'wrong').mockReturnValue();

    renderToString(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plateKeys = Object.keys(capturedPressables).filter((k) => k.startsWith('compare-plate-'));
    const wrongKey = plateKeys.find((k) => !k.endsWith('-correct'));
    expect(wrongKey).toBeDefined();
    const wrongPlate = capturedPressables[wrongKey ?? ''];

    // First wrong tap at t=0
    wrongPlate.onPress?.();

    // Second wrong tap at t=300ms
    vi.advanceTimersByTime(300);
    wrongPlate.onPress?.();

    // At t=500ms (500ms after first tap, but only 200ms after second tap):
    vi.advanceTimersByTime(200);
    expect(saySpy).not.toHaveBeenCalledWith(MORE_PROMPT.en);

    // At t=800ms (500ms after second tap):
    vi.advanceTimersByTime(300);
    expect(saySpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledWith(MORE_PROMPT.en);
  });

  it('cancels the wrong-answer repeat prompt when reset is called', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sfx, 'wrong').mockReturnValue();

    renderToString(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plateKeys = Object.keys(capturedPressables).filter((k) => k.startsWith('compare-plate-'));
    const wrongKey = plateKeys.find((k) => !k.endsWith('-correct'));
    expect(wrongKey).toBeDefined();
    const wrongPlate = capturedPressables[wrongKey ?? ''];

    // Tap wrong plate
    wrongPlate.onPress?.();

    // Game is reset before 500ms
    vi.advanceTimersByTime(200);
    expect(capturedWinOverlay).not.toBeNull();
    capturedWinOverlay?.onNext?.();

    // Advance past the initial 500ms timer
    vi.advanceTimersByTime(500);

    expect(saySpy).not.toHaveBeenCalledWith(MORE_PROMPT.en);
  });
});
