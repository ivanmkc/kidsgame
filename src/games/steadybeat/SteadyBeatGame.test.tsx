// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SteadyBeatGame } from './SteadyBeatGame';

it('renders progress dots correctly during the tap phase', () => {
  vi.useFakeTimers();

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Should not have progress dots initially in the 'listen' phase
  expect(screen.queryAllByTestId('steadybeat-tap-dot-empty')).toHaveLength(0);

  // Advance to tap phase
  act(() => {
    vi.advanceTimersByTime(5000);
  });

  // Now the game is in 'tap' phase, there should be 8 dots, all empty
  expect(screen.getAllByTestId('steadybeat-tap-dot-empty')).toHaveLength(8);
  expect(screen.queryAllByTestId('steadybeat-tap-dot-filled')).toHaveLength(0);

  const circle = screen.getByTestId('steadybeat-circle');

  act(() => {
    fireEvent.click(circle);
  });

  // After 1 tap, there should be 1 filled dot and 7 empty dots
  expect(screen.getAllByTestId('steadybeat-tap-dot-filled')).toHaveLength(1);
  expect(screen.getAllByTestId('steadybeat-tap-dot-empty')).toHaveLength(7);

  vi.useRealTimers();
});
