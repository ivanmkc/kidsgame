// @vitest-environment happy-dom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { LangContext } from "../../components/GameShell";
import { Lang } from "../../lang";
import { t } from "../../i18n";
import * as music from "../../music";
import * as sound from "../../sound";
import { sfx } from "../../sound";
import * as highLowLogic from "./logic";
import { HighLowGame } from "./HighLowGame";

describe("HighLowGame UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders two melody dots during listen phase", () => {
    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(screen.getByTestId("melody-dot-0")).toBeDefined();
    expect(screen.getByTestId("melody-dot-1")).toBeDefined();
  });

  it("fills dots sequentially as notes play and transitions to pick phase", () => {
    vi.useFakeTimers();
    let onNoteCb: ((index: number) => void) | undefined;
    let onDoneCb: (() => void) | undefined;

    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, onNote, onDone) => {
        onNoteCb = onNote;
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance past initial 400ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const dot0 = screen.getByTestId("melody-dot-0");
    const dot1 = screen.getByTestId("melody-dot-1");

    // Before note callback: neither dot is filled
    const emptyClass = dot0.className;
    expect(dot1.className).toBe(emptyClass);

    // Note 0 begins playing: dot 0 fills, dot 1 remains empty
    act(() => {
      onNoteCb?.(0);
    });
    const dot0AfterNote0 = screen.getByTestId("melody-dot-0");
    const dot1AfterNote0 = screen.getByTestId("melody-dot-1");
    const filledClass = dot0AfterNote0.className;
    expect(filledClass).not.toBe(emptyClass);
    expect(dot1AfterNote0.className).toBe(emptyClass);

    // Note 1 begins playing: both dots are filled
    act(() => {
      onNoteCb?.(1);
    });
    const dot0AfterNote1 = screen.getByTestId("melody-dot-0");
    const dot1AfterNote1 = screen.getByTestId("melody-dot-1");
    expect(dot0AfterNote1.className).toBe(filledClass);
    expect(dot1AfterNote1.className).toBe(filledClass);

    // Sequence finishes: transitions to pick phase
    act(() => {
      onDoneCb?.();
    });

    expect(screen.queryByTestId("melody-dot-0")).toBeNull();
    expect(screen.queryByTestId("melody-dot-1")).toBeNull();
    expect(screen.getByTestId("highlow-high")).toBeDefined();
    expect(screen.getByTestId("highlow-low")).toBeDefined();

    // Replay returns to listen phase and resets melody dots to empty
    fireEvent.click(screen.getByTestId("highlow-replay"));
    const replayedDot0 = screen.getByTestId("melody-dot-0");
    const replayedDot1 = screen.getByTestId("melody-dot-1");
    expect(replayedDot0.className).toBe(emptyClass);
    expect(replayedDot1.className).toBe(emptyClass);

    vi.useRealTimers();
  });

  it("handles player picks and score updates", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, _onNote, onDone) => {
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const highBtn = screen.getByTestId("highlow-high");
    const lowBtn = screen.getByTestId("highlow-low");
    expect(highBtn).toBeDefined();
    expect(lowBtn).toBeDefined();

    fireEvent.click(highBtn);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    vi.useRealTimers();
  });

  it("delays transition to listen phase by 1000ms after a correct pick, keeping buttons mounted and locking input", () => {
    vi.useFakeTimers();
    let capturedNotes: { m: number; b: number }[] = [];
    let onDoneCb: (() => void) | undefined;

    const playSpy = vi
      .spyOn(music, "playSequence")
      .mockImplementation((notes, _bpm, _onNote, onDone) => {
        capturedNotes = notes as { m: number; b: number }[];
        onDoneCb = onDone;
        return () => {};
      });

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance initial 400ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    expect(playSpy).toHaveBeenCalledTimes(1);

    const isHigh = capturedNotes[1].m > capturedNotes[0].m;
    const correctBtn = screen.getByTestId(
      isHigh ? "highlow-high" : "highlow-low",
    );
    const wrongBtn = screen.getByTestId(
      isHigh ? "highlow-low" : "highlow-high",
    );

    // Tap correct answer
    fireEvent.click(correctBtn);

    // Pick buttons remain mounted immediately and score updates
    expect(screen.queryByTestId("highlow-high")).not.toBeNull();
    expect(screen.queryByTestId("highlow-low")).not.toBeNull();
    expect(screen.queryByTestId("melody-dot-0")).toBeNull();
    expect(screen.getByTestId("highlow-score").textContent).toContain("1/");

    // Halfway through celebration delay (500ms): buttons still mounted
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("highlow-high")).not.toBeNull();
    expect(screen.queryByTestId("highlow-low")).not.toBeNull();
    expect(screen.queryByTestId("melody-dot-0")).toBeNull();

    // Tapping during celebration delay is locked / ignored
    fireEvent.click(wrongBtn);
    fireEvent.click(screen.getByTestId("highlow-replay"));
    expect(screen.getByTestId("highlow-score").textContent).toContain("1/");

    // At 1000ms: celebration ends and transitions back to listen phase
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("highlow-high")).toBeNull();
    expect(screen.queryByTestId("highlow-low")).toBeNull();
    expect(screen.getByTestId("melody-dot-0")).not.toBeNull();

    // Next round audio plays after 400ms delay
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(playSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("does not show celebration sparkles before a pick or on wrong buttons across rounds", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    let latestNotes: { m: number; b: number }[] = [];
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        latestNotes = notes;
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance through the initial listen phase so pick buttons appear
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const highBtn = screen.getByTestId("highlow-high");
    const lowBtn = screen.getByTestId("highlow-low");

    // Before any user tap, neither button should contain celebration sparkles
    expect(within(highBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(lowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    const isHigh = latestNotes[1].m > latestNotes[0].m;
    const wrongBtn = isHigh ? lowBtn : highBtn;

    // Tap the wrong button first: still no celebration sparkles
    fireEvent.click(wrongBtn);
    expect(within(highBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(lowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    // Advance wrong timer (500ms) to trigger listen phase, instructional feedback, and replay
    act(() => {
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(3000);
      onDoneCb?.();
    });

    // Tap the correct button: only the correct button shows celebration sparkles
    const correctBtn = screen.getByTestId(
      isHigh ? "highlow-high" : "highlow-low",
    );
    const wrongBtnAgain = screen.getByTestId(
      isHigh ? "highlow-low" : "highlow-high",
    );
    fireEvent.click(correctBtn);
    expect(within(correctBtn).queryAllByText(/✨|⭐/).length).toBeGreaterThan(
      0,
    );
    expect(within(wrongBtnAgain).queryAllByText(/✨|⭐/)).toHaveLength(0);

    // Advance through celebration (1000ms) and next round listen phase (400ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    // In round 2 before any tap, neither button should show celebration sparkles
    const round2HighBtn = screen.getByTestId("highlow-high");
    const round2LowBtn = screen.getByTestId("highlow-low");
    expect(within(round2HighBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(round2LowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    vi.useRealTimers();
  });

  it("locks input on incorrect pick and ignores taps during the 500ms error flash", () => {
    vi.useFakeTimers();
    let latestNotes: music.SeqNote[] = [];
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        latestNotes = notes;
        onDoneCb = onDone;
        return () => {};
      },
    );
    const wrongSpy = vi.spyOn(sfx, "wrong");
    const goodSpy = vi.spyOn(sfx, "good");

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const isHigh = latestNotes[1].m > latestNotes[0].m;
    const correctBtn = screen.getByTestId(
      isHigh ? "highlow-high" : "highlow-low",
    );
    const wrongBtn = screen.getByTestId(
      isHigh ? "highlow-low" : "highlow-high",
    );

    // Tap wrong button
    fireEvent.click(wrongBtn);
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // Tapping alternate button immediately during the 500ms error flash is ignored
    fireEvent.click(correctBtn);
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("highlow-score").textContent).toBe("🎵 0/8");

    vi.useRealTimers();
  });

  it("triggers instructional visual cue, spoken feedback, and note sequence replay after 500ms wrong flash", () => {
    vi.useFakeTimers();
    let latestNotes: music.SeqNote[] = [];
    let onDoneCb: (() => void) | undefined;
    const playSpy = vi
      .spyOn(music, "playSequence")
      .mockImplementation((notes, _bpm, _onNote, onDone) => {
        latestNotes = notes;
        onDoneCb = onDone;
        return () => {};
      });
    const sayThenSpy = vi.spyOn(sound, "sayThen");

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Round 1 start
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    const isHigh = latestNotes[1].m > latestNotes[0].m;
    const wrongBtn = screen.getByTestId(
      isHigh ? "highlow-low" : "highlow-high",
    );
    const expectedDirection = isHigh ? "Higher" : "Lower";

    // Click wrong direction
    fireEvent.click(wrongBtn);

    // Buttons still visible during 500ms flash
    expect(screen.queryByTestId("highlow-high")).not.toBeNull();

    // Advance 500ms wrong timer to enter listen phase
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Instructional speech feedback is triggered
    expect(sayThenSpy).toHaveBeenCalledWith(
      [expectedDirection, "Listen..."],
      expect.any(Function),
      3000,
    );

    // Instructional visual cue is rendered
    const cue = screen.getByTestId("highlow-instructional-direction");
    expect(cue.textContent).toContain(expectedDirection);

    // Sequence replays after speech
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(playSpy).toHaveBeenCalledTimes(2);

    // Sequence finishes, returning to pick phase
    act(() => {
      onDoneCb?.();
    });

    // Pick phase restored, instructional cue removed, buttons ready
    expect(screen.queryByTestId("highlow-instructional-direction")).toBeNull();
    expect(screen.getByTestId("highlow-high")).toBeDefined();
    expect(screen.getByTestId("highlow-low")).toBeDefined();

    vi.useRealTimers();
  });

  it("gates score progression so fallback picks complete round with celebration but do not increment score", () => {
    vi.useFakeTimers();
    let latestNotes: music.SeqNote[] = [];
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        latestNotes = notes;
        onDoneCb = onDone;
        return () => {};
      },
    );
    const goodSpy = vi.spyOn(sfx, "good");

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const isHigh = latestNotes[1].m > latestNotes[0].m;
    const wrongBtn = screen.getByTestId(
      isHigh ? "highlow-low" : "highlow-high",
    );

    // Make a wrong pick on first try
    fireEvent.click(wrongBtn);

    // Advance past wrong flash, sayThen, and replay
    act(() => {
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(3000);
      onDoneCb?.();
    });

    // Tap the correct button on the second try
    const correctBtnAgain = screen.getByTestId(
      isHigh ? "highlow-high" : "highlow-low",
    );
    fireEvent.click(correctBtnAgain);

    // Celebration happens
    expect(goodSpy).toHaveBeenCalledTimes(1);

    // But score does NOT increment!
    expect(screen.getByTestId("highlow-score").textContent).toBe("🎵 0/8");

    // Advance celebration to load round 2
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    // In round 2, pick correctly on first try
    const isHighR2 = latestNotes[1].m > latestNotes[0].m;
    const correctBtnR2 = screen.getByTestId(
      isHighR2 ? "highlow-high" : "highlow-low",
    );
    fireEvent.click(correctBtnR2);

    // Score now increments to 1/8
    expect(screen.getByTestId("highlow-score").textContent).toBe("🎵 1/8");

    vi.useRealTimers();
  });

  it("scout repro: missing all rounds initially provides instructional feedback and finishes with 0 score rather than 8/8", () => {
    vi.useFakeTimers();
    let latestNotes: music.SeqNote[] = [];
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        latestNotes = notes;
        onDoneCb = onDone;
        return () => {};
      },
    );
    const wrongSpy = vi.spyOn(sfx, "wrong");
    const sayThenSpy = vi.spyOn(sound, "sayThen");

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let roundIdx = 0; roundIdx < 8; roundIdx++) {
      act(() => {
        vi.advanceTimersByTime(400);
        onDoneCb?.();
      });

      const isHigh = latestNotes[1].m > latestNotes[0].m;
      const wrongBtn = screen.getByTestId(
        isHigh ? "highlow-low" : "highlow-high",
      );

      wrongSpy.mockClear();
      sayThenSpy.mockClear();

      // Tap wrong button first
      fireEvent.click(wrongBtn);
      expect(wrongSpy).toHaveBeenCalledTimes(1);

      // Advance 500ms wrong flash + 3000ms sayThen cap + sequence replay
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(sayThenSpy).toHaveBeenCalledWith(
        [isHigh ? "Higher" : "Lower", "Listen..."],
        expect.any(Function),
        3000,
      );
      act(() => {
        vi.advanceTimersByTime(3000);
        onDoneCb?.();
      });

      // Tap correct button on second try
      const correctBtnAfterReplay = screen.getByTestId(
        isHigh ? "highlow-high" : "highlow-low",
      );
      fireEvent.click(correctBtnAfterReplay);

      // Score stays 0
      expect(screen.getByTestId("highlow-score").textContent).toBe("🎵 0/8");

      // Advance celebration
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    // WinOverlay is displayed and final score remains 0/8
    expect(screen.getByTestId("win-overlay")).toBeTruthy();
    expect(screen.getByTestId("highlow-score").textContent).toBe("🎵 0/8");

    vi.useRealTimers();
  });

  it("delays WinOverlay mount on final winning round by 1000ms celebration", () => {
    vi.useFakeTimers();
    let lastNotes: music.SeqNote[] = [];
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        lastNotes = notes;
        onDoneCb = onDone;
        return () => {};
      },
    );
    const goodSpy = vi.spyOn(sfx, "good");
    const winSpy = vi.spyOn(sfx, "win");

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Play 7 rounds to reach the final round (easy requires 8 rounds)
    for (let i = 0; i < 7; i++) {
      act(() => {
        vi.advanceTimersByTime(400);
        onDoneCb?.();
      });
      const answer = lastNotes[1].m > lastNotes[0].m ? "high" : "low";
      const btn = screen.getByTestId(
        answer === "high" ? "highlow-high" : "highlow-low",
      );
      fireEvent.click(btn);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    // Round 8: listen phase finishes, buttons ready
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });
    const finalAnswer = lastNotes[1].m > lastNotes[0].m ? "high" : "low";
    const winningBtn = screen.getByTestId(
      finalAnswer === "high" ? "highlow-high" : "highlow-low",
    );

    expect(screen.queryByTestId("win-overlay")).toBeNull();
    goodSpy.mockClear();
    winSpy.mockClear();

    // Tap winning answer
    fireEvent.click(winningBtn);

    // Immediate tick: sfx.good fires, celebration is active, but WinOverlay is deferred
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("highlow-high")).not.toBeNull();
    expect(screen.queryByTestId("highlow-low")).not.toBeNull();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // Taps during celebration are ignored
    fireEvent.click(winningBtn);
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

    // Reset via play-again hides WinOverlay and returns to listen phase
    fireEvent.click(screen.getByTestId("play-again"));
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    expect(screen.getByTestId("melody-dot-0")).toBeDefined();

    vi.useRealTimers();
  });
});

