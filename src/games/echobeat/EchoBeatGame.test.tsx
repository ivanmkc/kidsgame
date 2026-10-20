// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EchoBeatGame } from './EchoBeatGame';
import * as sound from '../../sound';
import * as music from '../../music';

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

  it('does not leak playDemo execution after unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    
    act(() => {
      vi.advanceTimersByTime(3000); // finish initial demo
    });

    const drum = screen.getByTestId('echobeat-drum');
    act(() => {
      fireEvent.click(drum); // one tap (incorrect count)
    });

    // Wait for the evaluation (1200ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Now it's the 1000ms retry timer window. Unmount.
    unmount();

    const playDrumSequenceSpy = vi.spyOn(music, 'playDrumSequence');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(playDrumSequenceSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
