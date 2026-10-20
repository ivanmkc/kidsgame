// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { t } from '../../../i18n';
import { Lang } from '../../../lang';
import { allSceneOptions } from '../../sceneOptions';
import { PuzzleGame } from '../PuzzleGame';

describe('PuzzleGame', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sfx, 'win').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the scene picker when no scene is selected', () => {
    render(<PuzzleGame onHome={noop} difficulty="medium" onPickScene={noop} onBackToPicker={noop} lang="en" />);
    expect(screen.getByTestId('scene-surprise')).toBeTruthy();
  });

  it('renders 6 tiles and no timer for an easy scene under the all filter', () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getAllByTestId(/^puzzle-tile-/)).toHaveLength(6);
    expect(screen.queryByTestId('puzzle-timer')).toBeNull();
  });

  it('renders 12 tiles and a timer for a hard scene under the all filter', () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-princess"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getAllByTestId(/^puzzle-tile-/)).toHaveLength(12);
    expect(screen.getByTestId('puzzle-timer')).toBeTruthy();
  });

  it('renders 9 tiles and a timer for a medium scene under the all filter', () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-unicorn"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getAllByTestId(/^puzzle-tile-/)).toHaveLength(9);
    expect(screen.getByTestId('puzzle-timer')).toBeTruthy();
  });

  it('allows swapping tiles and increments moves counter', () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getByTestId('puzzle-moves').textContent).toContain('0');
    const tiles = screen.getAllByTestId(/^puzzle-tile-/);
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);
    expect(screen.getByTestId('puzzle-moves').textContent).toContain('1');
  });

  it('shows peek overlay when peek button is tapped', () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.queryByTestId('puzzle-peek-overlay')).toBeNull();
    fireEvent.click(screen.getByTestId('puzzle-peek'));
    expect(screen.getByTestId('puzzle-peek-overlay')).toBeTruthy();
  });

  it('speaks English baseline instructions in picker and scene modes', () => {
    const saySpy = vi.spyOn(sound, 'useSay');
    const firstScene = allSceneOptions('all')[0].id;

    const { rerender } = render(
      <PuzzleGame onHome={noop} difficulty="medium" onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );
    expect(saySpy).toHaveBeenCalledWith('Which picture do you want to solve?');

    saySpy.mockClear();
    rerender(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        sceneId={firstScene}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(saySpy).toHaveBeenCalledWith('Tap one piece, then tap another to swap them!');
  });

  it('speaks localized instructions in picker mode across non-English languages', () => {
    const saySpy = vi.spyOn(sound, 'useSay');
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];

    for (const lang of nonEnLangs) {
      saySpy.mockClear();
      const { unmount } = render(
        <PuzzleGame onHome={noop} difficulty="medium" onPickScene={noop} onBackToPicker={noop} lang={lang} />,
      );

      const expected = t(lang, 'picker.puzzle');
      expect(expected).not.toBe('Which picture do you want to solve?');
      expect(saySpy).toHaveBeenCalledWith(expected);
      unmount();
    }
  });

  it('speaks localized instructions in scene mode across non-English languages', () => {
    const saySpy = vi.spyOn(sound, 'useSay');
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    const firstScene = allSceneOptions('all')[0].id;

    for (const lang of nonEnLangs) {
      saySpy.mockClear();
      const { unmount } = render(
        <PuzzleGame
          onHome={noop}
          difficulty="medium"
          sceneId={firstScene}
          onPickScene={noop}
          onBackToPicker={noop}
          lang={lang}
        />,
      );

      const expected = t(lang, 'puzzle.hint');
      expect(expected).not.toBe('Tap one piece, then tap another to swap them!');
      expect(saySpy).toHaveBeenCalledWith(expected);
      unmount();
    }
  });
});
