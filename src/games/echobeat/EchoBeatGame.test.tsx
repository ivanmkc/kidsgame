// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EchoBeatGame } from './EchoBeatGame';
import * as logic from './logic';
import * as sound from '../../sound';

function mockAudioContext() {
  const fakeCtx = {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBufferSource: () => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    resume: vi.fn().mockResolvedValue(undefined),
  };
  (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(function () {
    return fakeCtx;
  });
}

describe('EchoBeatGame', () => {
  beforeEach(() => {
    mockAudioContext();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sound.setMuted(false);
  });

  it('plays demo and transitions to tap phase where drum can be tapped', () => {
    vi.useFakeTimers();

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(screen.getByText('Listen...')).toBeTruthy();
    const drum = screen.getByTestId('echobeat-drum');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText('Your turn!')).toBeTruthy();

    act(() => {
      fireEvent.click(drum);
    });

    vi.useRealTimers();
  });

  it('plays demo visually when muted and transitions to tap phase', () => {
    vi.useFakeTimers();
    sound.setMuted(true);

    render(<EchoBeatGame onHome={() => {}} difficulty="medium" lang="en" />);

    expect(screen.getByText('Listen...')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('Listen...')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText('Your turn!')).toBeTruthy();

    vi.useRealTimers();
  });

  it('ignores taps during celebration so they do not leak into the next round', () => {
    vi.useFakeTimers();
    vi.spyOn(sound.sfx, 'wrong');
    vi.spyOn(sound.sfx, 'good');

    vi.spyOn(logic, 'checkEcho').mockReturnValueOnce({ countCorrect: true, timingCorrect: true });

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => { vi.advanceTimersByTime(3000); });
    const drum = screen.getByTestId('echobeat-drum');

    act(() => { fireEvent.click(drum); });
    act(() => { vi.advanceTimersByTime(1200); });
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);

    // After the correct tap and evaluation, 1 dot is filled
    expect(screen.getAllByTestId('tap-dot-filled')).toHaveLength(1);

    // Tap during celebration (800ms)
    act(() => { fireEvent.click(drum); });

    // The stray tap during celebration should be ignored, so the filled dot count remains 1.
    // If the bug is present, it will increment to 2.
    expect(screen.getAllByTestId('tap-dot-filled')).toHaveLength(1);

    vi.useRealTimers();
  });
});