const noop = () => {};

function LangHarness({
  initialLang = "en",
}: {
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) =>
      l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
    );
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <HighLowGame onHome={noop} difficulty="easy" lang={lang} />
    </LangContext.Provider>
  );
}

describe("HighLowGame language switch safety", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("switches language mid-round and updates labels without resetting state or firing stale timers", () => {
    vi.useFakeTimers();
    let lastNotes: music.SeqNote[] = [];
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        lastNotes = notes;
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<LangHarness initialLang="en" />);

    // Advance to pick phase
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const highBtn = screen.getByTestId("highlow-high");
    expect(highBtn.textContent).toContain(t("en", "music.high" as never));
    const scoreChip = screen.getByTestId("highlow-score");
    const initialScore = scoreChip.textContent;

    // Cycle language
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // Labels should update to Japanese
    expect(highBtn.textContent).toContain(t("ja", "music.high" as never));
    
    // Score should not reset
    expect(screen.getByTestId("highlow-score").textContent).toBe(initialScore);

    // Advance timers to ensure no stale timeouts trigger
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Score is still the same, we are still in pick phase
    expect(screen.getByTestId("highlow-score").textContent).toBe(initialScore);
    expect(screen.getByTestId("highlow-high")).toBeDefined();

    const isHigh = lastNotes[1].m > lastNotes[0].m;
    const correctBtn = screen.getByTestId(
      isHigh ? "highlow-high" : "highlow-low",
    );
    fireEvent.click(correctBtn);

    // Check score updated
    expect(screen.getByTestId("highlow-score").textContent).not.toBe(initialScore);
  });
});

