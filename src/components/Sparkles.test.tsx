// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { Animated, StyleSheet, type TextStyle } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SparkleBurst, TwinkleField } from './Sparkles';

describe('SparkleBurst', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('centers sparkles with size-proportional margins for size 26', () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as { render: (props: { style?: unknown }, ref: unknown) => unknown },
      'render',
    );
    render(<SparkleBurst size={26} trigger={1} />);
    expect(spy).toHaveBeenCalled();
    const props = spy.mock.calls[0][0];
    const flat = StyleSheet.flatten<TextStyle>(props.style as TextStyle);
    expect(flat.marginLeft).toBe(-13);
    expect(flat.marginTop).toBe(-15.6);
  });

  it('centers sparkles with size-proportional margins for size 16', () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as { render: (props: { style?: unknown }, ref: unknown) => unknown },
      'render',
    );
    render(<SparkleBurst size={16} trigger={1} />);
    expect(spy).toHaveBeenCalled();
    const props = spy.mock.calls[0][0];
    const flat = StyleSheet.flatten<TextStyle>(props.style as TextStyle);
    expect(flat.marginLeft).toBe(-8);
    expect(flat.marginTop).toBe(-9.6);
  });

  it('hides decorative burst pieces from accessibility tree', () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as {
        render: (
          props: {
            accessibilityElementsHidden?: boolean;
            importantForAccessibility?: string;
            'aria-hidden'?: boolean;
          },
          ref: unknown,
        ) => unknown;
      },
      'render',
    );
    const { container } = render(<SparkleBurst count={4} trigger={1} />);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(call[0].accessibilityElementsHidden).toBe(true);
      expect(call[0].importantForAccessibility).toBe('no');
      expect(call[0]['aria-hidden']).toBe(true);
    }
    const nodes = container.querySelectorAll('[aria-hidden="true"]');
    expect(nodes.length).toBe(4);
  });
});

describe('TwinkleField', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides decorative twinkle pieces from accessibility tree', () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as {
        render: (
          props: {
            accessibilityElementsHidden?: boolean;
            importantForAccessibility?: string;
            'aria-hidden'?: boolean;
          },
          ref: unknown,
        ) => unknown;
      },
      'render',
    );
    const { container } = render(<TwinkleField count={3} />);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(call[0].accessibilityElementsHidden).toBe(true);
      expect(call[0].importantForAccessibility).toBe('no');
      expect(call[0]['aria-hidden']).toBe(true);
    }
    const nodes = container.querySelectorAll('[aria-hidden="true"]');
    expect(nodes.length).toBe(3);
  });
});
