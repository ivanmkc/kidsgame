// @vitest-environment happy-dom
import React, { act } from 'react';
import { render, cleanup } from '@testing-library/react';
import { Animated } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENES } from '../scenes';
import { ScrollingWorld } from '../ScrollingWorld';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../assets/images', () => {
  const p = new Proxy({}, { get: () => ({ uri: 'stub.png' }) });
  return {
    MUSICBOX_IMAGES: p,
  };
});

function getTranslateX(el: HTMLElement): number {
  const match = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(el.style.transform);
  if (!match) {
    throw new Error(`Expected translateX in transform: "${el.style.transform}"`);
  }
  return parseFloat(match[1]);
}

describe('ScrollingWorld parallax wrapping', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders all three parallax layers with two tiled strips each', () => {
    const scrollX = new Animated.Value(0);
    const { container, unmount } = render(<ScrollingWorld scrollX={scrollX} scene={SCENES[0]} />);

    const root = container.firstElementChild as HTMLElement;
    const layers = Array.from(root.children) as HTMLElement[];
    expect(layers).toHaveLength(3);

    // Each layer should have two images side by side for seamless tiling
    for (const layer of layers) {
      expect(layer.style.width).toBe('2560px');
      expect(layer.querySelectorAll('img')).toHaveLength(2);
    }

    unmount();
  });

  it('wraps layer translations modulo strip width so layers never scroll into empty void', () => {
    const scrollX = new Animated.Value(0);
    const { container, unmount } = render(<ScrollingWorld scrollX={scrollX} scene={SCENES[0]} />);

    const root = container.firstElementChild as HTMLElement;
    const [bgLayer, midLayer, fgLayer] = Array.from(root.children) as HTMLElement[];

    // At start: all three layers start at 0px translation
    expect(Math.abs(getTranslateX(bgLayer))).toBe(0);
    expect(Math.abs(getTranslateX(midLayer))).toBe(0);
    expect(Math.abs(getTranslateX(fgLayer))).toBe(0);

    // After 60 taps (60 * 48px = 2880px scrollX):
    // Without modulo, fg was -2880px, right edge was -2880 + 2560 = -320px (< 0, off-screen void).
    // With modulo, fg wraps at 1280px: 2880 % 1280 = 320px -> fg = -320px.
    act(() => {
      scrollX.setValue(2880);
    });
    expect(getTranslateX(fgLayer)).toBe(-320);
    // Right edge of the 2560px wide strip is well past the 1280px viewport
    const fgRightEdge = getTranslateX(fgLayer) + 2560;
    expect(fgRightEdge).toBe(2240);
    expect(fgRightEdge).toBeGreaterThan(1280);

    // After 120 taps (120 * 48px = 5760px scrollX):
    // Midground (rate 0.5) has scaled scroll 5760 * 0.5 = 2880px.
    // Without modulo, mid was -2880px, off-screen void.
    // With modulo, mid wraps at 1280px: 2880 % 1280 = 320px -> mid = -320px.
    act(() => {
      scrollX.setValue(5760);
    });
    expect(getTranslateX(midLayer)).toBe(-320);
    const midRightEdge = getTranslateX(midLayer) + 2560;
    expect(midRightEdge).toBe(2240);
    expect(midRightEdge).toBeGreaterThan(1280);

    // After 300 taps (300 * 48px = 14400px scrollX):
    // Background (rate 0.2) has scaled scroll 14400 * 0.2 = 2880px.
    // Without modulo, bg was -2880px, off-screen void.
    // With modulo, bg wraps at 1280px: 2880 % 1280 = 320px -> bg = -320px.
    act(() => {
      scrollX.setValue(14400);
    });
    expect(getTranslateX(bgLayer)).toBe(-320);
    const bgRightEdge = getTranslateX(bgLayer) + 2560;
    expect(bgRightEdge).toBe(2240);
    expect(bgRightEdge).toBeGreaterThan(1280);

    unmount();
  });

  it('seamlessly loops at exact multiple of strip width', () => {
    const scrollX = new Animated.Value(0);
    const { container, unmount } = render(<ScrollingWorld scrollX={scrollX} scene={SCENES[0]} />);

    const root = container.firstElementChild as HTMLElement;
    const [, , fgLayer] = Array.from(root.children) as HTMLElement[];

    act(() => {
      scrollX.setValue(1280);
    });
    expect(Math.abs(getTranslateX(fgLayer))).toBe(0);

    act(() => {
      scrollX.setValue(2560);
    });
    expect(Math.abs(getTranslateX(fgLayer))).toBe(0);

    unmount();
  });
});
