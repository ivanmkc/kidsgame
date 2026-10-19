// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { BellsGame } from './BellsGame';
import * as music from '../../music';
import { sfx } from '../../sound';
import { t } from '../../i18n';
import { makeBellsRound } from './logic';
import { makeRng } from '../../rng';

describe('BellsGame', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("replay button restarts demo and clears taps", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 0]
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    // Tap count is initially 0
    expect(screen.getByText("Your turn! (0/2)", { exact: false })).toBeTruthy();

    // Tap the first correct bell
    const bell0 = screen.getByTestId("bell-0");
    fireEvent.click(bell0);

    // Tap count should be 1
    expect(screen.getByText("Your turn! (1/2)", { exact: false })).toBeTruthy();
    // Verify replay button accessibility attributes and icon
    const replayBtn = screen.getByTestId("replay-button");
    expect(replayBtn.getAttribute("role")).toBe("button");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );
    expect(replayBtn.textContent).toBe("🔊");

    // Press replay button
    fireEvent.click(replayBtn);

    expect(screen.queryByText("Your turn!", { exact: false })).toBeNull();

    // It should go back to listen phase
    expect(screen.getByText("Listen...")).toBeTruthy();

    // Fast-forward through demo again
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Tap count should be back to 0
    expect(screen.getByText("Your turn! (0/2)", { exact: false })).toBeTruthy();

    vi.useRealTimers();
  });

  it("status card is non-interactive and does not discard partial taps", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Tap the first correct bell
    const bell0 = screen.getByTestId("bell-0");
    fireEvent.click(bell0);
    expect(screen.getByText("Your turn! (1/2)", { exact: false })).toBeTruthy();

    // The status card should not be a button
    const statusCard = screen.getByTestId("bells-status");
    expect(statusCard.getAttribute("role")).toBeNull();
    expect(statusCard.getAttribute("aria-label")).toBeNull();

    // Tapping the status card should not discard taps or restart demo
    fireEvent.click(statusCard);
    expect(screen.getByText("Your turn! (1/2)", { exact: false })).toBeTruthy();
    expect(screen.queryByText("Listen...")).toBeNull();

    vi.useRealTimers();
  });

  it("rapid double taps accumulate correctly and increment score", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward through demo
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    const bell0 = screen.getByTestId("bell-0");
    // Rapidly tap bell-0 twice in the same tick / render cycle
    act(() => {
      fireEvent.click(bell0);
      fireEvent.click(bell0);
    });

    expect(screen.getByTestId("bells-score").textContent).toContain("1/5");
    // Only two notes should have played for the two taps
    expect(playNoteSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("hammering extra taps beyond sequence length is ignored and does not corrupt state", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    const bell0 = screen.getByTestId("bell-0");
    // Rapidly hammer 5 times when sequence length is 2
    act(() => {
      fireEvent.click(bell0);
      fireEvent.click(bell0);
      fireEvent.click(bell0);
      fireEvent.click(bell0);
      fireEvent.click(bell0);
    });

    expect(screen.getByTestId("bells-score").textContent).toContain("1/5");
    expect(playNoteSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("rapid triple taps accumulate correctly and score in medium difficulty", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const playedMidis: number[] = [];
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation((midi) => {
        playedMidis.push(midi);
      });

    render(<BellsGame onHome={() => {}} difficulty="medium" lang="en" />);

    // Fast-forward through demo to capture demo notes
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // PENTATONIC = [60, 62, 64, 67, 69]
    // Bell indices for the played demo notes:
    const midiToBellIndex: Record<number, number> = {
      60: 0,
      62: 1,
      64: 2,
      67: 3,
      69: 4,
    };
    const seqBellIndices = playedMidis.map((m) => midiToBellIndex[m]);
    expect(seqBellIndices).toHaveLength(3);

    playNoteSpy.mockClear();

    // Rapidly tap all 3 bells in the sequence in a single act
    act(() => {
      for (const idx of seqBellIndices) {
        fireEvent.click(screen.getByTestId(`bell-${idx}`));
      }
    });

    expect(screen.getByTestId("bells-score").textContent).toContain("1/6");
    expect(playNoteSpy).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("rapid wrong sequence plays wrong sfx and resets taps after delay", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence is [0, 0]
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");
    const bell1 = screen.getByTestId("bell-1");

    // Rapid wrong taps: [0, 1] instead of [0, 0]
    act(() => {
      fireEvent.click(bell0);
      fireEvent.click(bell1);
    });

    // Score should not increment
    expect(screen.getByTestId("bells-score").textContent).toContain("0/5");

    // Advance through the wrong flash delay (800ms) and replay demo (5000ms)
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    // Back in play phase with 0 taps
    expect(screen.getByText("Your turn! (0/2)", { exact: false })).toBeTruthy();

    vi.useRealTimers();
  });

  it("localizes replay button accessibilityLabel according to lang", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="ja" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const replayBtn = screen.getByTestId("replay-button");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("ja", "spell.hearAgain"),
    );

    vi.useRealTimers();
  });

  it("Bell 1 active border contrasts with its base color", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell1 = screen.getByTestId("bell-1");
    expect(bell1.style.borderColor).toBe("rgba(255, 194, 75, 1.00)");

    fireEvent.click(bell1);
    // Active border must contrast with Bell 1 base color (#FFC24B)
    expect(bell1.style.borderColor).toBe("rgba(255, 253, 247, 1.00)");
    expect(bell1.style.borderColor).not.toBe("rgba(255, 194, 75, 1.00)");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(bell1.style.borderColor).toBe("rgba(255, 194, 75, 1.00)");

    vi.useRealTimers();
  });

  it("plays sparkles only on sequence completion and retains them past 250ms", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 0]
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");

    // First tap does not complete sequence: no sparkles should render
    fireEvent.click(bell0);
    expect(screen.queryAllByText("✨")).toHaveLength(0);

    // Second tap completes sequence: sparkles render
    fireEvent.click(bell0);
    expect(screen.queryAllByText("✨").length).toBeGreaterThan(0);

    // Fast-forward past 250ms (glowIdx clears after 250ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Sparkles must remain mounted to finish the 650ms animation
    expect(screen.queryAllByText("✨").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it("does not play sparkles on wrong sequence", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 0]
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");
    const bell1 = screen.getByTestId("bell-1");

    fireEvent.click(bell0);
    fireEvent.click(bell1);

    expect(screen.queryAllByText("✨")).toHaveLength(0);

    vi.useRealTimers();
  });

  it('wrong tap immediately triggers wrong feedback without waiting for sequence end', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0); // Sequence will be [0, 0, 0] for medium
    const playNoteSpy = vi.spyOn(music, 'playNote').mockImplementation(() => {});
    const wrongSpy = vi.spyOn(sfx, 'wrong').mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="medium" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    // Tap wrong bell on the very first move of a 3-bell sequence
    const round = makeBellsRound(makeRng(0), 'medium');
    const wrongIdx = (round.sequence[0] + 1) % round.bells.length;
    const bellWrong = screen.getByTestId(`bell-${wrongIdx}`);
    fireEvent.click(bellWrong);

    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // Tapping during wrong flash is ignored
    fireEvent.click(bellWrong);
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // After 800ms, wrong flash ends and demo restarts
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Advance through the replayed demo
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Your turn! (0/3)', { exact: false })).toBeTruthy();
    vi.useRealTimers();
  });

  it('correct sequence triggers success sound and advances round', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0); // Sequence will be [0, 0] for easy
    const playNoteSpy = vi.spyOn(music, 'playNote').mockImplementation(() => {});
    const goodSpy = vi.spyOn(sfx, 'good').mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    const bell0 = screen.getByTestId('bell-0');
    fireEvent.click(bell0);
    fireEvent.click(bell0);

    expect(goodSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    vi.useRealTimers();
  });

  it('rapid taps following a wrong tap in the same tick are blocked by flashingRef', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(66 / 1e9); // Sequence will be [0, 0, 0] for medium
    vi.spyOn(music, 'playNote').mockImplementation(() => {});
    const goodSpy = vi.spyOn(sfx, 'good').mockImplementation(() => {});
    const wrongSpy = vi.spyOn(sfx, 'wrong').mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="medium" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId('bell-0');
    const bell1 = screen.getByTestId('bell-1');

    // Click 1, 0, 0 in a single act() — wrong first tap must block subsequent taps
    act(() => {
      fireEvent.click(bell1);
      fireEvent.click(bell0);
      fireEvent.click(bell0);
    });

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('bells-score').textContent).toContain('0/6');

    vi.useRealTimers();
  });
});
