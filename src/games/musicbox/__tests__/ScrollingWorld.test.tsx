// @vitest-environment happy-dom
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { Animated } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollingWorld } from '../ScrollingWorld';
import { SCENES } from '../scenes';

vi.mock('../../assets/images', () => {
  const p = new Proxy({}, { get: (_, prop) => ({ uri: `${String(prop)}.png` }) });
  return {
    MUSICBOX_IMAGES: p,
  };
});

describe('ScrollingWorld parallax layers resizeMode', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders background and midground parallax layers with cover resizeMode', () => {
    const scrollX = new Animated.Value(0);
    const { container, unmount } = render(<ScrollingWorld scrollX={scrollX} scene={SCENES[0]} />);

    const bgDivs = Array.from(container.querySelectorAll('div')).filter((div) => {
      const style = window.getComputedStyle(div);
      return style.backgroundImage && style.backgroundImage !== 'none';
    });

    expect(bgDivs.length).toBe(9);
    for (const div of bgDivs) {
      const style = window.getComputedStyle(div);
      expect(style.backgroundSize).toBe('cover');
    }
    unmount();
  });
});
