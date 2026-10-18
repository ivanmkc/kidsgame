// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { SameDiffGame } from './SameDiffGame';
import { phrasePitchRatios, SameDiffRound } from './logic';

describe('SameDiffGame UI', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders dots during listen phases', () => {
    const { container } = render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(container.textContent).not.toContain('1/2 🎵');
    expect(screen.getByTestId('melody-dot-0')).toBeTruthy();
    expect(screen.getByTestId('melody-dot-1')).toBeTruthy();
  });

  it('Different card renders with a warm orange border and text', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const diffButton = screen.getByTestId('samediff-diff');
    expect(diffButton.style.backgroundColor).toMatch(/rgba?\(254,\s*243,\s*232/);
    expect(diffButton.style.borderTopColor).toMatch(/rgba?\(232,\s*155,\s*79/);
    
    // The text element is a child
    const diffText = screen.getByText('Different');
    expect(diffText.style.color).toMatch(/rgba?\(232,\s*155,\s*79/);

    vi.useRealTimers();
  });

  it('computes proportional pitch ratios in logic', () => {
    const roundSame: SameDiffRound = {
      phraseA: [{ m: 60, b: 1 }, { m: 64, b: 1 }, { m: 67, b: 1 }],
      phraseB: [{ m: 60, b: 1 }, { m: 64, b: 1 }, { m: 67, b: 1 }],
      answer: 'same',
    };
    const ratiosA = phrasePitchRatios(roundSame, roundSame.phraseA);
    const ratiosB = phrasePitchRatios(roundSame, roundSame.phraseB);
    expect(ratiosA).toEqual([0, 4 / 7, 1]);
    expect(ratiosB).toEqual(ratiosA);

    const roundDiff: SameDiffRound = {
      phraseA: [{ m: 60, b: 1 }, { m: 64, b: 1 }, { m: 67, b: 1 }],
      phraseB: [{ m: 60, b: 1 }, { m: 68, b: 1 }, { m: 67, b: 1 }],
      answer: 'different',
    };
    const diffRatiosA = phrasePitchRatios(roundDiff, roundDiff.phraseA);
    const diffRatiosB = phrasePitchRatios(roundDiff, roundDiff.phraseB);
    expect(diffRatiosA[1]).toBe(0.5); // (64 - 60) / 8
    expect(diffRatiosB[1]).toBe(1);   // (68 - 60) / 8

    const flatRound: SameDiffRound = {
      phraseA: [{ m: 60, b: 1 }, { m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }, { m: 60, b: 1 }],
      answer: 'same',
    };
    expect(phrasePitchRatios(flatRound, flatRound.phraseA)).toEqual([0.5, 0.5]);
  });

  it('renders visual note cues and placeholders during listenA', () => {
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(screen.getByTestId('melody-notes-0')).toBeTruthy();
    expect(screen.getByTestId('melody-0-note-0')).toBeTruthy();
    expect(screen.getByTestId('melody-0-note-1')).toBeTruthy();
    expect(screen.getByTestId('melody-0-note-2')).toBeTruthy();

    expect(screen.getByTestId('melody-notes-1')).toBeTruthy();
    expect(screen.getByTestId('melody-1-placeholder-0')).toBeTruthy();
    expect(screen.getByTestId('melody-1-placeholder-1')).toBeTruthy();
    expect(screen.getByTestId('melody-1-placeholder-2')).toBeTruthy();
  });

  it('supports muted playback with timed visual cues and active note highlights', async () => {
    vi.useFakeTimers();
    const sound = await import('../../sound');
    sound.setMuted(true);

    try {
      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

      // Phrase A stems must have strictly ascending heights representing pitch contour
      const stem0 = screen.getByTestId('melody-0-stem-0');
      const stem1 = screen.getByTestId('melody-0-stem-1');
      const stem2 = screen.getByTestId('melody-0-stem-2');
      expect(parseInt(stem0.style.height, 10)).toBeLessThan(parseInt(stem1.style.height, 10));
      expect(parseInt(stem1.style.height, 10)).toBeLessThan(parseInt(stem2.style.height, 10));

      // Phrase B starts with placeholders before playing
      expect(screen.getByTestId('melody-1-placeholder-0')).toBeTruthy();

      // At 450ms (400ms start + 50ms note 0 onset): note 0 is active, note 1 is not
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(screen.getByTestId('melody-0-dot-0-active')).toBeTruthy();
      expect(screen.queryByTestId('melody-0-dot-1-active')).toBeNull();
      expect(screen.getByTestId('melody-0-dot-1')).toBeTruthy();
      expect(screen.getByTestId('melody-0-note-0').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('melody-0-note-1').getAttribute('aria-selected')).toBe('false');

      // Advance 500ms to note 1: highlight moves from column 0 to column 1
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByTestId('melody-0-dot-0-active')).toBeNull();
      expect(screen.getByTestId('melody-0-dot-0')).toBeTruthy();
      expect(screen.getByTestId('melody-0-dot-1-active')).toBeTruthy();
      expect(screen.getByTestId('melody-0-note-0').getAttribute('aria-selected')).toBe('false');
      expect(screen.getByTestId('melody-0-note-1').getAttribute('aria-selected')).toBe('true');

      // Advance to phrase B note 0 onset (note 2 = 500ms, done = 500ms, gap = 600ms, note 0 = 50ms -> 1650ms)
      act(() => {
        vi.advanceTimersByTime(1650);
      });

      // During phrase B: note cues are rendered and note 0 is active
      expect(screen.getByTestId('melody-1-dot-0-active')).toBeTruthy();
      expect(screen.queryByTestId('melody-1-dot-1-active')).toBeNull();
      expect(screen.getByTestId('melody-1-note-0').getAttribute('aria-selected')).toBe('true');

      // Advance through remaining phrase B notes to pick phase (1500ms)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByTestId('samediff-same')).toBeTruthy();
      expect(screen.getByTestId('samediff-diff')).toBeTruthy();
    } finally {
      sound.setMuted(false);
      vi.useRealTimers();
    }
  });
});

