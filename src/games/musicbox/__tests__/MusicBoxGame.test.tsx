// @vitest-environment happy-dom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MusicBoxGame } from '../MusicBoxGame';

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

describe('MusicBoxGame rendering', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('passes lang down to JourneyScene when a scene is selected', () => {
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="ja"
      />,
    );

    // If JourneyScene receives `lang="ja"`, the stage's aria-label will be 'ステージ'
    const stageBtn = screen.getByRole('button', { name: 'ステージ' });
    expect(stageBtn).toBeDefined();

    unmount();
  });

  it('renders instructional subtitle in scene play mode', () => {
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    expect(screen.getByText('Tap anywhere to play the next note!')).toBeDefined();

    unmount();
  });
});
