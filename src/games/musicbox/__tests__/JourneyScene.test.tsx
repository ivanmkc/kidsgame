// @vitest-environment happy-dom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Animated } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENES } from '../scenes';
import { JourneyScene } from '../JourneyScene';
import { ScrollingWorld } from '../ScrollingWorld';
import { SpawnedObject, SpawnEntry } from '../SpawnedObject';

vi.mock('../../assets/images', () => {
  const p = new Proxy({}, { get: () => ({ uri: 'stub.png' }) });
  return {
    MUSICBOX_IMAGES: p,
    SPOTIT_ICONS: p,
    SPOTIT_SHADOWS: p,
    SCENE_IMAGES: p,
    SCENE_THUMBS: p,
    UI_IMAGES: p,
    DRESSUP_ICONS: p,
    RHYME_SPRITES: {},
  };
});

describe('JourneyScene accessibility', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders stage as a container with accessibility label and not a button', () => {
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByLabelText('Stage');

    expect(stage).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Stage' })).toBeNull();
    unmount();
  });

  it('spawns an object on tap, which receives the lang prop', () => {
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="ja" />);

    const stage = screen.getByLabelText('ステージ');
    fireEvent.touchStart(stage, {
      changedTouches: [
        {
          locationX: 100,
          locationY: 100,
          force: 1,
          identifier: 1,
          pageX: 100,
          pageY: 100,
          clientX: 100,
          clientY: 100,
        },
      ],
    });

    const note = screen.getByRole('button', { name: 'おんぷ' });
    expect(note).toBeDefined();

    unmount();
  });

  it('scrolls by full 48px on initial tap without hold-down throttling', () => {
    const springSpy = vi.spyOn(Animated, 'spring');
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);

    const stage = screen.getByLabelText('Stage');
    fireEvent.touchStart(stage, {
      changedTouches: [
        {
          locationX: 100,
          locationY: 100,
          force: 1,
          identifier: 1,
          pageX: 100,
          pageY: 100,
          clientX: 100,
          clientY: 100,
        },
      ],
    });

    expect(springSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 48 }),
    );

    unmount();
  });

  it('renders spawned object with button role and accessibility label', () => {
    const onTapSpawn = vi.fn();
    const entry: SpawnEntry = {
      id: 1,
      x: 50,
      y: 50,
      scrollAtSpawn: 0,
      spriteKey: 'obj_sky_star',
      sceneId: 'twinkle',
      big: false,
      zone: 'sky',
    };
    const scrollX = new Animated.Value(0);

    const { unmount } = render(<SpawnedObject entry={entry} scrollX={scrollX} onTapSpawn={onTapSpawn} lang="en" />);

    const button = screen.getByRole('button', { name: 'Music note' });
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-label')).toBe('Music note');

    fireEvent.click(button);
    expect(onTapSpawn).toHaveBeenCalledWith(entry);

    unmount();
  });

  it('wraps parallax layers modulo 1280 during extended play so scenery never scrolls off-screen', () => {
    // At scrollX = 3840 (80 taps * 48px), without modulo the foreground would scroll to
    // translateX(-3840px), completely past the 2560px container into an empty void.
    const scrollX = new Animated.Value(3840);
    const { container, unmount } = render(<ScrollingWorld scrollX={scrollX} scene={SCENES[0]} />);

    const root = container.firstChild as HTMLElement;
    expect(root).toBeDefined();

    // Three parallax layers: bg, mid, fg
    const layers = Array.from(root.children) as HTMLElement[];
    expect(layers).toHaveLength(3);

    // bg: (3840 * 0.2) % 1280 = 768 -> translateX(-768px)
    expect(layers[0].style.transform).toBe('translateX(-768px)');
    // mid: (3840 * 0.5) % 1280 = 640 -> translateX(-640px)
    expect(layers[1].style.transform).toBe('translateX(-640px)');
    // fg: 3840 % 1280 = 0 -> translateX(-0px) or translateX(0px)
    expect(layers[2].style.transform).toMatch(/^translateX\(-?0px\)$/);

    unmount();

    // After 300 taps (scrollX = 14400), background sky would be at -2880px without modulo
    // and scrolled completely off the 2560px container into an empty void.
    const extendedScrollX = new Animated.Value(14400);
    const { container: extContainer, unmount: extUnmount } = render(
      <ScrollingWorld scrollX={extendedScrollX} scene={SCENES[0]} />,
    );
    const extLayers = Array.from((extContainer.firstChild as HTMLElement).children) as HTMLElement[];
    // bg: (14400 * 0.2) % 1280 = 2880 % 1280 = 320 -> translateX(-320px)
    expect(extLayers[0].style.transform).toBe('translateX(-320px)');
    // mid: (14400 * 0.5) % 1280 = 7200 % 1280 = 800 -> translateX(-800px)
    expect(extLayers[1].style.transform).toBe('translateX(-800px)');
    // fg: 14400 % 1280 = 320 -> translateX(-320px)
    expect(extLayers[2].style.transform).toBe('translateX(-320px)');

    extUnmount();
  });
});
