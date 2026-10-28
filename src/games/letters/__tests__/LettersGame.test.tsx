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
import { LangContext } from "../../../components/GameShell";
import { t } from "../../../i18n";
import { Lang } from "../../../lang";
import * as logic from "../logic";
import { KANA_POOL } from "../logic";
import { sfx, say } from "../../../sound";

vi.mock("../../../sound", () => ({
  say: vi.fn(),
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
    expect(makeRoundSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
  });

  it("locks input during wrong-tap feedback and ignores further taps for 450ms", () => {
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

      // Attempting to tap the correct tile while wrong feedback is active is ignored
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).not.toHaveBeenCalled();
      expect(screen.getByTestId("letters-score").textContent).toContain("0/8");

      // Fast-forward past the 450ms timeout
      act(() => {
        vi.advanceTimersByTime(450);
      });

      // Now tapping the correct tile works and advances the round
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
    } finally {
      vi.useRealTimers();
    }
  });

  it("unlocks input on new round so that the next round is playable", () => {
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
    const round1Answer = generatedRounds[0].tiles[generatedRounds[0].answerIdx];
    act(() => {
      fireEvent.click(screen.getByLabelText(round1Answer.label));
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("letters-score").textContent).toContain("1/8");
    expect(generatedRounds).toHaveLength(2);

    // Round 2 tile click works
    const round2Answer = generatedRounds[1].tiles[generatedRounds[1].answerIdx];
    act(() => {
      fireEvent.click(screen.getByLabelText(round2Answer.label));
    });

    expect(sfx.good).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("letters-score").textContent).toContain("2/8");
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

      // Advance timers by 250ms (reaching 450ms mark of the first timer while only 250ms into the second)
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Assert tapping correct Japanese tile is still ignored because first timer was cleared and second is still running
      const correctTile2 = round2.tiles.find((t) => t.isAnswer)!;
      const correctBtn2 = screen.getByLabelText(correctTile2.label);
      act(() => {
        fireEvent.click(correctBtn2);
      });
      expect(sfx.good).not.toHaveBeenCalled();

      // Advance remaining 200ms of the second timer
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Now tapping the correct Japanese tile should succeed
      act(() => {
        fireEvent.click(correctBtn2);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
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

      unmount();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
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
    expect(captionsToggle.textContent).toContain("ON");

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

    act(() => {
      fireEvent.click(correctBtn);
    });

    expect(screen.getByTestId("win-overlay")).toBeTruthy();

    const speakerBtn = screen.getByTestId("speaker-button");
    expect(speakerBtn.getAttribute("aria-disabled")).toBe("true");

    vi.mocked(say).mockClear();
    act(() => {
      fireEvent.click(speakerBtn);
    });

    expect(say).not.toHaveBeenCalled();
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
});
