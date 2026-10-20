// @vitest-environment happy-dom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Animated } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENES } from '../scenes';
import { JourneyScene } from '../JourneyScene';
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

  it('renders stage with button role and accessibility label', () => {
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByRole('button', { name: 'Stage' });

    expect(stage).toBeDefined();
    unmount();
  });

  it('spawns an object on tap, which receives the lang prop', () => {
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="ja" />);

    const stageBtn = screen.getByRole('button', { name: 'ステージ' });
    fireEvent.touchStart(stageBtn, {
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
});
