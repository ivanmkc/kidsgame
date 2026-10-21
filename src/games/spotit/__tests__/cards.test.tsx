import React from 'react';
import { Pressable } from 'react-native';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SymbolButton } from '../cards';

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
});
