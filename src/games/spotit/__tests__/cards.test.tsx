import React from 'react';
import { Pressable } from 'react-native';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpotCard, SymbolButton, layoutSlots } from '../cards';
import { symbolLabel } from '../logic';
import { makeRng } from '../../../rng';

type PressableFake = Partial<React.ComponentProps<typeof Pressable>>;
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

describe('symbolLabel', () => {
  it('localizes icon names to the requested language', () => {
    expect(symbolLabel('dog', 'en')).toBe('dog');
    expect(symbolLabel('dog', 'ja')).toBe('いぬ');
    expect(symbolLabel('dog', 'cmn')).toBe('狗');
    expect(symbolLabel('dog', 'yue')).toBe('狗');
    expect(symbolLabel('blossom', 'en')).toBe('flower');
    expect(symbolLabel('blossom', 'ja')).toBe('はな');
  });

  it('throws loudly when an icon is not in WORDS', () => {
    expect(() => symbolLabel('nonexistent_icon', 'en')).toThrow('Unknown spotit icon: nonexistent_icon');
  });
});

describe('SymbolButton', () => {
  beforeEach(() => {
    for (const key of Object.keys(capturedPressableProps)) {
      delete capturedPressableProps[key];
    }
    vi.restoreAllMocks();
  });

  it('expands touch targets < 44px to 44px using hitSlop', () => {
    renderToString(
      <SymbolButton
        iconName="cat"
        wrong={false}
        onTap={() => {}}
        testID="small-button"
        left={0}
        top={0}
        size={24}
        rot={0}
      />,
    );
    expect(capturedPressableProps['small-button'].hitSlop).toBe(10);
  });

  it('does not add unnecessary hitSlop for large symbols', () => {
    renderToString(
      <SymbolButton
        iconName="dog"
        wrong={false}
        onTap={() => {}}
        testID="large-button"
        left={0}
        top={0}
        size={64}
        rot={0}
      />,
    );
    expect(capturedPressableProps['large-button'].hitSlop).toBe(0);
  });

  it('localizes accessibilityLabel according to lang', () => {
    renderToString(
      <SymbolButton
        iconName="dog"
        wrong={false}
        onTap={() => {}}
        testID="dog-ja"
        left={0}
        top={0}
        size={44}
        rot={0}
        lang="ja"
      />,
    );
    expect(capturedPressableProps['dog-ja'].accessibilityLabel).toBe('いぬ');

    renderToString(
      <SymbolButton
        iconName="dog"
        wrong={false}
        onTap={() => {}}
        testID="dog-cmn"
        left={0}
        top={0}
        size={44}
        rot={0}
        lang="cmn"
      />,
    );
    expect(capturedPressableProps['dog-cmn'].accessibilityLabel).toBe('狗');

    renderToString(
      <SymbolButton
        iconName="dog"
        wrong={false}
        onTap={() => {}}
        testID="dog-en"
        left={0}
        top={0}
        size={44}
        rot={0}
      />,
    );
    expect(capturedPressableProps['dog-en'].accessibilityLabel).toBe('dog');
  });
});

describe('SpotCard', () => {
  beforeEach(() => {
    for (const key of Object.keys(capturedPressableProps)) {
      delete capturedPressableProps[key];
    }
  });

  it('passes lang to child SymbolButtons to localize labels', () => {
    renderToString(
      <SpotCard
        card={[0, 1]}
        slots={[
          { cx: 0.5, cy: 0.5, size: 0.2, rot: 0 },
          { cx: 0.2, cy: 0.2, size: 0.2, rot: 0 },
        ]}
        size={100}
        onTap={() => {}}
        wrongFlash={null}
        tint="#000"
        testIDPrefix="card"
        lang="ja"
      />,
    );
    expect(capturedPressableProps['card-symbol-0'].accessibilityLabel).toBe('いぬ');
    expect(capturedPressableProps['card-symbol-1'].accessibilityLabel).toBe('ねこ');
  });
});

describe('layoutSlots', () => {
  it('defaults to 6 slots (1 center + 5 in outer ring)', () => {
    const rng = makeRng(42);
    const slots = layoutSlots(rng);
    expect(slots).toHaveLength(6);
    expect(slots[0].cx).toBe(0.5);
    expect(slots[0].cy).toBe(0.5);
  });

  it('distributes slots correctly for easy (3 symbols) and medium (4 symbols)', () => {
    const rng = makeRng(100);
    const slots3 = layoutSlots(rng, 3);
    expect(slots3).toHaveLength(3);
    expect(slots3[0].cx).toBe(0.5);
    expect(slots3[0].cy).toBe(0.5);

    const slots4 = layoutSlots(rng, 4);
    expect(slots4).toHaveLength(4);
    expect(slots4[0].cx).toBe(0.5);
    expect(slots4[0].cy).toBe(0.5);
  });

  it('distributes outer count - 1 slots evenly along the ring', () => {
    // With fixed deterministic RNG, outer slots form an equilateral ring
    const rng = makeRng(77);
    const slots3 = layoutSlots(rng, 3);
    const p1 = { x: slots3[1].cx - 0.5, y: slots3[1].cy - 0.5 };
    const p2 = { x: slots3[2].cx - 0.5, y: slots3[2].cy - 0.5 };
    // For 2 outer slots, angle difference is PI radians (opposite sides), so dot product is negative
    const dot = p1.x * p2.x + p1.y * p2.y;
    expect(dot).toBeLessThan(0);
  });

  it('returns empty array when count is <= 0', () => {
    const rng = makeRng(1);
    expect(layoutSlots(rng, 0)).toEqual([]);
  });
});

