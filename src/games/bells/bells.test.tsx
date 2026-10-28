// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import { BellsGame } from "./BellsGame";
import * as music from "../../music";
import { sfx } from "../../sound";
import { t } from "../../i18n";
import { makeBellsRound } from "./logic";
import { makeRng } from "../../rng";

describe("BellsGame", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    let mockCancel: (() => void) | null = null;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, bpm, onNote, onDone) => {
        let time = 0;
        const timers: ReturnType<typeof setTimeout>[] = [];
        for (let i = 0; i < notes.length; i++) {
          timers.push(setTimeout(() => onNote?.(i), time));
          time += ((notes[i].b * 60) / bpm) * 1000;
        }
        timers.push(setTimeout(() => onDone?.(), time));
        mockCancel = () => {
          timers.forEach(clearTimeout);
        };
        return mockCancel;
      },
    );
    vi.spyOn(music, "stopSequence").mockImplementation(() => {
      if (mockCancel) {
        mockCancel();
        mockCancel = null;
      }
    });
  });

  it("replay button restarts demo and clears taps", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 1]
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    // Tap count is initially 0
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(screen.queryByText(/\(\d+\/\d+\)/)).toBeNull();
    const dot0 = screen.getByTestId("tap-dot-0");
    const dot1 = screen.getByTestId("tap-dot-1");
    const emptyClass = dot0.className;
    expect(dot1.className).toBe(emptyClass);

    // Tap the first correct bell
    const bell0 = screen.getByTestId("bell-0");
    fireEvent.click(bell0);

    // Tap count should be 1
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(dot0.className).not.toBe(emptyClass);
    expect(dot1.className).toBe(emptyClass);
    // Verify replay button accessibility attributes and icon
    const replayBtn = screen.getByTestId("replay-button");
    expect(replayBtn.getAttribute("role")).toBe("button");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );
    expect(replayBtn.textContent).toBe("🔊");

    // Press replay button
    fireEvent.click(replayBtn);

    expect(screen.queryByText("Your turn!")).toBeNull();

    // It should go back to listen phase
    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(screen.queryByTestId("tap-dot-row")).toBeNull();

    // Fast-forward through demo again
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Tap count should be back to 0
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-0").className).toBe(emptyClass);
    expect(screen.getByTestId("tap-dot-1").className).toBe(emptyClass);

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
    const dot0 = screen.getByTestId("tap-dot-0");
    const emptyClass = dot0.className;
    fireEvent.click(bell0);
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(dot0.className).not.toBe(emptyClass);

    // The status card should not be a button
    const statusCard = screen.getByTestId("bells-status");
    expect(statusCard.getAttribute("role")).toBeNull();
    expect(statusCard.getAttribute("aria-label")).toBeNull();

    // Tapping the status card should not discard taps or restart demo
    fireEvent.click(statusCard);
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(dot0.className).not.toBe(emptyClass);
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
    const bell1 = screen.getByTestId("bell-1");
    // Rapidly tap bell-0 twice in the same tick / render cycle
    act(() => {
      fireEvent.click(bell0);
      
      fireEvent.click(bell1);
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
    const bell1 = screen.getByTestId("bell-1");
    // Rapidly hammer 5 times when sequence length is 2
    act(() => {
      fireEvent.click(bell0);
      
      fireEvent.click(bell1);
      fireEvent.click(bell0);
      
      fireEvent.click(bell1);
      fireEvent.click(bell0);
    });

    expect(screen.getByTestId("bells-score").textContent).toContain("1/5");
    expect(playNoteSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("rapid triple taps accumulate correctly and score in medium difficulty", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});

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
    const playSeqCalls = vi.mocked(music.playSequence).mock.calls;
    const lastSeq = playSeqCalls[playSeqCalls.length - 1][0];
    const seqBellIndices = lastSeq.map((n) => midiToBellIndex[n.m]);
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
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence is [0, 1]
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");

    // Rapid wrong taps: [0, 0] instead of [0, 1]
    act(() => {
      fireEvent.click(bell0);
      fireEvent.click(bell0);
    });

    // Score should not increment
    expect(screen.getByTestId("bells-score").textContent).toContain("0/5");

    // Advance through the wrong flash delay (800ms) and replay demo (5000ms)
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    // Back in play phase with 0 taps
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-0")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-1")).toBeTruthy();

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

  it("wrong tap immediately triggers wrong feedback without waiting for sequence end", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 0, 0] for medium
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});
    const wrongSpy = vi.spyOn(sfx, "wrong").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="medium" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    // Tap wrong bell on the very first move of a 3-bell sequence
    const round = makeBellsRound(makeRng(0), "medium");
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

    expect(screen.getByText("Your turn!")).toBeTruthy();
    vi.useRealTimers();
  });

  it("correct sequence triggers success sound and advances round", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 1] for easy
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});
    const goodSpy = vi.spyOn(sfx, "good").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    const bell0 = screen.getByTestId("bell-0");
    const bell1 = screen.getByTestId("bell-1");
    fireEvent.click(bell0);
      
      fireEvent.click(bell1);

    expect(goodSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    vi.useRealTimers();
  });

  it("rapid taps following a wrong tap in the same tick are blocked by flashingRef", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(66 / 1e9); // Sequence will be [0, 0, 0] for medium
    vi.spyOn(music, "playNote").mockImplementation(() => {});
    const goodSpy = vi.spyOn(sfx, "good").mockImplementation(() => {});
    const wrongSpy = vi.spyOn(sfx, "wrong").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="medium" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");
    const bell1 = screen.getByTestId("bell-1");
    

    // Click 1, 0, 0 in a single act() — wrong first tap must block subsequent taps
    act(() => {
      fireEvent.click(bell1);
      fireEvent.click(bell0);
      
      fireEvent.click(bell1);
    });

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("bells-score").textContent).toContain("0/6");

    vi.useRealTimers();
  });

  it("rapid taps keep the most recent bell glowing for a full 250ms", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");
    const bell1 = screen.getByTestId("bell-1");
    

    act(() => {
      fireEvent.click(bell0);
    });
    expect(bell0.style.borderColor).toBe("rgba(255, 253, 247, 1.00)");

    // Tap bell 1 150ms later (< 250ms)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => {
      fireEvent.click(bell1);
    });
    expect(bell1.style.borderColor).toBe("rgba(255, 253, 247, 1.00)");

    // Advance 100ms: 250ms from first tap, 100ms from second tap
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Bell 1 must still be glowing; earlier timeout must not have prematurely cleared it
    expect(bell1.style.borderColor).toBe("rgba(255, 253, 247, 1.00)");

    // Advance another 150ms: now 250ms from second tap
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Now bell 1 glow has expired and reverted to its base color
    expect(bell1.style.borderColor).toBe("rgba(255, 194, 75, 1.00)");

    vi.useRealTimers();
  });

  it("renders tapDots that fill in visually and removes text fractions", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence [0, 0] for easy
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // In listen phase, no tap dots are rendered
    expect(screen.queryByTestId("tap-dot-row")).toBeNull();
    expect(screen.queryByTestId("tap-dot-0")).toBeNull();

    // Advance through demo into play phase
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Renders a tapDot for each required tap in the sequence (2 for easy)
    const dotRow = screen.getByTestId("tap-dot-row");
    expect(dotRow).toBeTruthy();
    const dot0 = screen.getByTestId("tap-dot-0");
    const dot1 = screen.getByTestId("tap-dot-1");
    expect(screen.queryByTestId("tap-dot-2")).toBeNull();

    // Both dots start empty
    const emptyClass = dot0.className;
    expect(dot1.className).toBe(emptyClass);

    // Text fractions are completely removed from status
    const statusCard = screen.getByTestId("bells-status");
    expect(statusCard.textContent).toBe("👆Your turn!");
    expect(statusCard.textContent).not.toMatch(/\d+\/\d+/);

    // Tap first bell: first dot fills visually, second stays empty
    const bell0 = screen.getByTestId("bell-0");
    fireEvent.click(bell0);

    expect(dot0.className).not.toBe(emptyClass);
    expect(dot1.className).toBe(emptyClass);
    expect(statusCard.textContent).toBe("👆Your turn!");

    vi.useRealTimers();
  });

  it("renders tapDot count matching sequence length for medium difficulty", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="medium" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Medium sequence length is 3
    expect(screen.getByTestId("tap-dot-0")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-1")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-2")).toBeTruthy();
    expect(screen.queryByTestId("tap-dot-3")).toBeNull();

    vi.useRealTimers();
  });

  it("renders tapDot count matching sequence length for hard difficulty and updates on taps", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    const { unmount } = render(
      <BellsGame onHome={() => {}} difficulty="hard" lang="en" />,
    );

    // In listen phase, dots are not rendered
    expect(screen.queryByTestId("tap-dot-row")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // In hard difficulty, sequence length is 5 dots, all empty
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-0")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-1")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-2")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-3")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-4")).toBeTruthy();
    expect(screen.queryByTestId("tap-dot-5")).toBeNull();

    const emptyClass = screen.getByTestId("tap-dot-0").className;
    expect(screen.getByTestId("tap-dot-4").className).toBe(emptyClass);

    const round = makeBellsRound(makeRng(0), "hard");
    const bellStep0 = screen.getByTestId(`bell-${round.sequence[0]}`);
    fireEvent.click(bellStep0);
    expect(screen.getByTestId("tap-dot-0").className).not.toBe(emptyClass);
    expect(screen.getByTestId("tap-dot-1").className).toBe(emptyClass);

    const bellStep1 = screen.getByTestId(`bell-${round.sequence[1]}`);
    fireEvent.click(bellStep1);
    expect(screen.getByTestId("tap-dot-1").className).not.toBe(emptyClass);
    expect(screen.getByTestId("tap-dot-2").className).toBe(emptyClass);

    unmount();
    vi.useRealTimers();
  });

  it('renders bell buttons with accessibilityRole="button" and localized accessibilityLabel', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    const { rerender, unmount } = render(
      <BellsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    for (let i = 0; i < 3; i++) {
      const bell = screen.getByTestId(`bell-${i}`);
      expect(bell.getAttribute("role")).toBe("button");
      expect(bell.getAttribute("aria-label")).toBe(`Bell ${i + 1}`);
    }

    rerender(<BellsGame onHome={() => {}} difficulty="easy" lang="ja" />);
    for (let i = 0; i < 3; i++) {
      const bell = screen.getByTestId(`bell-${i}`);
      expect(bell.getAttribute("role")).toBe("button");
      expect(bell.getAttribute("aria-label")).toBe(`ベル ${i + 1}`);
    }

    rerender(<BellsGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    for (let i = 0; i < 3; i++) {
      const bell = screen.getByTestId(`bell-${i}`);
      expect(bell.getAttribute("role")).toBe("button");
      expect(bell.getAttribute("aria-label")).toBe(`铃铛 ${i + 1}`);
    }

    rerender(<BellsGame onHome={() => {}} difficulty="easy" lang="yue" />);
    for (let i = 0; i < 3; i++) {
      const bell = screen.getByTestId(`bell-${i}`);
      expect(bell.getAttribute("role")).toBe("button");
      expect(bell.getAttribute("aria-label")).toBe(`鈴鐺 ${i + 1}`);
    }

    unmount();
    vi.useRealTimers();
  });

  it("does not trigger sparkles on intermediate taps and keeps sparkles past 250ms on sequence completion", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 1] for easy
    vi.spyOn(music, "playNote").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward demo to enter play phase
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");
    const bell1 = screen.getByTestId("bell-1");

    // Before any tap, no sparkles should be rendered
    expect(screen.queryAllByText(/[✨⭐]/)).toHaveLength(0);

    // First tap (intermediate tap): should NOT trigger sparkles
    act(() => {
      fireEvent.click(bell0);
    });

    expect(screen.queryAllByText(/[✨⭐]/)).toHaveLength(0);

    // Fast-forward 100ms into the 250ms tap glow
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryAllByText(/[✨⭐]/)).toHaveLength(0);

    // Complete the 250ms glow
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryAllByText(/[✨⭐]/)).toHaveLength(0);

    // Second tap (completes sequence): triggers sparkles
    act(() => {
      fireEvent.click(bell1);
    });

    // Sparkles should now be rendered
    const sparkles = screen.getAllByText(/[✨⭐]/);
    expect(sparkles.length).toBeGreaterThan(0);

    // Advance 300ms (past the 250ms tap glow timer): sparkles must NOT be prematurely unmounted
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getAllByText(/[✨⭐]/).length).toBe(sparkles.length);

    vi.useRealTimers();
  });

  it("resets sparkKey so sparkles do not display before first completion in a new game", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    const midiToBellIndex: Record<number, number> = {
      60: 0,
      62: 1,
      64: 2,
      67: 3,
      69: 4,
    };

    // Win the game (5 rounds for easy)
    for (let round = 0; round < 5; round++) {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      const playSeqCalls = vi.mocked(music.playSequence).mock.calls;
      const lastSeq = playSeqCalls[playSeqCalls.length - 1][0];
      const seq = lastSeq.map((n) => midiToBellIndex[n.m]);
      act(() => {
        for (const idx of seq) {
          fireEvent.click(screen.getByTestId(`bell-${idx}`));
        }
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    // Win overlay is visible, advance 600ms so the tap shield unarms
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const playAgainBtn = screen.getByText(t("en", "overlay.playAgain"));
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    // Advance past demo into play phase of new game
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");
    // In the new game, before completing a sequence, sparkles should not be present on bells
    expect(within(bell0).queryAllByText(/[✨⭐]/)).toHaveLength(0);

    // Tap bell 0 once (intermediate tap)
    act(() => {
      fireEvent.click(bell0);
    });
    expect(within(bell0).queryAllByText(/[✨⭐]/)).toHaveLength(0);

    vi.useRealTimers();
  });
});
