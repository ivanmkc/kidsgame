import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { CountGame } from '../CountGame';

const capturedPressables: Record<string, { onPress?: () => void }> = {};

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      const testID = typeof props.testID === 'string' ? props.testID : undefined;
      if (testID) {
        capturedPressables[testID] = props as { onPress?: () => void };
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

describe('CountGame', () => {
  const noop = () => {};

  beforeEach(() => {
    for (const key of Object.keys(capturedPressables)) {
      delete capturedPressables[key];
    }
    vi.restoreAllMocks();
  });

  it('ignores duplicate taps on the same critter and accumulates concurrent taps across different critters', () => {
    const sfxSpy = vi.spyOn(sound.sfx, 'tap').mockReturnValue();
    const saySpy = vi.spyOn(sound, 'say').mockReturnValue();

    renderToString(<CountGame onHome={noop} difficulty="medium" lang="en" />);

    const critter0 = capturedPressables['count-critter-0'];
    const critter1 = capturedPressables['count-critter-1'];
    expect(critter0).toBeDefined();
    expect(critter1).toBeDefined();

    // First tap on critter 0: registers "one"
    critter0.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenNthCalledWith(1, 'one');

    // Duplicate tap on critter 0 before re-rendering: ignored
    critter0.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledTimes(1);

    // Rapid concurrent tap on critter 1 before re-rendering: registers "two"
    critter1.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenNthCalledWith(2, 'two');
  });

  it('triggers quiz phase transition on the final concurrent tap', () => {
    vi.spyOn(sound.sfx, 'tap').mockReturnValue();
    vi.spyOn(sound, 'say').mockReturnValue();
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockReturnValue();

    renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    const critterKeys = Object.keys(capturedPressables).filter((k) => /^count-critter-\d+$/.test(k));
    expect(critterKeys.length).toBeGreaterThan(0);

    // Tap all critters rapidly without re-rendering
    for (const key of critterKeys) {
      capturedPressables[key].onPress?.();
    }

    // The final tap completes the count round and calls sayThen to switch to quiz
    expect(sayThenSpy).toHaveBeenCalledOnce();
  });
});
