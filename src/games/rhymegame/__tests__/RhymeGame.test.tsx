// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { RhymeGame } from '../RhymeGame';

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
});
