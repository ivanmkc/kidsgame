// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../../i18n';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { allSceneOptions } from '../../sceneOptions';
import { PuzzleGame } from '../PuzzleGame';
import * as logic from '../logic';

describe('PuzzleGame', () => {
  const noop = () => {};
  const sceneId = allSceneOptions()[0].id;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'win').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the scene picker when no scene is selected', () => {
    render(<PuzzleGame onHome={noop} difficulty="easy" onPickScene={noop} onBackToPicker={noop} lang="en" />);
    expect(screen.getByTestId('scene-surprise')).toBeTruthy();
    expect(screen.queryByTestId('puzzle-peek')).toBeNull();
  });

  it('launches puzzle when a dimmed scene outside the active filter is picked', () => {
    // Farm is a medium-difficulty scene ('d-farm'), dimmed when filter='easy'
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId="d-farm"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByTestId('puzzle-peek')).toBeTruthy();
    expect(screen.queryByTestId('scene-surprise')).toBeNull();
  });

  it('launches puzzle when a matching scene is picked', () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByTestId('puzzle-peek')).toBeTruthy();
    expect(screen.queryByTestId('scene-surprise')).toBeNull();
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

  it('renders peek button with English accessibility label', () => {
    const { unmount } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const peekBtn = screen.getByTestId('puzzle-peek');
    expect(peekBtn.getAttribute('role')).toBe('button');
    expect(peekBtn.getAttribute('aria-label')).toBe(t('en', 'puzzle.peekA11y'));
    expect(peekBtn.getAttribute('aria-label')).toBe('Peek at the finished picture');
    unmount();
  });

  it('renders peek button with localized accessibility label in Japanese', () => {
    const { unmount } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const peekBtn = screen.getByTestId('puzzle-peek');
    expect(peekBtn.getAttribute('role')).toBe('button');
    expect(peekBtn.getAttribute('aria-label')).toBe(t('ja', 'puzzle.peekA11y'));
    expect(peekBtn.getAttribute('aria-label')).toBe('かんせいした えを ちらっとみる');
    unmount();
  });

  it('renders peek button with localized accessibility label in Mandarin and Cantonese', () => {
    const { unmount: unmountCmn } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    expect(screen.getByTestId('puzzle-peek').getAttribute('aria-label')).toBe(t('cmn', 'puzzle.peekA11y'));
    unmountCmn();

    const { unmount: unmountYue } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    expect(screen.getByTestId('puzzle-peek').getAttribute('aria-label')).toBe(t('yue', 'puzzle.peekA11y'));
    unmountYue();
  });

  it('plays tap sound when peek button is clicked', () => {
    const tapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const { unmount } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const peekBtn = screen.getByTestId('puzzle-peek');
    fireEvent.click(peekBtn);
    expect(tapSpy).toHaveBeenCalled();
    tapSpy.mockRestore();
    unmount();
  });

  it('swaps tiles when tapped in rapid succession before re-render', () => {
    vi.spyOn(logic, 'makePuzzle').mockReturnValue([1, 0, 2, 3, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const tile0 = screen.getByTestId('puzzle-tile-0-piece-1');
    const tile1 = screen.getByTestId('puzzle-tile-1-piece-0');

    // Rapid successive taps inside the same execution frame / batch
    act(() => {
      fireEvent.click(tile0);
      fireEvent.click(tile1);
    });

    // Both tiles should have swapped positions
    expect(screen.queryByTestId('puzzle-tile-0-piece-0')).not.toBeNull();
    expect(screen.queryByTestId('puzzle-tile-1-piece-1')).not.toBeNull();
    expect(screen.getByTestId('puzzle-moves').textContent).toContain('1');
  });

  it('deselects tile when same tile is tapped rapidly before re-render', () => {
    vi.spyOn(logic, 'makePuzzle').mockReturnValue([1, 0, 2, 3, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const tile0 = screen.getByTestId('puzzle-tile-0-piece-1');

    // Rapid double-tap on the same tile deselects it
    act(() => {
      fireEvent.click(tile0);
      fireEvent.click(tile0);
    });

    // No swap occurred and moves stayed 0
    expect(screen.queryByTestId('puzzle-tile-0-piece-1')).not.toBeNull();
    expect(screen.getByTestId('puzzle-moves').textContent).toContain('0');

    // Subsequent tap on tile 1 selects tile 1 rather than swapping with tile 0
    const tile1 = screen.getByTestId('puzzle-tile-1-piece-0');
    fireEvent.click(tile1);
    expect(screen.getByTestId('puzzle-moves').textContent).toContain('0');
  });

  it('handles multiple rapid swaps in sequence', () => {
    vi.spyOn(logic, 'makePuzzle').mockReturnValue([1, 0, 3, 2, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const tile0 = screen.getByTestId('puzzle-tile-0-piece-1');
    const tile1 = screen.getByTestId('puzzle-tile-1-piece-0');
    const tile2 = screen.getByTestId('puzzle-tile-2-piece-3');
    const tile3 = screen.getByTestId('puzzle-tile-3-piece-2');

    act(() => {
      fireEvent.click(tile0);
      fireEvent.click(tile1);
      fireEvent.click(tile2);
      fireEvent.click(tile3);
    });

    expect(screen.queryByTestId('puzzle-tile-0-piece-0')).not.toBeNull();
    expect(screen.queryByTestId('puzzle-tile-1-piece-1')).not.toBeNull();
    expect(screen.queryByTestId('puzzle-tile-2-piece-2')).not.toBeNull();
    expect(screen.queryByTestId('puzzle-tile-3-piece-3')).not.toBeNull();
    expect(screen.getByTestId('puzzle-moves').textContent).toContain('2');
  });

  it('swaps tiles on standard spaced taps', () => {
    vi.spyOn(logic, 'makePuzzle').mockReturnValue([1, 0, 2, 3, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    fireEvent.click(screen.getByTestId('puzzle-tile-0-piece-1'));
    fireEvent.click(screen.getByTestId('puzzle-tile-1-piece-0'));

    expect(screen.queryByTestId('puzzle-tile-0-piece-0')).not.toBeNull();
    expect(screen.queryByTestId('puzzle-tile-1-piece-1')).not.toBeNull();
    expect(screen.getByTestId('puzzle-moves').textContent).toContain('1');
  });
});
