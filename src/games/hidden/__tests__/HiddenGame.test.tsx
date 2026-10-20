// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { manifest } from '../../../manifest';
import * as sound from '../../../sound';
import { HiddenGame } from '../HiddenGame';

describe('HiddenGame solo mode auto-hint', () => {
  const noop = () => {};
  const scene = manifest.hidden[0];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it('triggers a gentle pulse hint after 15 seconds of inactivity in solo mode', async () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={scene.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const targets = screen.getAllByTestId(/^hidden-target-/);
    expect(targets.length).toBeGreaterThan(0);

    // Initially no target has a hint ring or found ring
    for (const target of targets) {
      expect(target.children.length).toBe(0);
    }

    // At 14.9 seconds, still no hint
    act(() => {
      vi.advanceTimersByTime(14900);
    });
    for (const target of targets) {
      expect(target.children.length).toBe(0);
    }

    // At 15 seconds, exactly one unfound target pulses with a hint ring
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const hintedTargets = targets.filter((target) => target.children.length > 0);
    expect(hintedTargets).toHaveLength(1);

    // After 2.5 seconds (hint duration), the hint ring disappears
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    for (const target of targets) {
      expect(target.children.length).toBe(0);
    }
  });

  it('resets the 15-second hint timer when a target is found', async () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={scene.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const targets = screen.getAllByTestId(/^hidden-target-/);
    expect(targets.length).toBeGreaterThan(1);

    // Advance 10 seconds (no hint yet)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    for (const target of targets) {
      expect(target.children.length).toBe(0);
    }

    // Tap first target to find it
    act(() => {
      fireEvent.click(targets[0]);
    });

    // The found target now has a FoundRing; remaining targets have 0 children
    expect(targets[0].children.length).toBeGreaterThan(0);
    const remainingTargets = targets.slice(1);
    for (const target of remainingTargets) {
      expect(target.children.length).toBe(0);
    }

    // Advance another 10 seconds (total 20s from start, but only 10s since find)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    for (const target of remainingTargets) {
      expect(target.children.length).toBe(0);
    }

    // Advance 5 more seconds (15s since find) -> one remaining target should pulse
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const newlyHinted = remainingTargets.filter((target) => target.children.length > 0);
    expect(newlyHinted).toHaveLength(1);
  });
});
