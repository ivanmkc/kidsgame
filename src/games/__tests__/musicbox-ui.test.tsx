// @vitest-environment happy-dom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Animated } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpawnedObject, SpawnEntry } from '../musicbox/SpawnedObject';
import { ZONE_PARALLAX_SPEEDS, SpawnZone } from '../musicbox/logic';

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

function createEntry(zone: SpawnZone, scrollAtSpawn = 0): SpawnEntry {
  return {
    id: 1,
    x: 200,
    y: 150,
    scrollAtSpawn,
    spriteKey: 'obj_sky_star',
    sceneId: 'twinkle',
    big: false,
    zone,
    midi: 60,
  };
}

function getTranslateX(button: HTMLElement): number {
  const parent = button.parentElement as HTMLElement;
  const match = parent.style.transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
  return match ? parseFloat(match[1]) : 0;
}

describe('musicbox spawned object parallax scrolling', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("calls Animated.multiply with the zone's parallax speed for sky and mid zones", () => {
    const multiplySpy = vi.spyOn(Animated, 'multiply');
    const scrollX = new Animated.Value(0);

    const { unmount: unmountSky } = render(
      <SpawnedObject entry={createEntry('sky')} scrollX={scrollX} lang="en" />,
    );
    expect(multiplySpy).toHaveBeenCalledWith(expect.anything(), ZONE_PARALLAX_SPEEDS.sky);
    unmountSky();

    multiplySpy.mockClear();

    const { unmount: unmountMid } = render(
      <SpawnedObject entry={createEntry('mid')} scrollX={scrollX} lang="en" />,
    );
    expect(multiplySpy).toHaveBeenCalledWith(expect.anything(), ZONE_PARALLAX_SPEEDS.mid);
    unmountMid();

    multiplySpy.mockClear();

    const { unmount: unmountGround } = render(
      <SpawnedObject entry={createEntry('ground')} scrollX={scrollX} lang="en" />,
    );
    expect(multiplySpy).toHaveBeenCalledWith(expect.anything(), ZONE_PARALLAX_SPEEDS.ground);
    unmountGround();
  });

  it("scales translateX by the zone's parallax speed when world scrolls", () => {
    const scrollX = new Animated.Value(100);

    // Sky object (speed = 0.2): delta = 0 - 100 = -100, translateX = -100 * 0.2 = -20px
    const { unmount: unmountSky } = render(
      <SpawnedObject entry={createEntry('sky', 0)} scrollX={scrollX} lang="en" />,
    );
    const skyNote = screen.getByRole('button', { name: 'Music note' });
    expect(getTranslateX(skyNote)).toBeCloseTo(-20);
    unmountSky();

    // Mid object (speed = 0.5): delta = 0 - 100 = -100, translateX = -100 * 0.5 = -50px
    const { unmount: unmountMid } = render(
      <SpawnedObject entry={createEntry('mid', 0)} scrollX={scrollX} lang="en" />,
    );
    const midNote = screen.getByRole('button', { name: 'Music note' });
    expect(getTranslateX(midNote)).toBeCloseTo(-50);
    unmountMid();

    // Ground object (speed = 1.0): delta = 0 - 100 = -100, translateX = -100 * 1 = -100px
    const { unmount: unmountGround } = render(
      <SpawnedObject entry={createEntry('ground', 0)} scrollX={scrollX} lang="en" />,
    );
    const groundNote = screen.getByRole('button', { name: 'Music note' });
    expect(getTranslateX(groundNote)).toBeCloseTo(-100);
    unmountGround();
  });

  it('positions spawned object at initial coordinates when scrollX equals scrollAtSpawn', () => {
    const scrollX = new Animated.Value(64);
    const zones: SpawnZone[] = ['sky', 'mid', 'ground'];

    for (const zone of zones) {
      const { unmount } = render(
        <SpawnedObject entry={createEntry(zone, 64)} scrollX={scrollX} lang="en" />,
      );
      const note = screen.getByRole('button', { name: 'Music note' });
      expect(getTranslateX(note)).toBeCloseTo(0);
      unmount();
    }
  });
});
