// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { manifest } from '../../../manifest';
import * as sound from '../../../sound';
import { RhymeGame } from '../RhymeGame';
import { availableEntries } from '../logic';

vi.mock('../../assets/images', () => {
  const p = new Proxy({}, { get: () => ({ uri: 'stub.png' }) });
  return {
    SPOTIT_ICONS: p,
    RHYME_SPRITES: p,
  };
});

function setViewport(width: number, height: number) {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: height,
    configurable: true,
  });
  if (window.visualViewport) {
    Object.defineProperty(window.visualViewport, 'width', {
      value: width,
      configurable: true,
    });
    Object.defineProperty(window.visualViewport, 'height', {
      value: height,
      configurable: true,
    });
  }
  window.dispatchEvent(new Event('resize'));
}

describe('RhymeGame', () => {
  const onHome = vi.fn();
  let goodSpy: ReturnType<typeof vi.spyOn>;
  let wrongSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sound, 'sayThen').mockImplementation((_, cb) => cb && cb());
    goodSpy = vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    wrongSpy = vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders prompt and tiles on portrait orientation', () => {
    setViewport(390, 844);
    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const promptImage = screen.getByTestId('rhyme-prompt-image');
    expect(promptImage.style.width).toBe('110px');

    const tile0 = screen.getByTestId('rhyme-tile-0');
    expect(tile0.style.width).toBe('110px');
    expect(screen.getByTestId('rhyme-tile-1')).toBeDefined();
    expect(screen.getByTestId('rhyme-tile-2')).toBeDefined();
  });

  it('renders responsive landscape layout on mobile landscape viewports', () => {
    setViewport(844, 390);
    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const promptImage = screen.getByTestId('rhyme-prompt-image');
    expect(promptImage.style.width).toBe('68px');

    const tile0 = screen.getByTestId('rhyme-tile-0');
    expect(tile0.style.width).toBe('91px');
    expect(tile0.style.height).toBe('91px');
  });

  it('handles correct and wrong tile taps', () => {
    setViewport(844, 390);
    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    fireEvent.click(screen.getByTestId('rhyme-tile-0'));
    expect(goodSpy.mock.calls.length + wrongSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it('tapping a correct tile twice only triggers sfx.good once', () => {
    let sayThenDone: (() => void) | undefined;
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_, cb) => {
      sayThenDone = cb;
    });

    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const entries = availableEntries('en', manifest.spotit.icons);
    const rhymeKeys = new Map(entries.map((e) => [e.icon, e.rhymeKey]));
    const promptEl = screen
      .getAllByTestId(/^rhyme-prompt-/)
      .find((el) => el.getAttribute('data-testid') !== 'rhyme-prompt-image')!;
    const testId = promptEl.getAttribute('data-testid') || '';
    const targetIcon = testId.replace('rhyme-prompt-', '');
    const targetRhyme = rhymeKeys.get(targetIcon);

    const tiles = [0, 1, 2].map((i) => screen.getByTestId(`rhyme-tile-${i}`));
    const correctTile = tiles.find(
      (t) => rhymeKeys.get(t.getAttribute('aria-label') || '') === targetRhyme,
    )!;
    expect(correctTile).toBeDefined();

    // First click: triggers confirmation speech and sfx.good
    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);

    // Second rapid click while confirmation is queued/playing: ignored by lockedRef
    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);

    // Confirmation speech finishes, advancing round and unlocking input
    act(() => {
      sayThenDone?.();
    });
    expect(screen.getByTestId('rhyme-score').textContent).toBe('🎵 1/8');

    // Input is unlocked for the new round
    const round2Tile = screen.getByTestId('rhyme-tile-0');
    fireEvent.click(round2Tile);
    expect(goodSpy.mock.calls.length + wrongSpy.mock.calls.length).toBe(2);
  });
});