describe("HighLowGame melodic contour and relative direction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders directional indicators (↗️ / ↘️) and relative labels without bird/bear metaphors", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, _onNote, onDone) => {
        onDoneCb = onDone;
        return () => {};
      },
    );

    const { rerender } = render(
      <HighLowGame onHome={noop} difficulty="easy" lang="en" />,
    );

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const highBtn = screen.getByTestId("highlow-high");
    const lowBtn = screen.getByTestId("highlow-low");

    expect(highBtn.textContent).toContain("↗️");
    expect(highBtn.textContent).toContain("Higher");
    expect(highBtn.textContent).not.toContain("🐦");

    expect(lowBtn.textContent).toContain("↘️");
    expect(lowBtn.textContent).toContain("Lower");
    expect(lowBtn.textContent).not.toContain("🐻");

    // Japanese prompt and labels
    rerender(<HighLowGame onHome={noop} difficulty="easy" lang="ja" />);

    expect(
      screen.getByText("にばんめの おとは たかくなった？ ひくくなった？"),
    ).toBeDefined();
    expect(highBtn.textContent).toContain("たかくなった");
    expect(lowBtn.textContent).toContain("ひくくなった");
  });

  it("scores descending high soprano notes as Lower (↘️) and provides directional feedback", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, _onNote, onDone) => {
        onDoneCb = onDone;
        return () => {};
      },
    );
    const sayThenSpy = vi.spyOn(sound, "sayThen");
    vi.spyOn(highLowLogic, "makeHighLowRound").mockReturnValue({
      noteA: 69, // A4 (440Hz)
      noteB: 66, // F#4 (370Hz) - descended
    });

    render(<HighLowGame onHome={noop} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    // Child taps Higher (highlow-high), which is wrong because note descended
    fireEvent.click(screen.getByTestId("highlow-high"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Instructional cue and speech indicate melodic contour Lower (↘️), not bear
    const cue = screen.getByTestId("highlow-instructional-direction");
    expect(cue.textContent).toContain("↘️");
    expect(cue.textContent).toContain("Lower");
    expect(cue.textContent).not.toContain("🐻");
    expect(sayThenSpy).toHaveBeenCalledWith(
      ["Lower", "Listen..."],
      expect.any(Function),
      3000,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
      onDoneCb?.();
    });

    // Second try: child taps Lower (highlow-low) -> round succeeds
    fireEvent.click(screen.getByTestId("highlow-low"));
    expect(screen.queryByTestId("highlow-instructional-direction")).toBeNull();
  });

  it("scores ascending low bass notes as Higher (↗️) and provides directional feedback in Japanese", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, _onNote, onDone) => {
        onDoneCb = onDone;
        return () => {};
      },
    );
    const sayThenSpy = vi.spyOn(sound, "sayThen");
    vi.spyOn(highLowLogic, "makeHighLowRound").mockReturnValue({
      noteA: 54, // F#3 (185Hz)
      noteB: 61, // C#4 (277Hz) - ascended
    });

    render(<HighLowGame onHome={noop} difficulty="easy" lang="ja" />);

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    // Child taps low, which is wrong because note ascended
    fireEvent.click(screen.getByTestId("highlow-low"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Instructional cue and speech indicate melodic contour Higher (↗️ たかくなった)
    const cue = screen.getByTestId("highlow-instructional-direction");
    expect(cue.textContent).toContain("↗️");
    expect(cue.textContent).toContain("たかくなった");
    expect(cue.textContent).not.toContain("🐦");
    expect(sayThenSpy).toHaveBeenCalledWith(
      ["たかくなった", "きいてね…"],
      expect.any(Function),
      3000,
    );
  });
});
