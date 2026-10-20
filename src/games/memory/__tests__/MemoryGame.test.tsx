// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import * as sound from '../../../sound';
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

  it('plays in 2P duel mode, updates player scores on matches, and allows rematch', async () => {
    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" twoPlayerEnabled lang="en" />);

    // In 2P enabled mode, ModePicker is shown first
    const twoPlayerBtn = screen.getByTestId('mp-choose-2p');
    await act(async () => {
      fireEvent.click(twoPlayerBtn);
    });

    // Board and duel chips are now visible
    expect(screen.getByTestId('memory-duel-chip-0')).toBeDefined();
    expect(screen.getByTestId('memory-duel-chip-1')).toBeDefined();

    const cards = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('memory-card-'));
    expect(cards).toHaveLength(8);

    // Group cards by icon
    const iconPairs = new Map<string, HTMLElement[]>();
    for (const card of cards) {
      const parts = card.getAttribute('data-testid')!.split('-');
      const icon = parts.slice(3).join('-');
      const list = iconPairs.get(icon) ?? [];
      list.push(card);
      iconPairs.set(icon, list);
    }

    // Match all pairs
    for (const [c1, c2] of iconPairs.values()) {
      await act(async () => {
        fireEvent.click(c1);
      });
      await act(async () => {
        fireEvent.click(c2);
      });
    }

    // Fast-forward entrance animation so win overlay buttons arm
    act(() => {
      vi.advanceTimersByTime(700);
    });

    // WinOverlay appears with rematch button
    const rematchBtn = screen.getByTestId('play-again');
    expect(rematchBtn).toBeDefined();

    // Clicking Rematch resets board
    await act(async () => {
      fireEvent.click(rematchBtn);
    });

    const resetCards = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('memory-card-'));
    expect(resetCards).toHaveLength(8);
    for (const card of resetCards) {
      expect(card.getAttribute('aria-label')).toBe('face-down card');
    }
  });

  it('cancels mismatch timer and suppresses ghost turn narration on unmount', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    const onHome = vi.fn();

    const { unmount } = render(
      <MemoryGame onHome={onHome} difficulty="easy" twoPlayerEnabled={true} lang="en" />
    );

    // Pick 2-Player mode
    const p2Btn = screen.getByTestId('mp-choose-2p');
    fireEvent.click(p2Btn);

    // Find all cards
    const cards = screen.getAllByTestId(/^memory-card-/);
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // Pick two non-matching cards
    const firstCard = cards[0];
    const firstTestId = firstCard.getAttribute('data-testid')!;
    // format is memory-card-{key}-{icon}
    const firstParts = firstTestId.split('-');
    const firstIcon = firstParts.slice(3).join('-');

    const mismatchCard = cards.find((c) => {
      const parts = c.getAttribute('data-testid')!.split('-');
      const icon = parts.slice(3).join('-');
      return icon !== firstIcon;
    });
    expect(mismatchCard).toBeDefined();

    // Clear any speech from entering the game
    saySpy.mockClear();

    // Tap first card then second non-matching card
    act(() => {
      fireEvent.click(firstCard);
    });
    act(() => {
      fireEvent.click(mismatchCard!);
    });

    // Say should not have spoken the next player's turn yet (750ms timeout pending)
    expect(saySpy).not.toHaveBeenCalled();

    // Simulate navigating home before 750ms elapses
    unmount();

    // Advance past the 750ms mismatch duration
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should NOT announce next player's turn on unmounted component
    expect(saySpy).not.toHaveBeenCalled();
  });
});
