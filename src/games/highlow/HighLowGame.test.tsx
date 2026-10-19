// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as music from '../../music';
import { HighLowGame } from './HighLowGame';

describe('HighLowGame UI', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders two melody dots during listen phase', () => {
    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(screen.getByTestId('melody-dot-0')).toBeDefined();
    expect(screen.getByTestId('melody-dot-1')).toBeDefined();
  });

  it('fills dots sequentially as notes play and transitions to pick phase', () => {
    vi.useFakeTimers();
    let onNoteCb: ((index: number) => void) | undefined;
    let onDoneCb: (() => void) | undefined;

    vi.spyOn(music, 'playSequence').mockImplementation((_notes, _bpm, onNote, onDone) => {
      onNoteCb = onNote;
      onDoneCb = onDone;
      return () => {};
    });

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance past initial 400ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const dot0 = screen.getByTestId('melody-dot-0');
    const dot1 = screen.getByTestId('melody-dot-1');

    // Before note callback: neither dot is filled
    const emptyClass = dot0.className;
    expect(dot1.className).toBe(emptyClass);

    // Note 0 begins playing: dot 0 fills, dot 1 remains empty
    act(() => {
      onNoteCb?.(0);
    });
    const dot0AfterNote0 = screen.getByTestId('melody-dot-0');
    const dot1AfterNote0 = screen.getByTestId('melody-dot-1');
    const filledClass = dot0AfterNote0.className;
    expect(filledClass).not.toBe(emptyClass);
    expect(dot1AfterNote0.className).toBe(emptyClass);

    // Note 1 begins playing: both dots are filled
    act(() => {
      onNoteCb?.(1);
    });
    const dot0AfterNote1 = screen.getByTestId('melody-dot-0');
    const dot1AfterNote1 = screen.getByTestId('melody-dot-1');
    expect(dot0AfterNote1.className).toBe(filledClass);
    expect(dot1AfterNote1.className).toBe(filledClass);

    // Sequence finishes: transitions to pick phase
    act(() => {
      onDoneCb?.();
    });

    expect(screen.queryByTestId('melody-dot-0')).toBeNull();
    expect(screen.queryByTestId('melody-dot-1')).toBeNull();
    expect(screen.getByTestId('highlow-high')).toBeDefined();
    expect(screen.getByTestId('highlow-low')).toBeDefined();

    // Replay returns to listen phase and resets melody dots to empty
    fireEvent.click(screen.getByTestId('highlow-replay'));
    const replayedDot0 = screen.getByTestId('melody-dot-0');
    const replayedDot1 = screen.getByTestId('melody-dot-1');
    expect(replayedDot0.className).toBe(emptyClass);
    expect(replayedDot1.className).toBe(emptyClass);

    vi.useRealTimers();
  });

  it('handles player picks and score updates', () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, 'playSequence').mockImplementation((_notes, _bpm, _onNote, onDone) => {
      onDoneCb = onDone;
      return () => {};
    });

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const highBtn = screen.getByTestId('highlow-high');
    const lowBtn = screen.getByTestId('highlow-low');
    expect(highBtn).toBeDefined();
    expect(lowBtn).toBeDefined();

    fireEvent.click(highBtn);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    vi.useRealTimers();
  });
});
