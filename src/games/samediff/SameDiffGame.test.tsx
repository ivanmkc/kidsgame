// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  act,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { SameDiffGame } from "./SameDiffGame";
import * as logic from "./logic";
import {
  phrasePitchRatios,
  SameDiffRound,
  makeSameDiffRound,
  roundsToWin,
  BASE_PHRASES,
  speechLines,
  getInstructionalFeedback,
} from "./logic";
import { makeRng } from "../../rng";
import { sfx } from "../../sound";
import * as sound from "../../sound";
import * as music from "../../music";
import { LANGS } from "../../lang";
import { t } from "../../i18n";

describe("SameDiffGame UI", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("renders dots during listen phases", () => {
    const { container } = render(
      <SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(container.textContent).not.toContain("1/2 🎵");
    expect(screen.getByTestId("melody-dot-0")).toBeTruthy();
    expect(screen.getByTestId("melody-dot-1")).toBeTruthy();
  });

  it("Different card renders with a warm orange border and text", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(4200);
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

  it("Different choice button renders neutral comparison symbol 🔀 instead of negative 🙅", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const diffButton = screen.getByTestId("samediff-diff");
    expect(diffButton.textContent).toContain("🔀");
    expect(diffButton.textContent).not.toContain("🙅");

    vi.useRealTimers();
  });

  it("keeps visual scaffolding on screen during choice phase", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward through listenA and listenB to the pick phase
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    // Pick buttons are shown
    expect(screen.getByTestId("samediff-same")).toBeTruthy();

    // The visual notes should remain on screen
    expect(screen.getByTestId("melody-row-0")).toBeTruthy();
    expect(screen.getByTestId("melody-row-1")).toBeTruthy();

    vi.useRealTimers();
  });

  it("computes proportional pitch ratios in logic", () => {
    const roundSame: SameDiffRound = {
      phraseA: [
        { m: 60, b: 1 },
        { m: 64, b: 1 },
        { m: 67, b: 1 },
      ],
      phraseB: [
        { m: 60, b: 1 },
        { m: 64, b: 1 },
        { m: 67, b: 1 },
      ],
      answer: "same",
      phraseIdx: 0,
    };
    const ratiosA = phrasePitchRatios(roundSame, roundSame.phraseA);
    const ratiosB = phrasePitchRatios(roundSame, roundSame.phraseB);
    expect(ratiosA).toEqual([0, 4 / 7, 1]);
    expect(ratiosB).toEqual(ratiosA);

    const roundDiff: SameDiffRound = {
      phraseA: [
        { m: 60, b: 1 },
        { m: 64, b: 1 },
        { m: 67, b: 1 },
      ],
      phraseB: [
        { m: 60, b: 1 },
        { m: 68, b: 1 },
        { m: 67, b: 1 },
      ],
      answer: "different",
      phraseIdx: 0,
    };
    const diffRatiosA = phrasePitchRatios(roundDiff, roundDiff.phraseA);
    const diffRatiosB = phrasePitchRatios(roundDiff, roundDiff.phraseB);
    expect(diffRatiosA[1]).toBeCloseTo(4 / 7); // (64 - 60) / 7
    expect(diffRatiosB[1]).toBeCloseTo(8 / 7); // (68 - 60) / 7

    const flatRound: SameDiffRound = {
      phraseA: [
        { m: 60, b: 1 },
        { m: 60, b: 1 },
      ],
      phraseB: [
        { m: 60, b: 1 },
        { m: 60, b: 1 },
      ],
      answer: "same",
      phraseIdx: 0,
    };
    expect(phrasePitchRatios(flatRound, flatRound.phraseA)).toEqual([0.5, 0.5]);
  });

  it("ensures 1-semitone differences are visually distinct (at least 4px)", () => {
    vi.useFakeTimers();
    // Simulate a hard difficulty 1-semitone offset (span of 13 semitones)
    // C4 to C#5 (span = 13). Range: 60 to 73.
    const roundDiff: SameDiffRound = {
      phraseA: [
        { m: 60, b: 1 },
        { m: 65, b: 1 }, // Note 1
        { m: 73, b: 1 },
      ],
      phraseB: [
        { m: 60, b: 1 },
        { m: 66, b: 1 }, // Note 1 is 1 semitone higher
        { m: 73, b: 1 },
      ],
      answer: "different",
      phraseIdx: 0,
    };
    vi.spyOn(logic, "makeSameDiffRound").mockReturnValue(roundDiff);

    render(<SameDiffGame onHome={() => {}} difficulty="hard" lang="en" />);

    // Fast-forward through listenA to listenB/choice phase
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const stemA = screen.getByTestId("melody-0-stem-1");
    const stemB = screen.getByTestId("melody-1-stem-1");

    const heightA = parseInt(stemA.style.height as string, 10);
    const heightB = parseInt(stemB.style.height as string, 10);

    expect(Math.abs(heightA - heightB)).toBeGreaterThanOrEqual(4);

    vi.useRealTimers();
  });

  it("renders visual note cues and placeholders during listenA", () => {
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(screen.getByTestId("melody-notes-0")).toBeTruthy();
    expect(screen.getByTestId("melody-0-note-0")).toBeTruthy();
    expect(screen.getByTestId("melody-0-note-1")).toBeTruthy();
    expect(screen.getByTestId("melody-0-note-2")).toBeTruthy();

    expect(screen.getByTestId("melody-notes-1")).toBeTruthy();
    expect(screen.getByTestId("melody-1-placeholder-0")).toBeTruthy();
    expect(screen.getByTestId("melody-1-placeholder-1")).toBeTruthy();
    expect(screen.getByTestId("melody-1-placeholder-2")).toBeTruthy();
  });

  it("supports muted playback with timed visual cues and active note highlights", async () => {
    vi.useFakeTimers();
    const sound = await import("../../sound");
    sound.setMuted(true);

    try {
      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

      // Phrase A stems must have strictly ascending heights representing pitch contour
      const stem0 = screen.getByTestId("melody-0-stem-0");
      const stem1 = screen.getByTestId("melody-0-stem-1");
      const stem2 = screen.getByTestId("melody-0-stem-2");
      expect(parseInt(stem0.style.height, 10)).toBeLessThan(
        parseInt(stem1.style.height, 10),
      );
      expect(parseInt(stem1.style.height, 10)).toBeLessThan(
        parseInt(stem2.style.height, 10),
      );

      // Phrase B starts with placeholders before playing
      expect(screen.getByTestId("melody-1-placeholder-0")).toBeTruthy();

      // At 450ms (400ms start + 50ms note 0 onset): note 0 is active, note 1 is not
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(screen.getByTestId("melody-0-dot-0-active")).toBeTruthy();
      expect(screen.queryByTestId("melody-0-dot-1-active")).toBeNull();
      expect(screen.getByTestId("melody-0-dot-1")).toBeTruthy();
      expect(
        screen.getByTestId("melody-0-note-0").getAttribute("aria-selected"),
      ).toBe("true");
      expect(
        screen.getByTestId("melody-0-note-1").getAttribute("aria-selected"),
      ).toBe("false");

      // Advance 500ms to note 1: highlight moves from column 0 to column 1
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByTestId("melody-0-dot-0-active")).toBeNull();
      expect(screen.getByTestId("melody-0-dot-0")).toBeTruthy();
      expect(screen.getByTestId("melody-0-dot-1-active")).toBeTruthy();
      expect(
        screen.getByTestId("melody-0-note-0").getAttribute("aria-selected"),
      ).toBe("false");
      expect(
        screen.getByTestId("melody-0-note-1").getAttribute("aria-selected"),
      ).toBe("true");

      // Advance to phrase B note 0 onset (note 2 = 500ms, done = 500ms, gap = 600ms, note 0 = 50ms -> 1650ms)
      act(() => {
        vi.advanceTimersByTime(1650);
      });

      // During phrase B: note cues are rendered and note 0 is active
      expect(screen.getByTestId("melody-1-dot-0-active")).toBeTruthy();
      expect(screen.queryByTestId("melody-1-dot-1-active")).toBeNull();
      expect(
        screen.getByTestId("melody-1-note-0").getAttribute("aria-selected"),
      ).toBe("true");

      // Advance through remaining phrase B notes to pick phase (1500ms)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByTestId("samediff-same")).toBeTruthy();
      expect(screen.getByTestId("samediff-diff")).toBeTruthy();
    } finally {
      sound.setMuted(false);
      vi.useRealTimers();
    }
  });
  it("locks buttons during round transition to prevent blind guessing while keeping visual cues", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const sameBtn = screen.getByTestId("samediff-same");
    const diffBtn = screen.getByTestId("samediff-diff");

    act(() => {
      fireEvent.click(sameBtn);
    });
    let expectedScore = 1;
    if (screen.getByTestId("samediff-score").textContent?.includes("0/")) {
      expectedScore = 0;
      act(() => {
        vi.advanceTimersByTime(500);
        fireEvent.click(diffBtn);
      });
    }

    expect(screen.getByTestId("samediff-score").textContent).toContain(
      `${expectedScore}/`,
    );

    // Pick buttons remain mounted during transition so visual cues play
    expect(screen.getByTestId("samediff-same")).toBeTruthy();
    expect(screen.getByTestId("samediff-diff")).toBeTruthy();

    // Spam clicks during the transition do not register additional guesses
    act(() => {
      fireEvent.click(sameBtn);
      fireEvent.click(diffBtn);
    });
    expect(screen.getByTestId("samediff-score").textContent).toContain(
      `${expectedScore}/`,
    );

    // Advance through the transition delay and playback for round 2
    act(() => {
      vi.advanceTimersByTime(4800);
    });

    // In round 2, picks are unlocked and advance score
    const round2Same = screen.getByTestId("samediff-same");
    const round2Diff = screen.getByTestId("samediff-diff");
    act(() => {
      fireEvent.click(round2Same);
    });
    if (
      screen
        .getByTestId("samediff-score")
        .textContent?.includes(`${expectedScore}/`)
    ) {
      act(() => {
        vi.advanceTimersByTime(500);
        fireEvent.click(round2Diff);
      });
    } else {
      expectedScore++;
    }
    expect(screen.getByTestId("samediff-score").textContent).toContain(
      `${expectedScore}/`,
    );

    vi.useRealTimers();
  });

  it("resets game and unlocks picks when playing again", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    let currentScore = 0;
    for (let r = 0; r < 8; r++) {
      act(() => {
        vi.advanceTimersByTime(4800);
      });
      const sameBtn = screen.getByTestId("samediff-same");
      const diffBtn = screen.getByTestId("samediff-diff");
      act(() => {
        fireEvent.click(sameBtn);
      });
      if (
        screen
          .getByTestId("samediff-score")
          .textContent?.includes(`${currentScore}/`)
      ) {
        act(() => {
          vi.advanceTimersByTime(500);
          fireEvent.click(diffBtn);
        });
      } else {
        currentScore++;
      }
    }

    expect(screen.getByTestId("samediff-score").textContent).toContain(
      `${currentScore}/8`,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const playAgainBtn = screen.getByTestId("play-again");
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    expect(screen.getByTestId("samediff-score").textContent).toContain("0/8");
    // Listening card renders immediately upon reset rather than flashing unresponsive choice buttons
    expect(screen.getByTestId("melody-dot-0")).toBeTruthy();
    expect(screen.queryByTestId("samediff-same")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(screen.getByTestId("samediff-same")).toBeTruthy();
    expect(screen.getByTestId("samediff-diff")).toBeTruthy();

    vi.useRealTimers();
  });

  it('renders pick and replay buttons with accessibilityRole="button" and localized labels', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const sameBtn = screen.getByTestId("samediff-same");
    expect(sameBtn.getAttribute("role")).toBe("button");
    expect(sameBtn.getAttribute("aria-label")).toBe("Same");

    const diffBtn = screen.getByTestId("samediff-diff");
    expect(diffBtn.getAttribute("role")).toBe("button");
    expect(diffBtn.getAttribute("aria-label")).toBe("Different");

    const replayBtn = screen.getByTestId("samediff-replay");
    expect(replayBtn.getAttribute("role")).toBe("button");
    expect(replayBtn.getAttribute("aria-label")).toBe("🔊 Tap to hear again");

    vi.useRealTimers();
  });

  it("localizes accessibility labels when lang is ja", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="ja" />);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(screen.getByTestId("samediff-same").getAttribute("aria-label")).toBe(
      "おなじ",
    );
    expect(screen.getByTestId("samediff-diff").getAttribute("aria-label")).toBe(
      "ちがう",
    );
    expect(
      screen.getByTestId("samediff-replay").getAttribute("aria-label"),
    ).toBe("🔊 タップでもういちど聞く");

    vi.useRealTimers();
  });

  it("updates language instantly mid-round without corrupting state", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    // Check English labels and prompt
    expect(screen.getByText("Same")).toBeTruthy();
    expect(screen.getByText("Different")).toBeTruthy();
    expect(screen.getByText("Same or Different")).toBeTruthy();
    expect(screen.getByText("Do the two melodies match?")).toBeTruthy();
    expect(screen.getByTestId("samediff-score").textContent).toMatch(
      /🎧 0\/\d+/,
    );

    // Change language mid-round
    rerender(<SameDiffGame onHome={() => {}} difficulty="easy" lang="ja" />);

    // Check instantly updated to Japanese labels and prompt
    expect(screen.getByText("おなじ")).toBeTruthy();
    expect(screen.getByText("ちがう")).toBeTruthy();
    expect(screen.getByText("おなじ ちがう")).toBeTruthy();
    expect(screen.getByText("ふたつの メロディは おなじ？")).toBeTruthy();
    expect(screen.getByTestId("samediff-score").textContent).toMatch(
      /🎧 0\/\d+/,
    );

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

  it("places replay button in its own row above choice buttons to prevent mobile overflow", () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const replayBtn = screen.getByTestId("samediff-replay");
    const sameBtn = screen.getByTestId("samediff-same");
    const diffBtn = screen.getByTestId("samediff-diff");

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

  it("prevents fast-tap hammering on correct choice from queuing duplicate sounds and transitions", () => {
    vi.useFakeTimers();
    const goodSpy = vi.spyOn(sfx, "good").mockImplementation(() => {});
    const roundSame: SameDiffRound = {
      phraseIdx: 0,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }],
      answer: "same",
    };
    vi.spyOn(logic, "makeSameDiffRound").mockReturnValue(roundSame);

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance to pick phase
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const sameBtn = screen.getByTestId("samediff-same");

    // Rapidly hammer the correct button multiple times in the same tick
    act(() => {
      fireEvent.click(sameBtn);
      fireEvent.click(sameBtn);
      fireEvent.click(sameBtn);
    });

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("samediff-score").textContent).toContain("1/");

    // Advance past transition and playback into round 2
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    // Score remains 1, round 2 is active
    expect(screen.getByTestId("samediff-score").textContent).toContain("1/");

    vi.useRealTimers();
  });

  it("prevents fast-tap hammering on wrong choice from playing wrong sound multiple times while immediately accepting correct choice", () => {
    vi.useFakeTimers();
    const wrongSpy = vi.spyOn(sfx, "wrong").mockImplementation(() => {});
    const goodSpy = vi.spyOn(sfx, "good").mockImplementation(() => {});
    const roundSame: SameDiffRound = {
      phraseIdx: 0,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }],
      answer: "same",
    };
    vi.spyOn(logic, "makeSameDiffRound").mockReturnValue(roundSame);

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance to pick phase
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const diffBtn = screen.getByTestId("samediff-diff");
    const sameBtn = screen.getByTestId("samediff-same");

    // Rapidly hammer the wrong button multiple times
    act(() => {
      fireEvent.click(diffBtn);
      fireEvent.click(diffBtn);
      fireEvent.click(diffBtn);
    });

    // Wrong sound played exactly once
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // Tapping the same wrong choice again within 500ms is ignored
    act(() => {
      vi.advanceTimersByTime(200);
      fireEvent.click(diffBtn);
    });
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // Tapping the correct choice responds immediately without waiting for the 500ms timer
    act(() => {
      fireEvent.click(sameBtn);
    });
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("samediff-score").textContent).toContain("0/");

    vi.useRealTimers();
  });

  it("ignores rapid clicks on replay button while listening sequence is queued", () => {
    vi.useFakeTimers();
    const roundSame: SameDiffRound = {
      phraseIdx: 0,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }],
      answer: "same",
    };
    vi.spyOn(logic, "makeSameDiffRound").mockReturnValue(roundSame);

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const replayBtn = screen.getByTestId("samediff-replay");

    act(() => {
      fireEvent.click(replayBtn);
      fireEvent.click(replayBtn);
    });

    // Melodies play and return to pick phase cleanly
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(screen.getByTestId("samediff-same")).toBeTruthy();
    expect(screen.getByTestId("samediff-diff")).toBeTruthy();

    vi.useRealTimers();
  });

  it("defines at least 12 ascending 3-note base phrases with pitch gaps >= 3", () => {
    expect(BASE_PHRASES.length).toBeGreaterThanOrEqual(12);
    for (const phrase of BASE_PHRASES) {
      expect(phrase).toHaveLength(3);
      expect(phrase[0].m).toBeLessThan(phrase[1].m);
      expect(phrase[1].m).toBeLessThan(phrase[2].m);
      expect(phrase[1].m - phrase[0].m).toBeGreaterThanOrEqual(3);
      expect(phrase[2].m - phrase[1].m).toBeGreaterThanOrEqual(3);
    }
  });

  it("never repeats base phrases back-to-back and provides variety across rounds", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
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

  it("cycles phrase pool when history spans all base phrases without back-to-back repeats", () => {
    const rng = makeRng(42);
    const fullHistory = Array.from(
      { length: BASE_PHRASES.length },
      (_, i) => i,
    );
    const lastPhrase = fullHistory[fullHistory.length - 1];
    const round = makeSameDiffRound(rng, "easy", fullHistory);
    expect(round.phraseIdx).toBeDefined();
    expect(round.phraseIdx).not.toBe(lastPhrase);
  });

  it("threads historyRef across rounds and resets after Play Again", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(logic, "makeSameDiffRound");

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Round 1 was created on mount: initial call has no history
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][2]).toBeUndefined();

    let currentScore = 0;
    // Play through all 8 easy rounds
    for (let r = 0; r < 8; r++) {
      act(() => {
        vi.advanceTimersByTime(4800);
      });
      const sameBtn = screen.getByTestId("samediff-same");
      const diffBtn = screen.getByTestId("samediff-diff");
      act(() => {
        fireEvent.click(sameBtn);
      });
      if (
        screen
          .getByTestId("samediff-score")
          .textContent?.includes(`${currentScore}/`)
      ) {
        act(() => {
          vi.advanceTimersByTime(500);
          fireEvent.click(diffBtn);
        });
      } else {
        currentScore++;
      }
    }

    expect(screen.getByTestId("samediff-score").textContent).toContain(
      `${currentScore}/8`,
    );
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
      expect(passedHistory?.[passedHistory.length - 1]).toBe(
        prevResult.phraseIdx,
      );
      expect(currResult.phraseIdx).not.toBe(prevResult.phraseIdx);
    }

    // Advance to win overlay (1000ms win delay + 600ms arm delay) and click Play Again
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const playAgainBtn = screen.getByTestId("play-again");
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    // Reset generates round 1 of the new game without history (call 9)
    expect(spy).toHaveBeenCalledTimes(9);
    expect(screen.getByTestId("samediff-score").textContent).toContain("0/8");

    // Advance and win round 1 of the second game
    act(() => {
      vi.advanceTimersByTime(4200);
    });
    const round1Same = screen.getByTestId("samediff-same");
    const round1Diff = screen.getByTestId("samediff-diff");
    act(() => {
      fireEvent.click(round1Same);
    });
    if (screen.getByTestId("samediff-score").textContent?.includes("0/")) {
      act(() => {
        vi.advanceTimersByTime(500);
        fireEvent.click(round1Diff);
      });
    }

    // Call 10 is round 2 of the second game: history passed must have length 1
    expect(spy).toHaveBeenCalledTimes(10);
    const round2History = spy.mock.calls[9][2];
    expect(round2History).toHaveLength(1);
    expect(round2History?.[0]).toBe(spy.mock.results[8].value.phraseIdx);
    expect(spy.mock.results[9].value.phraseIdx).not.toBe(
      spy.mock.results[8].value.phraseIdx,
    );

    vi.useRealTimers();
  });

  it("does not trigger SparkleBurst on choice buttons before a tap and sparkles only the correct button on tap", () => {
    vi.useFakeTimers();
    const roundSame: SameDiffRound = {
      phraseIdx: 0,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }],
      answer: "same",
    };
    const roundDiff: SameDiffRound = {
      phraseIdx: 1,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 64, b: 1 }],
      answer: "different",
    };
    vi.spyOn(logic, "makeSameDiffRound")
      .mockReturnValueOnce(roundSame)
      .mockReturnValueOnce(roundDiff);

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance to pick phase
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const sameBtn = screen.getByTestId("samediff-same");
    const diffBtn = screen.getByTestId("samediff-diff");

    // Before any tap, neither button should contain sparkle emojis
    expect(sameBtn.textContent).toBe("👯Same");
    expect(diffBtn.textContent).toBe("🔀Different");

    // Wrong pick: tapping 'different' when answer is 'same'
    act(() => {
      fireEvent.click(diffBtn);
    });

    // Neither button should sparkle on wrong pick
    expect(sameBtn.textContent).toBe("👯Same");
    expect(diffBtn.textContent).toBe("🔀Different");

    // Wait for wrong penalty timer
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Correct pick: tapping 'same'
    act(() => {
      fireEvent.click(sameBtn);
    });

    // During transition, only the correct button has celebration sparkles
    expect(sameBtn.textContent).toContain("✨");
    expect(sameBtn.textContent).toContain("⭐");
    expect(diffBtn.textContent).toBe("🔀Different");

    // Advance to round 2 pick phase
    act(() => {
      vi.advanceTimersByTime(4800);
    });

    const r2SameBtn = screen.getByTestId("samediff-same");
    const r2DiffBtn = screen.getByTestId("samediff-diff");

    // In round 2 before tap, neither button should sparkle
    expect(r2SameBtn.textContent).toBe("👯Same");
    expect(r2DiffBtn.textContent).toBe("🔀Different");

    // Correct pick for round 2: tapping 'different'
    act(() => {
      fireEvent.click(r2DiffBtn);
    });

    // Only 'different' sparkles in round 2 transition
    expect(r2SameBtn.textContent).toBe("👯Same");
    expect(r2DiffBtn.textContent).toContain("✨");
    expect(r2DiffBtn.textContent).toContain("⭐");

    vi.useRealTimers();
  });

  it("delays round transition by 1000ms so 650ms sparkles finish without early unmount", () => {
    vi.useFakeTimers();
    const roundSame: SameDiffRound = {
      phraseIdx: 0,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }],
      answer: "same",
    };
    vi.spyOn(logic, "makeSameDiffRound")
      .mockReturnValueOnce(roundSame)
      .mockReturnValueOnce({ ...roundSame });

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance to pick phase
    act(() => {
      vi.advanceTimersByTime(4200);
    });

    const sameBtn = screen.getByTestId("samediff-same");
    act(() => {
      fireEvent.click(sameBtn);
    });

    // Celebration sparkles appear immediately on the tapped button
    expect(sameBtn.textContent).toContain("✨");

    // Advance 700ms: past the old 400ms cutoff and past SparkleBurst's 650ms duration
    act(() => {
      vi.advanceTimersByTime(700);
    });

    // The choice container and sparkles remain mounted through the full 650ms animation
    expect(screen.getByTestId("samediff-same")).toBeTruthy();
    expect(screen.getByTestId("melody-dot-0")).toBeTruthy();

    // Advance remaining 300ms to complete the 1000ms transition delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // At 1000ms, the next round's listening card mounts (it never unmounted, but choice container unmounts)
    expect(screen.queryByTestId("samediff-same")).toBeNull();
    expect(screen.getByTestId("melody-dot-0")).toBeTruthy();

    vi.useRealTimers();
  });

  it("delays win overlay by 1000ms after final correct pick so sparkles and sfx finish", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeSameDiffRound").mockImplementation(() => ({
      phraseIdx: 0,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }],
      answer: "same",
    }));
    const goodSpy = vi.spyOn(sfx, "good");
    const winSpy = vi.spyOn(sfx, "win");

    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Play 7 rounds to reach the final (8th) round on easy difficulty
    for (let r = 0; r < 7; r++) {
      act(() => {
        vi.advanceTimersByTime(4800);
      });
      fireEvent.click(screen.getByTestId("samediff-same"));
    }

    // Round 8: advance through listen phases to pick phase
    act(() => {
      vi.advanceTimersByTime(4800);
    });
    const finalBtn = screen.getByTestId("samediff-same");
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    goodSpy.mockClear();
    winSpy.mockClear();

    // Tap the winning answer
    fireEvent.click(finalBtn);

    // Immediate tick: sfx.good fires, celebration sparkles active, but WinOverlay is deferred
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(winSpy).not.toHaveBeenCalled();
    expect(finalBtn.textContent).toContain("✨");
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // Repeated taps during celebration are locked
    fireEvent.click(finalBtn);
    expect(goodSpy).toHaveBeenCalledTimes(1);

    // At 999ms: WinOverlay is still not mounted
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 1000ms: WinOverlay mounts and sfx.win fires
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(winSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("win-overlay")).toBeTruthy();

    // WinOverlay buttons arm after 600ms
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByTestId("play-again")).toBeTruthy();

    // Reset via play-again hides WinOverlay and resets round
    fireEvent.click(screen.getByTestId("play-again"));
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    expect(screen.getByTestId("samediff-score").textContent).toContain("0/8");

    vi.useRealTimers();
  });

  it("clears winTimer on unmount if unmounted during final round celebration", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeSameDiffRound").mockImplementation(() => ({
      phraseIdx: 0,
      phraseA: [{ m: 60, b: 1 }],
      phraseB: [{ m: 60, b: 1 }],
      answer: "same",
    }));
    const winSpy = vi.spyOn(sfx, "win");

    const { unmount } = render(
      <SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Play 7 rounds
    for (let r = 0; r < 7; r++) {
      act(() => {
        vi.advanceTimersByTime(4800);
      });
      fireEvent.click(screen.getByTestId("samediff-same"));
    }

    // Round 8: reach pick phase and tap winning answer
    act(() => {
      vi.advanceTimersByTime(4800);
    });
    fireEvent.click(screen.getByTestId("samediff-same"));

    // Unmount before 1000ms timer elapses
    unmount();

    // Advance past 1000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // sfx.win should never fire after unmount
    expect(winSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  describe("voice guidance and speechLines", () => {
    it("speechLines exports unique non-empty phrases spanning all four languages", () => {
      const lines = speechLines();
      expect(lines.length).toBeGreaterThan(0);
      expect(new Set(lines).size).toBe(lines.length);
      for (const l of LANGS) {
        expect(lines).toContain(t(l.id, "shell.samediff.sub"));
        expect(lines).toContain(t(l.id, "music.listen"));
        expect(lines).toContain(t(l.id, "music.same"));
        expect(lines).toContain(t(l.id, "music.different"));
      }
    });

    it("getInstructionalFeedback returns localized answer key in logic", () => {
      const roundSame: SameDiffRound = {
        phraseIdx: 0,
        phraseA: [{ m: 60, b: 1 }],
        phraseB: [{ m: 60, b: 1 }],
        answer: "same",
      };
      const roundDiff: SameDiffRound = {
        phraseIdx: 1,
        phraseA: [{ m: 60, b: 1 }],
        phraseB: [{ m: 64, b: 1 }],
        answer: "different",
      };
      for (const l of LANGS) {
        const fbSame = getInstructionalFeedback(roundSame, l.id);
        expect(fbSame).toEqual([t(l.id, "music.same")]);
        const fbDiff = getInstructionalFeedback(roundDiff, l.id);
        expect(fbDiff).toEqual([t(l.id, "music.different")]);

        const all = speechLines();
        for (const line of fbSame) expect(all).toContain(line);
        for (const line of fbDiff) expect(all).toContain(line);
      }
    });

    it("orders listen prompt before melody A using sayThen and starts melody only when narration completes", () => {
      vi.useFakeTimers();
      let sayThenDone: (() => void) | undefined;
      const sayThenSpy = vi
        .spyOn(sound, "sayThen")
        .mockImplementation((_texts, done) => {
          sayThenDone = done;
        });
      const playSpy = vi.spyOn(music, "playSequence").mockReturnValue(() => {});

      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

      // Advance mount delay (400ms) to trigger playRound
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // sayThen called with "Listen...", playSequence not yet called
      expect(sayThenSpy).toHaveBeenCalledWith(
        ["Listen..."],
        expect.any(Function),
        3000,
      );
      expect(playSpy).not.toHaveBeenCalled();

      // Complete narration
      act(() => {
        sayThenDone?.();
      });

      // playSequence is now invoked for melody A
      expect(playSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("speaks subtitle prompt and choices via saySequence in pick phase", () => {
      vi.useFakeTimers();
      const saySeqSpy = vi
        .spyOn(sound, "saySequence")
        .mockImplementation(() => {});

      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        vi.advanceTimersByTime(4200);
      });

      expect(saySeqSpy).toHaveBeenCalledWith([
        "Do the two melodies match?",
        "Same",
        "Different",
      ]);

      vi.useRealTimers();
    });

    it("speaks localized voice guidance in Japanese", () => {
      vi.useFakeTimers();
      const sayThenSpy = vi.spyOn(sound, "sayThen");
      const saySeqSpy = vi
        .spyOn(sound, "saySequence")
        .mockImplementation(() => {});

      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="ja" />);

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(sayThenSpy).toHaveBeenCalledWith(
        ["きいてね…"],
        expect.any(Function),
        3000,
      );

      act(() => {
        vi.advanceTimersByTime(3800);
      });

      expect(saySeqSpy).toHaveBeenCalledWith([
        "ふたつの メロディは おなじ？",
        "おなじ",
        "ちがう",
      ]);

      vi.useRealTimers();
    });

    it("speaks instructional feedback via saySequence on wrong choices", () => {
      vi.useFakeTimers();
      const saySeqSpy = vi
        .spyOn(sound, "saySequence")
        .mockImplementation(() => {});
      const stopNarrationSpy = vi
        .spyOn(sound, "stopNarration")
        .mockImplementation(() => {});
      const roundSame: SameDiffRound = {
        phraseIdx: 0,
        phraseA: [{ m: 60, b: 1 }],
        phraseB: [{ m: 60, b: 1 }],
        answer: "same",
      };
      vi.spyOn(logic, "makeSameDiffRound").mockReturnValue(roundSame);

      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        vi.advanceTimersByTime(4200);
      });

      saySeqSpy.mockClear();

      // Pick the wrong button ('different' when answer is 'same')
      const diffBtn = screen.getByTestId("samediff-diff");
      act(() => {
        fireEvent.click(diffBtn);
      });

      expect(stopNarrationSpy).toHaveBeenCalled();
      expect(saySeqSpy).toHaveBeenCalledWith(["Same"]);

      vi.useRealTimers();
    });

    it("marks the correct button with visual highlight on wrong pick in both unmuted and muted modes", () => {
      for (const muted of [false, true]) {
        vi.useFakeTimers();
        sound.setMuted(muted);
        try {
          const roundSame: SameDiffRound = {
            phraseIdx: 0,
            phraseA: [{ m: 60, b: 1 }],
            phraseB: [{ m: 60, b: 1 }],
            answer: "same",
          };
          vi.spyOn(logic, "makeSameDiffRound").mockReturnValue(roundSame);

          const { unmount } = render(
            <SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />,
          );

          act(() => {
            vi.advanceTimersByTime(muted ? 3000 : 4200);
          });

          const sameBtn = screen.getByTestId("samediff-same");
          const diffBtn = screen.getByTestId("samediff-diff");

          // Before tap: neither button has wrong or correct marks
          expect(sameBtn.getAttribute("aria-selected")).toBe("false");
          expect(diffBtn.getAttribute("aria-selected")).toBe("false");

          // Tap wrong button ("different")
          act(() => {
            fireEvent.click(diffBtn);
          });

          // Wrong button marked with red border
          expect(diffBtn.style.borderTopColor).toMatch(
            /rgba?\(232,\s*86,\s*79/,
          );
          // Correct button ("same") marked with correct highlight and aria-selected
          expect(sameBtn.getAttribute("aria-selected")).toBe("true");
          expect(sameBtn.style.borderTopWidth).toBe("6px");

          // After 500ms wrong cooldown, markings are cleared
          act(() => {
            vi.advanceTimersByTime(500);
          });

          expect(sameBtn.getAttribute("aria-selected")).toBe("false");
          expect(diffBtn.getAttribute("aria-selected")).toBe("false");
          expect(sameBtn.style.borderTopWidth).toBe("4px");

          unmount();
        } finally {
          sound.setMuted(false);
          vi.useRealTimers();
        }
      }
    });

    it("speaks on replay and stops previous narration on pick", () => {
      vi.useFakeTimers();
      const sayThenSpy = vi.spyOn(sound, "sayThen");
      const saySeqSpy = vi
        .spyOn(sound, "saySequence")
        .mockImplementation(() => {});
      const stopNarrationSpy = vi
        .spyOn(sound, "stopNarration")
        .mockImplementation(() => {});

      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        vi.advanceTimersByTime(4200);
      });

      sayThenSpy.mockClear();
      saySeqSpy.mockClear();
      stopNarrationSpy.mockClear();

      const replayBtn = screen.getByTestId("samediff-replay");
      act(() => {
        fireEvent.click(replayBtn);
      });

      expect(stopNarrationSpy).toHaveBeenCalled();
      expect(sayThenSpy).toHaveBeenCalledWith(
        ["Listen..."],
        expect.any(Function),
        3000,
      );

      act(() => {
        vi.advanceTimersByTime(4200);
      });

      expect(saySeqSpy).toHaveBeenCalledWith([
        "Do the two melodies match?",
        "Same",
        "Different",
      ]);

      vi.useRealTimers();
    });

    it("stops narration on unmount", () => {
      const stopNarrationSpy = vi
        .spyOn(sound, "stopNarration")
        .mockImplementation(() => {});
      const { unmount } = render(
        <SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      unmount();
      expect(stopNarrationSpy).toHaveBeenCalled();
    });

    it("increments roundEpochRef before stopNarration in playRound so pending sayThen does not trigger stale melody", () => {
      vi.useFakeTimers();
      let capturedPlayRound: (() => void) | undefined;
      const origSetTimeout = globalThis.setTimeout;
      vi.spyOn(globalThis, "setTimeout").mockImplementation(((
        fn: (...args: unknown[]) => void,
        ms?: number,
        ...args: unknown[]
      ) => {
        if (ms === 400 && !capturedPlayRound) {
          capturedPlayRound = fn as () => void;
        }
        return origSetTimeout(fn, ms, ...args);
      }) as typeof setTimeout);

      const playSpy = vi.spyOn(music, "playSequence").mockReturnValue(() => {});

      render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);

      // Advance mount delay (400ms) to trigger first playRound
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // sayThen called with "Listen...", playSequence not yet called
      expect(playSpy).not.toHaveBeenCalled();

      // Triggering playRound again while sayThen is pending must not launch stale melody
      act(() => {
        capturedPlayRound?.();
      });

      expect(playSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
