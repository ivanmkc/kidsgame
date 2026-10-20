// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
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

  it('translates the peek button accessibility label', () => {
    // Render in Japanese
    render(
      <PuzzleGame
        onHome={() => {}}
        difficulty="easy"
        sceneId="d-beach"
        onPickScene={() => {}}
        onBackToPicker={() => {}}
        lang="ja"
      />,
    );
    const peekBtn = screen.getByTestId('puzzle-peek');
    // For Japanese, 'puzzle.peek.a11y' is 'かんせいした えを みる'
    expect(peekBtn.getAttribute('aria-label')).toBe('かんせいした えを みる');
  });
});
