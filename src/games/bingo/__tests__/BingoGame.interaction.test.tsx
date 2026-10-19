// @vitest-environment happy-dom
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import { vi, test, expect, afterEach } from 'vitest';
import { BingoGame } from '../BingoGame';

vi.useFakeTimers();

afterEach(() => {
  cleanup();
});

test('tapping an incorrect tile after a correct one does not cancel the round advance', async () => {
  const onHome = vi.fn();
  render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);

  await act(async () => {
    vi.advanceTimersByTime(1000);
  });

  let prompt = screen.getByTestId('bingo-prompt');
  let initialPrompt = prompt.textContent!;

  let icon = initialPrompt.replace('Find the ', '').replace('!', '');

  let cells = screen.queryAllByTestId(/bingo-cell-/);
  let correctCell = cells.find((c) => c.getAttribute('aria-label') === icon);
  let incorrectCell = cells.find((c) => c.getAttribute('aria-label') !== icon);

  // Tap correct
  await act(async () => {
    fireEvent.click(correctCell!);
  });

  // IMMEDIATELY tap incorrect
  await act(async () => {
    fireEvent.click(incorrectCell!);
  });

  // Wait for round advance logic
  await act(async () => {
    vi.advanceTimersByTime(100);
  });

  prompt = screen.getByTestId('bingo-prompt');
  // At 100ms, the game should still be waiting for the confirmation audio to finish,
  // rather than having been prematurely canceled by the incorrect tap.
  expect(prompt.textContent).toBe(initialPrompt);

  // After the full duration (9s fallback in test env), it should advance properly.
  await act(async () => {
    vi.advanceTimersByTime(9000);
  });

  prompt = screen.getByTestId('bingo-prompt');
  expect(prompt.textContent).not.toBe(initialPrompt);
});

test('changes language', async () => {
  const onHome = vi.fn();
  const { rerender } = render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);
  await act(async () => {
    vi.runAllTimers();
  });

  // Change lang (covers line 75, 85)
  rerender(<BingoGame onHome={onHome} difficulty="easy" lang="ja" />);
  await act(async () => {
    vi.runAllTimers();
  });

  const prompts = screen.getAllByTestId('bingo-prompt');
  const jaPrompt = prompts[prompts.length - 1];
  expect(jaPrompt.textContent).toContain('さがしてね');
});

test('unmounts with wrong timer running', async () => {
  const onHome = vi.fn();
  const { unmount } = render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);
  await act(async () => {
    vi.runAllTimers();
  });

  let prompt = screen.getByTestId('bingo-prompt');
  let icon = prompt.textContent!.replace('Find the ', '').replace('!', '');

  let cells = screen.queryAllByTestId(/bingo-cell-/);
  let incorrectCell = cells.find((c) => c.getAttribute('aria-label') !== icon);

  // Tap incorrect tile (covers 130, 131)
  await act(async () => {
    fireEvent.click(incorrectCell!);
  });

  // Unmount while wrong timer is running (covers 98)
  unmount();
  // Expect no errors
  expect(true).toBe(true);
});

test('plays through to win and resets', async () => {
  const onHome = vi.fn();
  render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);
  await act(async () => {
    vi.runAllTimers();
  });

  // Play until win
  for (let round = 0; round < 10; round++) {
    if (screen.queryByTestId('win-overlay')) break;

    let prompt = screen.queryByTestId('bingo-prompt');
    if (!prompt) break;
    let icon = prompt.textContent!.replace('Find the ', '').replace('!', '');
    let cells = screen.queryAllByTestId(/bingo-cell-/);
    let correctCell = cells.find((c) => c.getAttribute('aria-label') === icon);
    if (!correctCell) break;

    await act(async () => {
      fireEvent.click(correctCell);
    });
    await act(async () => {
      vi.runAllTimers();
    });
  }

  // Covers 118 (winLine set)
  expect(screen.getByTestId('win-overlay')).toBeDefined();

  // The WinOverlay arms its buttons after a 600ms delay to prevent misclicks
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });

  // Click Play Again (covers 141-152)
  const nextBtn = screen.getByTestId('play-again');
  await act(async () => {
    fireEvent.click(nextBtn);
  });
  await act(async () => {
    vi.runAllTimers();
  });

  // Should have restarted
  expect(screen.getByTestId('bingo-prompt')).toBeDefined();
});
