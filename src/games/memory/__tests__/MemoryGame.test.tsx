// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryGame } from '../MemoryGame';

vi.mock('../../../sound', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../sound')>();
  return {
    ...actual,
    say: vi.fn(),
    sfx: {
      ...actual.sfx,
      good: vi.fn(),
      wrong: vi.fn(),
      tap: vi.fn(),
    },
  };
});

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: height,
    configurable: true,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('MemoryGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setViewport(800, 600);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders memory cards on board and tracks moves on card flips', async () => {
    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" lang="en" />);

    const cards = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('memory-card-'));
    // Easy mode memory has 4 pairs = 8 cards
    expect(cards).toHaveLength(8);

    // Initial state: all cards face down
    for (const card of cards) {
      expect(card.getAttribute('aria-label')).toBe('face-down card');
    }

    // Flip first card
    await act(async () => {
      fireEvent.click(cards[0]);
    });
    expect(cards[0].getAttribute('aria-label')).not.toBe('face-down card');

    // Flip second card
    await act(async () => {
      fireEvent.click(cards[1]);
    });

    // Score / moves should be updated
    const movesText = screen.getByTestId('memory-moves');
    expect(movesText.textContent).toContain('1');
  });

  it('localizes face-down card accessibility labels via i18n in non-English mode', () => {
    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" lang="ja" />);

    const cards = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('memory-card-'));

    for (const card of cards) {
      expect(card.getAttribute('aria-label')).toBe('うらがえしのカード');
    }
  });
});
