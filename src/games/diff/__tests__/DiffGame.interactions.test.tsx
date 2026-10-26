// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { manifest } from '../../../manifest';
import { DiffGame } from '../DiffGame';

describe('DiffGame spoken prompt across scenes', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('re-announces instruction prompt when advancing to subsequent scenes', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    const scene1 = manifest.diff[0].id;
    const scene2 = manifest.diff[1].id;

    const { rerender } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith('Find all the sneaky changes!');
    saySpy.mockClear();

    // Advance to scene 2
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene2}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith('Find all the sneaky changes!');
  });

  it('speaks prompt across picker, scene transitions, and back to picker', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    const scene1 = manifest.diff[0].id;
    const scene2 = manifest.diff[1].id;

    const { rerender } = render(
      <DiffGame onHome={noop} difficulty="medium" onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );

    expect(saySpy).toHaveBeenCalledWith('Where do you want to play?');
    saySpy.mockClear();

    // Pick first scene
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith('Find all the sneaky changes!');
    saySpy.mockClear();

    // Advance to second scene
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene2}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith('Find all the sneaky changes!');
    saySpy.mockClear();

    // Return to picker
    rerender(<DiffGame onHome={noop} difficulty="medium" onPickScene={noop} onBackToPicker={noop} lang="en" />);

    expect(saySpy).toHaveBeenCalledWith('Where do you want to play?');
  });

  it('updates spoken prompt when language changes', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    const scene1 = manifest.diff[0].id;

    const { rerender } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith('Find all the sneaky changes!');
    saySpy.mockClear();

    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith('こっそり ちがうところを ぜんぶ みつけよう！');
  });
});
