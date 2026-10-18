// @vitest-environment happy-dom
import React from 'react';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import * as sound from '../../../sound';
import * as logic from '../logic';
import { CarModeGame } from '../CarModeGame';

const noop = () => {};

describe('CarModeGame interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    cleanup();
  });

  it('calls startRound on mount and advances to gap on audio completion', () => {
    vi.useFakeTimers();
    vi.spyOn(sound, 'sayThen').mockImplementation((_text, cb) => {
      setTimeout(cb, 100);
    });

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText('Listen...')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Your turn!')).toBeDefined();
  });

  it('handles standard packs without boops delay', () => {
    vi.useFakeTimers();
    vi.spyOn(sound, 'sayThen').mockImplementation((_text, cb) => {
      setTimeout(cb, 100);
    });

    const actual = logic.startState('silly', 42);
    vi.spyOn(logic, 'startState').mockReturnValue(actual);

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText('Listen...')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Your turn!')).toBeDefined();
  });

  it('allows user taps during prompt phase to advance directly to gap', () => {
    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText('Listen...')).toBeDefined();

    const tapBtn = screen.getByTestId('carmode-tap');
    fireEvent.click(tapBtn);

    expect(screen.getByText('Your turn!')).toBeDefined();
  });
});
