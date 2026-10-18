import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pressable } from 'react-native';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import * as music from '../../../music';
import * as logic from '../logic';
import { ALL_PACKS, PACK_ORDER } from '../packs';
import { CarModeGame } from '../CarModeGame';

type PressableFake = Partial<
  Pick<
    React.ComponentProps<typeof Pressable>,
    'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'testID' | 'style'
  >
> & {
  onPress?: () => void;
};

const capturedPressables: Record<string, PressableFake> = {};

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      const testID = typeof props.testID === 'string' ? props.testID : undefined;
      if (testID) {
        capturedPressables[testID] = props as PressableFake;
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

describe('CarModeGame', () => {
  const noop = () => {};

  beforeEach(() => {
    for (const key of Object.keys(capturedPressables)) {
      delete capturedPressables[key];
    }
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial prompt phase with listen affordance and score chip', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const primeMusicSpy = vi.spyOn(music, 'primeMusic').mockReturnValue();

    const html = renderToString(<CarModeGame onHome={noop} lang="en" />);

    expect(html).toContain('Car Mode');
    expect(html).toContain(ALL_PACKS.boops.name);
    expect(html).toContain('1/10');
    expect(html).toContain('👂');
    expect(html).toContain('Listen...');

    const tapBtn = capturedPressables['carmode-tap'];
    expect(tapBtn).toBeDefined();
    expect(tapBtn.accessibilityRole).toBe('button');
    expect(tapBtn.accessibilityLabel).toBe('Tap to continue');

    // Tapping during prompt phase plays sound and primes music, but advances to the gap phase.
    tapBtn.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(primeMusicSpy).toHaveBeenCalledOnce();
  });

  it('navigates home when the back button is pressed', () => {
    const onHomeSpy = vi.fn();
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();

    renderToString(<CarModeGame onHome={onHomeSpy} lang="en" />);

    const backBtn = capturedPressables['back-button'];
    expect(backBtn).toBeDefined();
    backBtn.onPress?.();

    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(onHomeSpy).toHaveBeenCalledOnce();
  });

  it('renders localized shell titles in supported languages', () => {
    const htmlJa = renderToString(<CarModeGame onHome={noop} lang="ja" />);
    expect(htmlJa).toContain('くるまモード');

    const htmlCmn = renderToString(<CarModeGame onHome={noop} lang="cmn" />);
    expect(htmlCmn).toContain('车载模式');

    const htmlYue = renderToString(<CarModeGame onHome={noop} lang="yue" />);
    expect(htmlYue).toContain('車載模式');
  });

  it('renders gap phase and plays sounds when tapped', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const primeMusicSpy = vi.spyOn(music, 'primeMusic').mockReturnValue();
    const actual = logic.startState('boops', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({ ...actual, phase: 'gap' });

    const html = renderToString(<CarModeGame onHome={noop} lang="en" />);

    expect(html).toContain('🤔');
    expect(html).toContain('Your turn!');

    const tapBtn = capturedPressables['carmode-tap'];
    expect(tapBtn).toBeDefined();
    tapBtn.onPress?.();

    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(primeMusicSpy).toHaveBeenCalledOnce();
  });

  it('renders reveal phase and transitions to prompt on single tap for standard packs', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const primeMusicSpy = vi.spyOn(music, 'primeMusic').mockReturnValue();
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration').mockReturnValue();

    const actual = logic.startState('boops', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({
      ...actual,
      phase: 'reveal',
    });

    const html = renderToString(<CarModeGame onHome={noop} lang="en" />);

    expect(html).toContain('👆');
    expect(html).toContain('Tap!');

    const tapBtn = capturedPressables['carmode-tap'];
    expect(tapBtn).toBeDefined();
    tapBtn.onPress?.();

    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(primeMusicSpy).toHaveBeenCalledOnce();
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
  });

  it('handles twoTapAnswer rounds by advancing synchronously on second rapid tap', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration').mockReturnValue();
    const actual = logic.startState('silly', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({
      ...actual,
      phase: 'reveal',
      pendingTaps: 0,
    });

    renderToString(<CarModeGame onHome={noop} lang="en" />);

    const tapBtn = capturedPressables['carmode-tap'];
    expect(tapBtn).toBeDefined();

    tapBtn.onPress?.();
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    tapBtn.onPress?.();
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
  });

  it('handles single tap in a twoTapAnswer round by advancing after timeout', () => {
    vi.useFakeTimers();
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration').mockReturnValue();
    const actual = logic.startState('silly', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({
      ...actual,
      phase: 'reveal',
      pendingTaps: 0,
    });

    renderToString(<CarModeGame onHome={noop} lang="en" />);

    const tapBtn = capturedPressables['carmode-tap'];
    expect(tapBtn).toBeDefined();

    tapBtn.onPress?.(); // first tap
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600); // TAP_WINDOW_MS
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
  });

  it('renders completion screen with pack chooser and switches packs', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration').mockReturnValue();
    const actual = logic.startState('boops', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({ ...actual, phase: 'done' });

    const html = renderToString(<CarModeGame onHome={noop} lang="en" />);

    expect(html).toContain('All done!');
    expect(capturedPressables['carmode-tap']).toBeUndefined();

    // Verify all pack buttons are rendered with appropriate labels and styles
    for (const packId of PACK_ORDER) {
      const btn = capturedPressables[`carmode-pack-${packId}`];
      expect(btn).toBeDefined();
      expect(btn.accessibilityLabel).toBe(ALL_PACKS[packId].name);

      type StyleFn = (state: { pressed: boolean }) => Array<Record<string, unknown>>;
      if (typeof btn?.style === 'function') {
        const styleFn = btn.style as StyleFn;
        const unpressed = styleFn({ pressed: false });
        const pressed = styleFn({ pressed: true });
        expect(unpressed).toBeDefined();
        expect(pressed).toContainEqual({ opacity: 0.7 });
      }
    }

    // Selecting a new pack switches packs and stops narration
    const rhymeBtn = capturedPressables['carmode-pack-rhyme'];
    expect(rhymeBtn).toBeDefined();
    rhymeBtn.onPress?.();
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
  });

  it('ignores taps when already complete', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const primeMusicSpy = vi.spyOn(music, 'primeMusic').mockReturnValue();
    const advanceSpy = vi.spyOn(logic, 'advance');

    // Render with phase reveal to capture the tap button
    const actual = logic.startState('boops', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({
      ...actual,
      phase: 'reveal',
    });
    renderToString(<CarModeGame onHome={noop} lang="en" />);

    const tapBtn = capturedPressables['carmode-tap'];
    expect(tapBtn).toBeDefined();

    // Now mock isComplete to return true
    vi.spyOn(logic, 'isComplete').mockReturnValue(true);
    tapBtn.onPress?.();

    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(primeMusicSpy).toHaveBeenCalledOnce();
    expect(advanceSpy).not.toHaveBeenCalled();
  });

});
