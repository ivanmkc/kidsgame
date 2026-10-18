// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { Animated, StyleSheet, type TextStyle } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SparkleBurst } from './Sparkles';

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
});
