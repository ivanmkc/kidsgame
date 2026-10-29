// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { manifest } from '../../../manifest';
import { DiffGame } from '../DiffGame';

describe('DiffGame language switch mid-round', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('safely manages language switches mid-round without firing old-language speech', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});

    // Choose the first scene to jump directly in
    const sceneId = manifest.diff[0].id;

    const { rerender } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    // Verify speech occurred for English
    expect(saySpy).toHaveBeenCalledWith('Find all the sneaky changes!');

    stopNarrationSpy.mockClear();
    saySpy.mockClear();

    // Switch the language prop mid-round
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    // useLangEpoch should stop previous narration
    expect(stopNarrationSpy).toHaveBeenCalled();

    // It should speak the new language prompt
    expect(saySpy).toHaveBeenCalledWith('こっそり ちがうところを ぜんぶ みつけよう！');
  });
});
