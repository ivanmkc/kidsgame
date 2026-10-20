import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dimensions, Pressable } from 'react-native';
import { WinOverlay } from '../../../components/WinOverlay';
import { sfx } from '../../../sound';
import * as cardsModule from '../cards';
import * as spotitLogic from '../logic';
import { SpotItDuel } from '../SpotItDuel';

type WinOverlayFake = Partial<React.ComponentProps<typeof WinOverlay>>;
type PressableFake = Partial<
  Pick<React.ComponentProps<typeof Pressable>, 'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'testID'>
> & { onPress?: () => void };

const capturedPressableProps: Record<string, PressableFake> = {};

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      const testID = typeof props.testID === 'string' ? props.testID : undefined;
      if (testID) {
        capturedPressableProps[testID] = props as PressableFake;
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

let capturedWinOverlayProps: WinOverlayFake | null = null;

vi.mock('../../../components/WinOverlay', () => ({
  WinOverlay: (props: WinOverlayFake) => {
    capturedWinOverlayProps = props;
    return <div data-testid="mock-win-overlay">{props.stats}</div>;
  },
}));

describe('SpotItDuel', () => {
  const noop = () => {};

  beforeEach(() => {
    capturedWinOverlayProps = null;
    for (const key of Object.keys(capturedPressableProps)) {
      delete capturedPressableProps[key];
    }
    vi.restoreAllMocks();
  });

  it('renders ready countdown and player scores in portrait mode', () => {
    Dimensions.set({
      window: { width: 400, height: 800, scale: 1, fontScale: 1 },
    });
    const html = renderToString(<SpotItDuel onHome={noop} difficulty="easy" seed={42} lang="en" />);

    expect(html).toContain('Spot It! Duel');
    expect(html).toContain('Each of you: find YOUR match with the middle card!');
    expect(html).toContain('data-testid="spotit-duel-score"');
    expect(html).toContain('🦊 0 · 0 🐰');
    expect(html).toContain('data-testid="duel-countdown"');
    expect(html).toContain('3');
    expect(html).toContain('data-testid="duel-score-a"');
    expect(html).toContain('data-testid="duel-score-b"');
    expect(html).toContain('data-testid="mock-win-overlay"');
    expect(html).toContain('data-testid="duel-final-score-a"');
    expect(html).toContain('data-testid="duel-final-score-b"');
  });

  it('triggers onHome and sound when back button is pressed', () => {
    const onHomeSpy = vi.fn();
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();

    renderToString(<SpotItDuel onHome={onHomeSpy} difficulty="easy" seed={42} lang="en" />);

    const backBtn = capturedPressableProps['back-button'];
    expect(backBtn).toBeDefined();
    backBtn?.onPress?.();

    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(onHomeSpy).toHaveBeenCalledOnce();
  });

  it('disables symbol buttons during ready countdown and ignores taps', () => {
    const sfxGoodSpy = vi.spyOn(sfx, 'good').mockReturnValue();
    const sfxWrongSpy = vi.spyOn(sfx, 'wrong').mockReturnValue();

    renderToString(<SpotItDuel onHome={noop} difficulty="easy" seed={42} lang="en" />);

    const symbolPressableKeys = Object.keys(capturedPressableProps).filter((k) => k.startsWith('duel-'));
    expect(symbolPressableKeys.length).toBeGreaterThan(0);

    for (const key of symbolPressableKeys) {
      const btn = capturedPressableProps[key];
      expect(btn.disabled).toBe(true);
      expect(btn.accessibilityRole).toBe('button');
      expect(btn.accessibilityLabel).toBeDefined();
    }

    // Attempting to tap during ready countdown is ignored (no sound, no score)
    const firstSymbol = capturedPressableProps[symbolPressableKeys[0]];
    firstSymbol?.onPress?.();
    expect(sfxGoodSpy).not.toHaveBeenCalled();
    expect(sfxWrongSpy).not.toHaveBeenCalled();
  });

  it('handles rematch callback from WinOverlay and redeals a new round', () => {
    const dealSpy = vi.spyOn(spotitLogic, 'dealDuelRound');
    const layoutSpy = vi.spyOn(cardsModule, 'layoutSlots');

    Dimensions.set({
      window: { width: 400, height: 800, scale: 1, fontScale: 1 },
    });
    renderToString(<SpotItDuel onHome={noop} difficulty="easy" seed={42} lang="en" />);

    expect(dealSpy).toHaveBeenCalledTimes(1);
    expect(layoutSpy).toHaveBeenCalledTimes(4);
    expect(capturedWinOverlayProps).not.toBeNull();
    expect(capturedWinOverlayProps?.visible).toBe(false);
    expect(capturedWinOverlayProps?.nextLabel).toBe('Rematch ⚔️');
    expect(capturedWinOverlayProps?.onNext).toBeDefined();

    capturedWinOverlayProps?.onNext?.();

    // Verify side effects of rematch: a new round is dealt and slots re-laid out
    expect(dealSpy).toHaveBeenCalledTimes(2);
    expect(layoutSpy).toHaveBeenCalledTimes(8);
  });

  it('handles onHome callback from WinOverlay', () => {
    const onHomeSpy = vi.fn();
    renderToString(<SpotItDuel onHome={onHomeSpy} difficulty="easy" seed={42} lang="en" />);

    expect(capturedWinOverlayProps).not.toBeNull();
    capturedWinOverlayProps?.onHome?.();
    expect(onHomeSpy).toHaveBeenCalledOnce();
  });

  it('renders in landscape mode with side-by-side zones', () => {
    Dimensions.set({
      window: { width: 800, height: 400, scale: 1, fontScale: 1 },
    });
    const html = renderToString(<SpotItDuel onHome={noop} difficulty="medium" seed={100} lang="en" />);

    expect(html).toContain('Spot It! Duel');
    expect(html).toContain('data-testid="duel-score-a"');
    expect(html).toContain('data-testid="duel-score-b"');
  });

  it('renders without an explicit seed', () => {
    const html = renderToString(<SpotItDuel onHome={noop} difficulty="hard" />);
    expect(html).toContain('Spot It! Duel');
  });

  it('renders localized titles and subtitles in other languages', () => {
    Dimensions.set({
      window: { width: 400, height: 800, scale: 1, fontScale: 1 },
    });
    const htmlJa = renderToString(<SpotItDuel onHome={noop} difficulty="hard" seed={7} lang="ja" />);
    expect(htmlJa).toContain('いっしょさがし たいけつ');
    expect(htmlJa).toContain('まんなかのカードと じぶんのカードで あわせよう！');

    const htmlCmn = renderToString(<SpotItDuel onHome={noop} difficulty="easy" seed={8} lang="cmn" />);
    expect(htmlCmn).toContain('找共同 对战');
    expect(htmlCmn).toContain('各自找出自己的牌和中间牌相同的图！');

    const htmlYue = renderToString(<SpotItDuel onHome={noop} difficulty="medium" seed={9} lang="yue" />);
    expect(htmlYue).toContain('搵共通 對戰');
    expect(htmlYue).toContain('各自搵你嗰張牌同中間牌一樣嗰個圖！');
  });

  it('provides localized duel countdown prompts for all languages', () => {
    expect(spotitLogic.duelCountdownPrompt('en')).toBe('Ready... Spot!');
    expect(spotitLogic.duelCountdownPrompt('ja')).toBe('ようい... いっしょさがし！');
    expect(spotitLogic.duelCountdownPrompt('cmn')).toBe('准备... 找共同！');
    expect(spotitLogic.duelCountdownPrompt('yue')).toBe('準備... 搵共通！');
  });

  it('formats localized match recaps for all languages', () => {
    expect(spotitLogic.duelRecapLine('en', 'Foxy', 'Bunny', 1)).toBe(
      'Foxy wins! Bunny spotted 1 star. Great eyes, both of you!'
    );
    expect(spotitLogic.duelRecapLine('en', 'Foxy', 'Bunny', 2)).toBe(
      'Foxy wins! Bunny spotted 2 stars. Great eyes, both of you!'
    );
    expect(spotitLogic.duelRecapLine('ja', 'Foxy', 'Bunny', 2)).toBe(
      'Foxyのかち！ Bunnyは ほし2こ。ふたりとも よくみたね！'
    );
    expect(spotitLogic.duelRecapLine('cmn', 'Foxy', 'Bunny', 2)).toBe(
      'Foxy赢啦！Bunny找到 2 颗星。你们眼力都真棒！'
    );
    expect(spotitLogic.duelRecapLine('yue', 'Foxy', 'Bunny', 2)).toBe(
      'Foxy贏咗！Bunny搵到 2 粒星。兩個眼力都好勁！'
    );
  });
});
