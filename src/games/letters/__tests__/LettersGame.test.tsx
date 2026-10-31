// @vitest-environment happy-dom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LettersGame } from "../LettersGame";
import { Animated } from "react-native";
import { LangContext } from "../../../components/GameShell";
import { t } from "../../../i18n";
import { Lang } from "../../../lang";
import * as logic from "../logic";
import { KANA_POOL } from "../logic";
import { sfx, say, stopNarration } from "../../../sound";

vi.mock("../../../sound", () => ({
  say: vi.fn(),
  stopNarration: vi.fn(),
  sfx: {
    good: vi.fn(),
    wrong: vi.fn(),
    tap: vi.fn(),
    win: vi.fn(),
  },
}));

describe("LettersGame", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("prevents fast-tap hammering from advancing the round and playing sound twice", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      const makeRoundSpy = vi
        .spyOn(logic, "makeLetterRound")
        .mockImplementation((rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        });

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      expect(makeRoundSpy).toHaveBeenCalledTimes(1);
      expect(sfx.good).not.toHaveBeenCalled();

      const round1 = generatedRounds[0];
      const correctLabel = round1.tiles[round1.answerIdx].label;
      const correctBtn = screen.getByLabelText(correctLabel);
      expect(correctBtn).toBeTruthy();

      act(() => {
        fireEvent.click(correctBtn);
        fireEvent.click(correctBtn);
      });

      expect(sfx.good).toHaveBeenCalledTimes(1);
      // Immediately on click: celebration delay is active, score advances immediately
      expect(makeRoundSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");

      // Advance through celebration delay
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(makeRoundSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows immediate tap of correct tile after wrong tile while ignoring repeated wrong taps", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];
      const wrongTile = round1.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn = screen.getByLabelText(wrongTile.label);
      const correctTile = round1.tiles[round1.answerIdx];
      const correctBtn = screen.getByLabelText(correctTile.label);

      // Fast-tap the wrong tile multiple times synchronously
      act(() => {
        fireEvent.click(wrongBtn);
        fireEvent.click(wrongBtn);
        fireEvent.click(wrongBtn);
      });

      expect(sfx.wrong).toHaveBeenCalledTimes(1);

      // Tapping the correct tile immediately succeeds without waiting for 450ms lockout
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");

      // Fast-forward past celebration delay
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
    } finally {
      vi.useRealTimers();
    }
  });

  it("unlocks input on new round so that the next round is playable", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      // Round 1
      const round1Answer =
        generatedRounds[0].tiles[generatedRounds[0].answerIdx];
      act(() => {
        fireEvent.click(screen.getByLabelText(round1Answer.label));
      });

      expect(sfx.good).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
      expect(generatedRounds).toHaveLength(2);

      // Round 2 tile click works
      const round2Answer =
        generatedRounds[1].tiles[generatedRounds[1].answerIdx];
      act(() => {
        fireEvent.click(screen.getByLabelText(round2Answer.label));
      });

      expect(sfx.good).toHaveBeenCalledTimes(2);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByTestId("letters-score").textContent).toContain("2/8");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides glyph by default, speaks from speaker button, and reveals after second miss", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];

      // The glyph should NOT be visible.
      expect(screen.queryByTestId("letters-glyph")).toBeNull();

      vi.mocked(say).mockClear();

      // Tap speaker button speaks the target
      act(() => {
        fireEvent.click(screen.getByTestId("speaker-button"));
      });
      expect(say).toHaveBeenCalledWith(round1.promptLine);

      // Tap wrong tile twice
      const wrongTile = round1.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn = screen.getByLabelText(wrongTile.label);

      act(() => {
        fireEvent.click(wrongBtn);
      });
      expect(screen.queryByTestId("letters-glyph")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(450);
      });

      act(() => {
        fireEvent.click(wrongBtn);
      });

      // Now the glyph should appear
      expect(screen.getByTestId("letters-glyph").textContent).toBe(
        round1.targetDisplay,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps revealed hint glyph visible throughout celebration delay after correct tap", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];
      const wrongTile = round1.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn = screen.getByLabelText(wrongTile.label);

      // Miss twice to reveal the hint glyph
      act(() => {
        fireEvent.click(wrongBtn);
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });
      act(() => {
        fireEvent.click(wrongBtn);
      });

      expect(screen.getByTestId("letters-glyph").textContent).toBe(
        round1.targetDisplay,
      );

      // Tap correct tile
      const correctTile = round1.tiles[round1.answerIdx];
      const correctBtn = screen.getByLabelText(correctTile.label);
      act(() => {
        fireEvent.click(correctBtn);
      });

      // 200ms into the 600ms celebration delay: round hasn't advanced, glyph remains visible
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(generatedRounds).toHaveLength(1);
      expect(screen.getByTestId("letters-glyph").textContent).toBe(
        round1.targetDisplay,
      );

      // Advance past remaining celebration delay (400ms more = 600ms total)
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(generatedRounds).toHaveLength(2);
      // New round begins with misses reset, so glyph is hidden
      expect(screen.queryByTestId("letters-glyph")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rebuilds the round and updates spoken prompt when language switches", () => {
    vi.useFakeTimers();
    try {
      function LettersGameTestWrapper() {
        const [lang, setLang] = React.useState<Lang>("en");
        const onCycle = () => {
          setLang((prev) => (prev === "en" ? "ja" : "en"));
        };
        return (
          <LangContext.Provider value={{ lang, onCycle }}>
            <LettersGame onHome={() => {}} difficulty="medium" lang={lang} />
          </LangContext.Provider>
        );
      }

      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGameTestWrapper />);

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      // Initial state in English: prompt is spoken, tiles are letters
      expect(screen.getByTestId(/^letters-prompt-/)).toBeTruthy();
      const initialTile0 = screen.getByTestId("letters-tile-0");
      expect(initialTile0.getAttribute("aria-label")).toMatch(/^[A-Za-z]$/);
      expect(say).toHaveBeenCalledTimes(1);
      expect(say).toHaveBeenLastCalledWith(
        expect.stringMatching(/^Find the letter [A-Za-z]!/),
      );
      expect(screen.getByTestId("letters-score").textContent).toBe("🔤 0/10");

      // Tap a wrong tile to start an error timer
      const round1 = generatedRounds[0];
      const wrongTile = round1.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn = screen.getByLabelText(wrongTile.label);
      act(() => {
        fireEvent.click(wrongBtn);
      });
      expect(sfx.wrong).toHaveBeenCalledTimes(1);
      expect(say).toHaveBeenCalledTimes(2);

      // Advance timers partially (200ms) before the 450ms error timer fires
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Trigger the language switch by firing a click on the 'lang-cycle' button
      act(() => {
        fireEvent.click(screen.getByTestId("lang-cycle"));
      });

      // Board should now be in Japanese kana mode, round counter agrees
      expect(screen.getByTestId(/^letters-prompt-/)).toBeTruthy();
      expect(screen.getByText("かなさがし")).toBeTruthy();
      expect(screen.getByTestId("letters-score").textContent).toBe("🈶 0/10");
      const jaTile0 = screen.getByTestId("letters-tile-0");
      const kanaSet = new Set(KANA_POOL.map((k) => k.kana));
      expect(kanaSet.has(jaTile0.getAttribute("aria-label")!)).toBe(true);
      expect(say).toHaveBeenCalledTimes(3);
      expect(say).toHaveBeenLastCalledWith(
        expect.stringMatching(/^「.」をさがして！/),
      );
      expect(screen.queryByTestId("letters-glyph")).toBeNull();

      // Tap a wrong tile in the new Japanese round
      const round2 = generatedRounds[1];
      const wrongTile2 = round2.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn2 = screen.getByLabelText(wrongTile2.label);
      act(() => {
        fireEvent.click(wrongBtn2);
      });
      expect(sfx.wrong).toHaveBeenCalledTimes(2);
      expect(say).toHaveBeenCalledTimes(4);

      // Repeated tap on the same wrong Japanese tile is ignored
      act(() => {
        fireEvent.click(wrongBtn2);
      });
      expect(sfx.wrong).toHaveBeenCalledTimes(2);

      // Tapping the correct Japanese tile succeeds immediately
      const correctTile2 = round2.tiles.find((t) => t.isAnswer)!;
      const correctBtn2 = screen.getByLabelText(correctTile2.label);
      act(() => {
        fireEvent.click(correctBtn2);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByTestId("letters-score").textContent).toBe("🈶 1/10");
      expect(say).toHaveBeenCalledTimes(5);

      // Switch back to English via the lang-cycle button
      act(() => {
        fireEvent.click(screen.getByTestId("lang-cycle"));
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByTestId(/^letters-prompt-/)).toBeTruthy();
      const enTile0 = screen.getByTestId("letters-tile-0");
      expect(enTile0.getAttribute("aria-label")).toMatch(/^[A-Za-z]$/);
      expect(say).toHaveBeenCalledTimes(6);
      expect(say).toHaveBeenLastCalledWith(
        expect.stringMatching(/^Find the letter [A-Za-z]!/),
      );
      expect(screen.getByTestId("letters-score").textContent).toBe("🔤 1/10");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears error timer on unmount", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = render(
        <LettersGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round = generatedRounds[0];
      const wrongTile = round.tiles.find((t) => !t.isAnswer)!;
      act(() => {
        fireEvent.click(screen.getByLabelText(wrongTile.label));
      });

      // The error timer is specifically the one started with a 450ms delay
      const callIdx = setTimeoutSpy.mock.calls.findLastIndex(
        (args) => args[1] === 450,
      );
      const timerId = setTimeoutSpy.mock.results[callIdx].value;

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops narration when unmounted so audio does not leak onto home screen", () => {
    const { unmount } = render(
      <LettersGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(stopNarration).not.toHaveBeenCalled();

    unmount();

    expect(stopNarration).toHaveBeenCalledTimes(1);
  });

  it("stops narration via useLangEpoch when language switches on win screen or mid-round", () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(logic, "settingsForLetters").mockReturnValue({
        rounds: 1,
        tiles: 6,
        tier: "upper",
      });

      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      const { rerender } = render(
        <LettersGame onHome={() => {}} difficulty="easy" lang="en" />,
      );

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];
      const correctTile = round1.tiles[round1.answerIdx];
      const correctBtn = screen.getByLabelText(correctTile.label);

      act(() => {
        fireEvent.click(correctBtn);
      });

      expect(screen.queryByTestId("win-overlay")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByTestId("win-overlay")).toBeTruthy();

      vi.mocked(stopNarration).mockClear();

      rerender(<LettersGame onHome={() => {}} difficulty="easy" lang="ja" />);

      expect(stopNarration).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows glyph immediately when captions toggle is turned ON", () => {
    const generatedRounds: logic.LetterRound[] = [];
    const origMakeLetterRound = logic.makeLetterRound;
    vi.spyOn(logic, "makeLetterRound").mockImplementation(
      (rng, tier, tileCount, avoidKey) => {
        const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
        generatedRounds.push(res);
        return res;
      },
    );

    render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Toggle captions ON
    const captionsToggle = screen.getByTestId("captions-toggle");
    act(() => {
      fireEvent.click(captionsToggle);
    });

    // Check that it shows ON

    act(() => {
      fireEvent.click(screen.getByTestId("play-button"));
    });

    // The glyph should be immediately visible because captions are ON
    const round1 = generatedRounds[0];
    expect(screen.getByTestId("letters-glyph").textContent).toBe(
      round1.targetDisplay,
    );
  });

  it("displays matching Kana Hunt title on Japanese start screen", () => {
    const { rerender } = render(
      <LettersGame onHome={() => {}} difficulty="easy" lang="ja" />,
    );

    // In Japanese (kana tier), both GameShell header and start screen central heading
    // should display 'かなさがし' (Kana Hunt), not 'もじさがし' (Letter Hunt).
    expect(screen.getAllByText("かなさがし")).toHaveLength(2);
    expect(screen.queryByText("もじさがし")).toBeNull();

    // In English, both header and start screen central heading display 'Letter Hunt'.
    rerender(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(screen.getAllByText("Letter Hunt")).toHaveLength(2);
    expect(screen.queryByText("かなさがし")).toBeNull();
  });

  it("disables speaker button and ignores taps when game is won", () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(logic, "settingsForLetters").mockReturnValue({
        rounds: 1,
        tiles: 6,
        tier: "upper",
      });

      let loopStop = vi.fn();
      const loopSpy = vi.spyOn(Animated, "loop").mockReturnValue({
        start: vi.fn(),
        stop: loopStop,
        reset: vi.fn(),
      });

      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];
      const correctTile = round1.tiles[round1.answerIdx];
      const correctBtn = screen.getByLabelText(correctTile.label);

      act(() => {
        fireEvent.click(correctBtn);
      });

      expect(screen.queryByTestId("win-overlay")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByTestId("win-overlay")).toBeTruthy();

      const speakerBtn = screen.getByTestId("speaker-button");
      expect(speakerBtn.getAttribute("aria-disabled")).toBe("true");

      // The pulse loop should be stopped when the game is won
      expect(loopStop).toHaveBeenCalled();

      vi.mocked(say).mockClear();
      act(() => {
        fireEvent.click(speakerBtn);
      });

      expect(say).not.toHaveBeenCalled();
      loopSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["en", "ja", "cmn", "yue"] as const)(
    "speaker button has localized accessibilityLabel for screen readers in %s",
    (locale) => {
      render(<LettersGame onHome={() => {}} difficulty="easy" lang={locale} />);
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });
      const expectedLabel = t(locale, "spell.hearAgain");
      const speakerBtn = screen.getByTestId("speaker-button");
      expect(speakerBtn.getAttribute("aria-label")).toBe(expectedLabel);
      expect(screen.getByLabelText(expectedLabel)).toBe(speakerBtn);
    },
  );

  it("renders Japanese Hard mode with 12 tiles in a 4x3 layout and 12 rounds", () => {
    render(<LettersGame onHome={() => {}} difficulty="hard" lang="ja" />);

    act(() => {
      fireEvent.click(screen.getByTestId("play-button"));
    });

    expect(screen.getByTestId("letters-score").textContent).toBe("🈶 0/12");
    for (let i = 0; i < 12; i++) {
      expect(screen.getByTestId(`letters-tile-${i}`)).toBeTruthy();
    }
  });

  it("resets round count and timer on difficulty change without jumping to win", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey, lang) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey, lang);
          generatedRounds.push(res);
          return res;
        },
      );

      const { rerender } = render(
        <LettersGame onHome={() => {}} difficulty="hard" lang="en" />,
      );

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      // Advance timer by 5 seconds on Hard
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("letters-timer").textContent).toBe("0:05");

      // Complete 9 rounds on Hard (out of 12)
      for (let r = 0; r < 9; r++) {
        const round = generatedRounds[r];
        const correctTile = round.tiles[round.answerIdx];
        act(() => {
          fireEvent.click(screen.getByLabelText(correctTile.label));
        });
        act(() => {
          vi.advanceTimersByTime(600);
        });
      }

      expect(screen.getByTestId("letters-score").textContent).toBe("👂 9/12");
      expect(sfx.win).not.toHaveBeenCalled();

      // Switch difficulty to Easy (which requires only 8 rounds to win)
      act(() => {
        rerender(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);
      });

      // Must not trigger instant win
      expect(sfx.win).not.toHaveBeenCalled();
      expect(screen.queryByTestId("win-overlay")).toBeNull();
      // Round progress resets to 0/8
      expect(screen.getByTestId("letters-score").textContent).toBe("🔤 0/8");

      // Switch to Medium (which has timer) to verify timer reset
      act(() => {
        rerender(<LettersGame onHome={() => {}} difficulty="medium" lang="en" />);
      });
      expect(screen.getByTestId("letters-score").textContent).toBe("🔤 0/10");
      expect(screen.getByTestId("letters-timer").textContent).toBe("0:00");
    } finally {
      vi.useRealTimers();
    }
  });

  it("speaks localized carrier phrase when playing alphabet hunt in Mandarin", () => {
    render(<LettersGame onHome={() => {}} difficulty="easy" lang="cmn" />);

    act(() => {
      fireEvent.click(screen.getByTestId("play-button"));
    });

    expect(say).toHaveBeenCalledWith(
      expect.stringMatching(/^找一找字母 [A-Za-z]！/),
    );
  });

  it("speaks localized carrier phrase when playing alphabet hunt in Cantonese", () => {
    render(<LettersGame onHome={() => {}} difficulty="easy" lang="yue" />);

    act(() => {
      fireEvent.click(screen.getByTestId("play-button"));
    });

    expect(say).toHaveBeenCalledWith(
      expect.stringMatching(/^搵一搵字母 [A-Za-z]！/),
    );
  });

  it("resets captions state to false when language changes", () => {
    const { rerender } = render(
      <LettersGame onHome={() => {}} difficulty="easy" lang="ja" />,
    );

    // Toggle captions ON in Japanese
    const captionsToggle = screen.getByTestId("captions-toggle");
    act(() => {
      fireEvent.click(captionsToggle);
    });

    act(() => {
      fireEvent.click(screen.getByTestId("play-button"));
    });

    // Glyph should be visible because captions are ON
    expect(screen.queryByTestId("letters-glyph")).toBeTruthy();

    // Change language to English
    rerender(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Because captions are reset to false on lang change, the glyph should no longer be shown immediately (since misses = 0)
    expect(screen.queryByTestId("letters-glyph")).toBeNull();
  });

  it("celebrates correct tile tap with SparkleBurst, locks input, and delays round advance by 600ms", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];
      const correctTile = round1.tiles[round1.answerIdx];
      const wrongTile = round1.tiles.find((t) => !t.isAnswer)!;
      const correctBtn = screen.getByLabelText(correctTile.label);
      const wrongBtn = screen.getByLabelText(wrongTile.label);

      // Before tap: no sparkles
      expect(correctBtn.textContent).not.toMatch(/✨|⭐/);

      // Tap correct tile
      act(() => {
        fireEvent.click(correctBtn);
      });

      expect(sfx.good).toHaveBeenCalledTimes(1);

      // Celebration active: SparkleBurst rendered on the correct tile
      expect(correctBtn.textContent).toMatch(/✨|⭐/);

      // Score advances immediately upon correct tap
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");

      // Tapping another tile during celebration is locked out
      act(() => {
        fireEvent.click(wrongBtn);
      });
      expect(sfx.wrong).not.toHaveBeenCalled();

      // At 599ms: still in celebration, round has not advanced yet
      act(() => {
        vi.advanceTimersByTime(599);
      });
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
      expect(generatedRounds).toHaveLength(1);

      // At 600ms: celebration finishes and round advances
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
      expect(generatedRounds).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("delays WinOverlay on final winning round until 600ms celebration completes", () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(logic, "settingsForLetters").mockReturnValue({
        rounds: 1,
        tiles: 6,
        tier: "upper",
      });

      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];
      const correctTile = round1.tiles[round1.answerIdx];
      const correctBtn = screen.getByLabelText(correctTile.label);

      // Tap winning tile
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);

      // WinOverlay is NOT visible immediately on tap
      expect(screen.queryByTestId("win-overlay")).toBeNull();
      expect(correctBtn.textContent).toMatch(/✨|⭐/);

      // Advance through celebration delay
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // WinOverlay is now visible
      expect(screen.getByTestId("win-overlay")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves round progress and resets round when language switches mid-celebration", () => {
    vi.useFakeTimers();
    try {
      function LettersGameTestWrapper() {
        const [lang, setLang] = React.useState<Lang>("en");
        const onCycle = () => {
          setLang((prev) => (prev === "en" ? "ja" : "en"));
        };
        return (
          <LangContext.Provider value={{ lang, onCycle }}>
            <LettersGame onHome={() => {}} difficulty="easy" lang={lang} />
          </LangContext.Provider>
        );
      }

      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<LettersGameTestWrapper />);
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round1 = generatedRounds[0];
      const correctTile = round1.tiles[round1.answerIdx];
      const correctBtn = screen.getByLabelText(correctTile.label);

      // Tap correct tile
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("letters-score").textContent).toBe("🔤 1/8");

      // Switch language 200ms into celebration
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        fireEvent.click(screen.getByTestId("lang-cycle"));
      });

      // Advance past remaining time of the old celebration timer
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Round should be reset for new language, earned round progress preserved (1/8)
      expect(screen.getByTestId("letters-score").textContent).toBe("🈶 1/8");

      // New Japanese round is playable and advances score
      const round2 = generatedRounds[1];
      const correctTile2 = round2.tiles[round2.answerIdx];
      const correctBtn2 = screen.getByLabelText(correctTile2.label);
      act(() => {
        fireEvent.click(correctBtn2);
      });
      expect(screen.getByTestId("letters-score").textContent).toBe("🈶 2/8");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears celebration timer on unmount", () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, "makeLetterRound").mockImplementation(
        (rng, tier, tileCount, avoidKey) => {
          const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
          generatedRounds.push(res);
          return res;
        },
      );
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = render(
        <LettersGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const round = generatedRounds[0];
      const correctTile = round.tiles[round.answerIdx];
      act(() => {
        fireEvent.click(screen.getByLabelText(correctTile.label));
      });

      // The celebration timer is started with a 600ms delay
      const callIdx = setTimeoutSpy.mock.calls.findLastIndex(
        (args) => args[1] === 600,
      );
      expect(callIdx).toBeGreaterThanOrEqual(0);
      const timerId = setTimeoutSpy.mock.results[callIdx].value;

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not produce negative tile dimensions on very small viewports", () => {
    const originalWidth = document.documentElement.clientWidth;
    const originalHeight = document.documentElement.clientHeight;

    try {
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 20,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 20,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

      act(() => {
        fireEvent.click(screen.getByTestId("play-button"));
      });

      const tile = screen.getByTestId("letters-tile-0");
      expect(parseFloat(tile.style.width)).toBeGreaterThanOrEqual(10);
      expect(parseFloat(tile.style.height)).toBeGreaterThanOrEqual(10);
    } finally {
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: originalWidth,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: originalHeight,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));
    }
  });
});
