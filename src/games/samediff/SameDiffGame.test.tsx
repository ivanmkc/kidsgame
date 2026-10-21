// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { SameDiffGame } from './SameDiffGame';
import * as samediffLogic from './logic';
import { phrasePitchRatios, SameDiffRound, makeSameDiffRound, roundsToWin, BASE_PHRASES } from './logic';
import { makeRng } from '../../rng';

describe('SameDiffGame UI', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('renders dots during listen phases', () => {
    const { container } = render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(container.textContent).not.toContain('1/2 🎵');
    expect(screen.getByTestId('melody-dot-0')).toBeTruthy();
    expect(screen.getByTestId('melody-dot-1')).toBeTruthy();
  });

  it("Different card renders with a warm orange border and text", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const diffButton = screen.getByTestId("samediff-diff");
    expect(diffButton.style.backgroundColor).toMatch(
      /rgba?\(254,\s*243,\s*232/,
    );
    expect(diffButton.style.borderTopColor).toMatch(/rgba?\(232,\s*155,\s*79/);

    // The text element is a child
    const diffText = screen.getByText("Different");
    expect(diffText.style.color).toMatch(/rgba?\(232,\s*155,\s*79/);

    vi.useRealTimers();
  });

  it('computes proportional pitch ratios in logic', () => {
    const roundSame: SameDiffRound = {
      phraseA: [{ m: 60, b: 1 }, { m: 64, b: 1 }, { m: 67, b: 1 }],
      phraseB: [{ m: 60, b: 1 }, { m: 64, b: 1 }, { m: 67, b: 1 }],
      answer: 'same',
      phraseIdx: 0,
    };
    const ratiosA = phrasePitchRatios(roundSame, roundSame.phraseA);
    const ratiosB = phrasePitchRatios(roundSame, roundSame.phraseB);
    expect(ratiosA).toEqual([0, 4 / 7, 1]);
    expect(ratiosB).toEqual(ratiosA);

    const roundDiff: SameDiffRound = {
      phraseA: [{ m: 60, b: 1 }, { m: 64, b: 1 }, { m: 67, b: 1 }],
      phraseB: [{ m: 60, b: 1 }, { m: 68, b: 1 }, { m: 67, b: 1 }],
      answer: 'different',
      phraseIdx: 0,
    };
    const diffRatiosA = phrasePitchRatios(roundDiff, roundDiff.phraseA);
    const diffRatiosB = phrasePitchRatios(roundDiff, roundDiff.phraseB);
    expect(diffRatiosA[1]).toBe(0.5); // (64 - 60) / 8
    expect(diffRatiosB[1]).toBe(1);   // (68 - 60) / 8

    const flatRound: SameDiffRound = {
      phraseA: [{ m: 60, b: 1 }, { m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }, { m: 60, b: 1 }],
      answer: 'same',
      phraseIdx: 0,
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
  it('locks buttons during round transition to prevent blind guessing while keeping visual cues', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const sameBtn = screen.getByTestId('samediff-same');
    const diffBtn = screen.getByTestId('samediff-diff');

    act(() => {
      fireEvent.click(sameBtn);
    });
    if (screen.getByTestId('samediff-score').textContent?.includes('0/')) {
      act(() => {
        fireEvent.click(diffBtn);
      });
    }

    expect(screen.getByTestId('samediff-score').textContent).toContain('1/');

    // Pick buttons remain mounted during transition so visual cues play
    expect(screen.getByTestId('samediff-same')).toBeTruthy();
    expect(screen.getByTestId('samediff-diff')).toBeTruthy();

    // Spam clicks during the transition do not register additional guesses
    act(() => {
      fireEvent.click(sameBtn);
      fireEvent.click(diffBtn);
    });
    expect(screen.getByTestId('samediff-score').textContent).toContain('1/');

    // Advance through the transition delay and playback for round 2
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // In round 2, picks are unlocked and advance score
    const round2Same = screen.getByTestId('samediff-same');
    const round2Diff = screen.getByTestId('samediff-diff');
    act(() => {
      fireEvent.click(round2Same);
    });
    if (screen.getByTestId('samediff-score').textContent?.includes('1/')) {
      act(() => {
        fireEvent.click(round2Diff);
      });
    }
    expect(screen.getByTestId('samediff-score').textContent).toContain('2/');

    vi.useRealTimers();
  });

  it('resets game and unlocks picks when playing again', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let r = 0; r < 8; r++) {
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      const sameBtn = screen.getByTestId('samediff-same');
      const diffBtn = screen.getByTestId('samediff-diff');
      act(() => {
        fireEvent.click(sameBtn);
      });
      if (screen.getByTestId('samediff-score').textContent?.includes(`${r}/`)) {
        act(() => {
          fireEvent.click(diffBtn);
        });
      }
    }

    expect(screen.getByTestId('samediff-score').textContent).toContain('8/8');
    act(() => {
      vi.advanceTimersByTime(700);
    });

    const playAgainBtn = screen.getByTestId('play-again');
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    expect(screen.getByTestId('samediff-score').textContent).toContain('0/8');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('samediff-same')).toBeTruthy();
    expect(screen.getByTestId('samediff-diff')).toBeTruthy();

    vi.useRealTimers();
  });

  it('renders pick and replay buttons with accessibilityRole="button" and localized labels', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const sameBtn = screen.getByTestId('samediff-same');
    expect(sameBtn.getAttribute('role')).toBe('button');
    expect(sameBtn.getAttribute('aria-label')).toBe('Same');

    const diffBtn = screen.getByTestId('samediff-diff');
    expect(diffBtn.getAttribute('role')).toBe('button');
    expect(diffBtn.getAttribute('aria-label')).toBe('Different');

    const replayBtn = screen.getByTestId('samediff-replay');
    expect(replayBtn.getAttribute('role')).toBe('button');
    expect(replayBtn.getAttribute('aria-label')).toBe('🔊 Tap to hear again');

    vi.useRealTimers();
  });

  it('localizes accessibility labels when lang is ja', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="ja" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('samediff-same').getAttribute('aria-label')).toBe('おなじ');
    expect(screen.getByTestId('samediff-diff').getAttribute('aria-label')).toBe('ちがう');
    expect(screen.getByTestId('samediff-replay').getAttribute('aria-label')).toBe('🔊 タップでもういちど聞く');

    vi.useRealTimers();
  });

  it("updates language instantly mid-round without corrupting state", () => {
    vi.useFakeTimers();
    const { rerender } = render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Check English labels and prompt
    expect(screen.getByText("Same")).toBeTruthy();
    expect(screen.getByText("Different")).toBeTruthy();
    expect(screen.getByText("Same or Different")).toBeTruthy();
    expect(screen.getByText("Do the two melodies match?")).toBeTruthy();
    expect(screen.getByTestId("samediff-score").textContent).toMatch(/🎧 0\/\d+/);

    // Change language mid-round
    rerender(<SameDiffGame onHome={() => {}} difficulty="easy" lang="ja" />);

    // Check instantly updated to Japanese labels and prompt
    expect(screen.getByText("おなじ")).toBeTruthy();
    expect(screen.getByText("ちがう")).toBeTruthy();
    expect(screen.getByText("おなじ ちがう")).toBeTruthy();
    expect(screen.getByText("ふたつの メロディは おなじ？")).toBeTruthy();
    expect(screen.getByTestId("samediff-score").textContent).toMatch(/🎧 0\/\d+/);

    // Verify buttons are still present and we are still in pick phase
    expect(screen.getByTestId("samediff-same")).toBeTruthy();
    expect(screen.getByTestId("samediff-diff")).toBeTruthy();

    // Advance time to prove no stale timers or speech fire and corrupt the round
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("samediff-same")).toBeTruthy();
    expect(screen.getByTestId("samediff-diff")).toBeTruthy();

    vi.useRealTimers();
  });

  it('places replay button in its own row above choice buttons to prevent mobile overflow', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const replayBtn = screen.getByTestId('samediff-replay');
    const sameBtn = screen.getByTestId('samediff-same');
    const diffBtn = screen.getByTestId('samediff-diff');

    // Replay button is separated from the choice row into its own row above,
    // avoiding horizontal overflow on 360-375px mobile screens.
    const sameWrapper = sameBtn.parentElement as HTMLElement;
    const diffWrapper = diffBtn.parentElement as HTMLElement;
    const pickRow = sameWrapper.parentElement as HTMLElement;

    expect(pickRow).toBe(diffWrapper.parentElement);
    expect(pickRow.contains(replayBtn)).toBe(false);
    expect(replayBtn.parentElement?.contains(pickRow)).toBe(true);

    vi.useRealTimers();
  });

  it('defines at least 12 ascending 3-note base phrases with pitch gaps >= 3', () => {
    expect(BASE_PHRASES.length).toBeGreaterThanOrEqual(12);
    for (const phrase of BASE_PHRASES) {
      expect(phrase).toHaveLength(3);
      expect(phrase[0].m).toBeLessThan(phrase[1].m);
      expect(phrase[1].m).toBeLessThan(phrase[2].m);
      expect(phrase[1].m - phrase[0].m).toBeGreaterThanOrEqual(3);
      expect(phrase[2].m - phrase[1].m).toBeGreaterThanOrEqual(3);
    }
  });

  it('never repeats base phrases back-to-back and provides variety across rounds', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 1; seed <= 50; seed++) {
        const rng = makeRng(seed);
        const history: number[] = [];
        const total = roundsToWin(d);
        for (let r = 0; r < total; r++) {
          const round = makeSameDiffRound(rng, d, history);
          expect(round.phraseIdx).toBeDefined();
          if (history.length > 0) {
            expect(round.phraseIdx).not.toBe(history[history.length - 1]);
          }
          history.push(round.phraseIdx);
        }
        // Across the session (<= 12 rounds), all picked phrases are distinct
        expect(new Set(history).size).toBe(total);
      }
    }
  });

  it('cycles phrase pool when history spans all base phrases without back-to-back repeats', () => {
    const rng = makeRng(42);
    const fullHistory = Array.from({ length: BASE_PHRASES.length }, (_, i) => i);
    const lastPhrase = fullHistory[fullHistory.length - 1];
    const round = makeSameDiffRound(rng, 'easy', fullHistory);
    expect(round.phraseIdx).toBeDefined();
    expect(round.phraseIdx).not.toBe(lastPhrase);
  });

  it('threads historyRef across rounds and resets after Play Again', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(samediffLogic, 'makeSameDiffRound');

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Round 1 was created on mount: initial call has no history
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][2]).toBeUndefined();

    // Play through all 8 easy rounds
    for (let r = 0; r < 8; r++) {
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      const sameBtn = screen.getByTestId('samediff-same');
      const diffBtn = screen.getByTestId('samediff-diff');
      act(() => {
        fireEvent.click(sameBtn);
      });
      if (screen.getByTestId('samediff-score').textContent?.includes(`${r}/`)) {
        act(() => {
          fireEvent.click(diffBtn);
        });
      }
    }

    expect(screen.getByTestId('samediff-score').textContent).toContain('8/8');
    // Exactly 8 rounds were generated for the 8 rounds
    expect(spy).toHaveBeenCalledTimes(8);

    // Verify each round n received a history whose last entry is round n-1's phraseIdx,
    // and that each returned round has a phraseIdx different from the previous round
    for (let n = 1; n < 8; n++) {
      const prevResult = spy.mock.results[n - 1].value;
      const currResult = spy.mock.results[n].value;
      const passedHistory = spy.mock.calls[n][2];

      expect(passedHistory).toBeDefined();
      expect(passedHistory).toHaveLength(n);
      expect(passedHistory?.[passedHistory.length - 1]).toBe(prevResult.phraseIdx);
      expect(currResult.phraseIdx).not.toBe(prevResult.phraseIdx);
    }

    // Advance to win overlay and click Play Again
    act(() => {
      vi.advanceTimersByTime(700);
    });
    const playAgainBtn = screen.getByTestId('play-again');
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    // Reset generates round 1 of the new game without history (call 9)
    expect(spy).toHaveBeenCalledTimes(9);
    expect(screen.getByTestId('samediff-score').textContent).toContain('0/8');

    // Advance and win round 1 of the second game
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const round1Same = screen.getByTestId('samediff-same');
    const round1Diff = screen.getByTestId('samediff-diff');
    act(() => {
      fireEvent.click(round1Same);
    });
    if (screen.getByTestId('samediff-score').textContent?.includes('0/')) {
      act(() => {
        fireEvent.click(round1Diff);
      });
    }

    // Call 10 is round 2 of the second game: history passed must have length 1
    expect(spy).toHaveBeenCalledTimes(10);
    const round2History = spy.mock.calls[9][2];
    expect(round2History).toHaveLength(1);
    expect(round2History?.[0]).toBe(spy.mock.results[8].value.phraseIdx);
    expect(spy.mock.results[9].value.phraseIdx).not.toBe(spy.mock.results[8].value.phraseIdx);

    vi.useRealTimers();
  });
});


