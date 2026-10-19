// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BellsGame } from './BellsGame';
import * as music from '../../music';

describe('BellsGame replay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replay button restarts demo and clears taps', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0); // Sequence will be [0, 0]
    const playNoteSpy = vi.spyOn(music, 'playNote').mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    // Tap count is initially 0
    expect(screen.getByText('Your turn! (0/2)', { exact: false })).toBeTruthy();

    // Tap the first correct bell
    const bell0 = screen.getByTestId('bell-0');
    fireEvent.click(bell0);

    // Tap count should be 1
    expect(screen.getByText('Your turn! (1/2)', { exact: false })).toBeTruthy();

    // Press replay button
    const replayBtn = screen.getByTestId('replay-button');
    expect(replayBtn.getAttribute('role')).toBe('button');
    fireEvent.click(replayBtn);

    expect(screen.queryByText('Your turn!', { exact: false })).toBeNull();

    // It should go back to listen phase
    expect(screen.getByText('Listen...')).toBeTruthy();

    // Fast-forward through demo again
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Tap count should be back to 0
    expect(screen.getByText('Your turn! (0/2)', { exact: false })).toBeTruthy();

    vi.useRealTimers();
  });
});
