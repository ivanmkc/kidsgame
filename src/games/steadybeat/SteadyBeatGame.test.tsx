// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import React, { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import * as sound from "../../sound";
import * as music from "../../music";
import { LangContext } from "../../components/GameShell";
import { Lang } from "../../lang";
import { SteadyBeatGame } from "./SteadyBeatGame";
import * as logic from "./logic";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sound.setMuted(false);
});
it("renders progress dots correctly during the tap phase", () => {
  vi.useFakeTimers();

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Should not have tap progress dots initially in the 'listen' phase
  expect(screen.queryAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(0);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);

  // Advance to tap phase
  act(() => {
    vi.advanceTimersByTime(5000);
  });

  // Listen dots should no longer be present in tap phase
  expect(screen.queryAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(
    0,
  );
  expect(screen.queryAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(
    0,
  );

  // Now the game is in 'tap' phase, there should be 8 dots, all empty
  expect(screen.getAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(8);
  expect(screen.queryAllByTestId("steadybeat-tap-dot-filled")).toHaveLength(0);

  const circle = screen.getByTestId("steadybeat-circle");

  act(() => {
    fireEvent.click(circle);
  });

  // After 1 tap, there should be 1 filled dot and 7 empty dots
  expect(screen.getAllByTestId("steadybeat-tap-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(7);

  vi.useRealTimers();
});

it("renders sequence-progress dots for listen phase that fill progressively", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Initially in listen phase at t = 0 (1st beat plays): 1 filled dot, 3 empty dots
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);

  // 100 bpm = 600ms per beat.
  // After 2nd beat (600ms): 2 dots filled, 2 empty
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(2);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(2);

  // After 3rd beat (1200ms total): 3 dots filled, 1 empty
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(3);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(1);

  // After 4th beat (1800ms total): all 4 dots filled for a full beat!
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(4);
  expect(screen.queryAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(
    0,
  );

  // After 4th beat period completes (2400ms total): transitions to tap phase
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.queryAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(
    0,
  );
  expect(screen.queryAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(
    0,
  );
  expect(screen.getByText("Your turn!")).toBeTruthy();

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("evaluates taps correctly and increments score when tapping on the beat", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // 4 metronome beats at 100 bpm (600ms per beat) = 2400ms to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  const circle = screen.getByTestId("steadybeat-circle");

  // Wait 1-beat pause before expecting the first tap
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // Tap 8 times on each beat (every 600ms, starting immediately when Your turn appears)
  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  // Advance time past totalTime (9 * 600 + 500 = 5900ms; currently elapsed in tap phase is 5400ms)
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // After evaluation, round is won and score is incremented
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");
  expect(screen.queryAllByText("☆")).toHaveLength(0);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("evaluates to 0 hits and does not increment score when no taps are made", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Advance past listen phase (4 metronome beats at 100 bpm = 2400ms)
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();

  // No taps made, advance past tap phase evaluation timer (9 * 600 + 500 = 5900ms)
  act(() => {
    vi.advanceTimersByTime(6000);
  });

  // Score should remain 0/4 and all 8 stars should be empty
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("0/4");
  expect(screen.getAllByText("☆")).toHaveLength(8);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("speaks instruction line on mount", () => {
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
  expect(saySpy).toHaveBeenCalledWith("Tap along with the beat!");
  saySpy.mockRestore();
});

it("speaks when entering tap phase", () => {
  vi.useFakeTimers();
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
  expect(saySpy).toHaveBeenCalledWith("Tap along with the beat!");
  saySpy.mockClear();

  act(() => {
    vi.advanceTimersByTime(5000);
  });

  expect(saySpy).toHaveBeenCalledWith("Your turn!");
  saySpy.mockRestore();
  vi.useRealTimers();
});

it("provides visual beat cues during listen phase when muted", () => {
  vi.useFakeTimers();
  sound.setMuted(true);
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Immediately on mount at 0ms (first beat): beat flashes visually
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Between beats (200ms): flash clears
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  // On the second beat (600ms): beat flashes visually again
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Between beats (800ms): flash clears
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  // On the third beat (1200ms): beat flashes visually again
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Between beats (1400ms): flash clears
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  // On the fourth beat (1800ms): beat flashes visually again
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Advance to tap phase (at 2400ms)
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getByText("Your turn!")).toBeTruthy();
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("renders tap circle with accessibilityRole button and localized label", () => {
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
  const circle = screen.getByTestId("steadybeat-circle");
  expect(circle.getAttribute("role")).toBe("button");
  expect(circle.getAttribute("aria-label")).toBe("Tap along with the beat!");
});

it("localizes tap circle accessibility label when lang is ja", () => {
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);
  const circle = screen.getByTestId("steadybeat-circle");
  expect(circle.getAttribute("aria-label")).toBe("ビートに あわせて タップ！");
});

it("speaks in the updated language when lang changes during listen phase", () => {
  vi.useFakeTimers();
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  const { rerender } = render(
    <SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
  );
  expect(saySpy).toHaveBeenCalledWith("Tap along with the beat!");
  saySpy.mockClear();

  // Advance partway through the listen phase (1200ms = 2 beats at 100 bpm)
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // Switch language to Japanese mid-listen
  rerender(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);

  // Metronome does not restart mid-round: count-in continues from beat 2
  // After remaining 1200ms (2400ms total from start), count-in finishes and enters tap phase
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // Should speak "Your turn!" in Japanese, not English
  expect(saySpy).toHaveBeenCalledWith("きみの ばん！");
  expect(saySpy).not.toHaveBeenCalledWith("Your turn!");
  expect(screen.getByText("きみの ばん！")).toBeTruthy();

  roundSpy.mockRestore();
  saySpy.mockRestore();
  vi.useRealTimers();
});

function LangHarness({ initialLang = "en" }: { initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) =>
      l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
    );
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <SteadyBeatGame onHome={() => {}} difficulty="easy" lang={lang} />
    </LangContext.Provider>
  );
}

it("does not restart metronome when language button is clicked mid-round and updates speech for tap phase", () => {
  vi.useFakeTimers();
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<LangHarness initialLang="en" />);

  // Mount speaks initial subtitle in English
  expect(saySpy).toHaveBeenCalledWith("Tap along with the beat!");
  saySpy.mockClear();

  // Initially in listen phase: 1 filled dot, 3 empty dots
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);

  // Advance 2 beats into the listen phase (1200ms at 100 bpm)
  act(() => {
    vi.advanceTimersByTime(1200);
  });
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(3);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(1);

  // Click the in-game language cycle button mid-round
  const langBtn = screen.getByTestId("lang-cycle");
  act(() => {
    fireEvent.click(langBtn);
  });

  // Subtitle header updates to Japanese in UI
  expect(screen.getByText("ビートに あわせて タップ！")).toBeTruthy();

  // Metronome has NOT restarted: dots are still 3 filled, 1 empty
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(3);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(1);

  // Advance remaining 1200ms (2400ms total) to complete the 4-beat count-in
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // Enters tap phase and speaks in Japanese
  expect(saySpy).toHaveBeenCalledWith("きみの ばん！");
  expect(saySpy).not.toHaveBeenCalledWith("Your turn!");
  expect(screen.getByText("きみの ばん！")).toBeTruthy();

  roundSpy.mockRestore();
  saySpy.mockRestore();
  vi.useRealTimers();
});

it("does not restart metronome during result phase and advances round when result ends", () => {
  vi.useFakeTimers();
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  const roundSpy = vi
    .spyOn(logic, "makeSteadyBeatRound")
    .mockImplementation(() => ({
      bpm: 100,
      beatsPerRound: 8,
    }));

  render(<LangHarness initialLang="en" />);

  // Mount generates initial round (call 1)
  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Advance past listen phase (2400ms at 100 bpm) to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();

  // Advance past tap phase evaluation timer (6000ms) to enter result phase
  act(() => {
    vi.advanceTimersByTime(6000);
  });

  // Result phase displays stars; transition timer scheduled for 1200ms
  expect(screen.getAllByText("☆")).toHaveLength(8);

  // Advance 500ms into the 1200ms result phase
  act(() => {
    vi.advanceTimersByTime(500);
  });

  // Round has not transitioned yet (still call 1)
  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Click language cycle button mid-result-phase
  const langBtn = screen.getByTestId("lang-cycle");
  act(() => {
    fireEvent.click(langBtn);
  });

  // Subtitle header updates to Japanese in UI
  expect(screen.getByText("ビートに あわせて タップ！")).toBeTruthy();

  // Metronome does NOT restart during result phase (still showing result stars, no listen dots)
  expect(screen.getAllByText("☆")).toHaveLength(8);
  expect(screen.queryAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(
    0,
  );

  // Round has not transitioned yet
  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Advance remaining 700ms (1200ms total after result phase began)
  act(() => {
    vi.advanceTimersByTime(700);
  });

  // Transition timer fires at the end of the 1200ms result phase and advances to next round
  expect(roundSpy).toHaveBeenCalledTimes(2);

  // New round starts in Japanese: new subtitle spoken and listen dots appear
  expect(saySpy).toHaveBeenCalledWith("ビートに あわせて タップ！");
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);

  roundSpy.mockRestore();
  saySpy.mockRestore();
  vi.useRealTimers();
});

it("advances to next round without double-scoring when language button is clicked during result phase after passed round", () => {
  vi.useFakeTimers();
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  const roundSpy = vi
    .spyOn(logic, "makeSteadyBeatRound")
    .mockImplementation(() => ({
      bpm: 100,
      beatsPerRound: 8,
    }));

  render(<LangHarness initialLang="en" />);

  // Mount generates initial round (call 1)
  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Advance past listen phase (2400ms) to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  const circle = screen.getByTestId("steadybeat-circle");

  // Wait 1-beat pause before expecting the first tap
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // Tap 8 times on each beat to pass the round
  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  // Advance past tap phase evaluation timer
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // Passed round: score increments to 1/4
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");

  // Advance 500ms into the 1200ms result phase
  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Click language cycle button mid-result-phase
  const langBtn = screen.getByTestId("lang-cycle");
  act(() => {
    fireEvent.click(langBtn);
  });

  // Metronome does NOT restart during result phase
  expect(screen.queryAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(
    0,
  );
  expect(roundSpy).toHaveBeenCalledTimes(1);
  // Score remains 1/4 (no double-scoring)
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");

  // Advance remaining 700ms (1200ms total after result phase began)
  act(() => {
    vi.advanceTimersByTime(700);
  });

  // Transition timer fires at the end of result phase and advances to next round
  expect(roundSpy).toHaveBeenCalledTimes(2);
  // Score is still 1/4 on start of next round
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");

  // Next round starts count-in in Japanese
  expect(saySpy).toHaveBeenCalledWith("ビートに あわせて タップ！");
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);

  roundSpy.mockRestore();
  saySpy.mockRestore();
  vi.useRealTimers();
});

it("clears round advance timeout on unmount during result phase", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  const { unmount } = render(
    <SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
  );

  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Advance past listen phase (2400ms) to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();

  // Advance past tap phase evaluation timer (5300ms) to enter result phase
  act(() => {
    vi.advanceTimersByTime(6000);
  });

  expect(screen.getAllByText("☆")).toHaveLength(8);

  unmount();

  act(() => {
    vi.advanceTimersByTime(1200);
  });

  expect(roundSpy).toHaveBeenCalledTimes(1);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("clears round advance timeout on unmount during result phase after passed round", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  const { unmount } = render(
    <SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
  );

  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Advance past listen phase (2400ms) to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  const circle = screen.getByTestId("steadybeat-circle");

  // Wait 1-beat pause before expecting the first tap
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // Tap 8 times on each beat to pass the round
  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  // Advance past tap phase evaluation timer (9 * 600 + 500 = 5900ms total tap time; 5400ms elapsed + 600ms = 6000ms)
  act(() => {
    vi.advanceTimersByTime(600);
  });

  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");

  unmount();

  act(() => {
    vi.advanceTimersByTime(1200);
  });

  expect(roundSpy).toHaveBeenCalledTimes(1);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("advances to next round after 1200ms result phase when round is passed", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Advance past listen phase (2400ms) to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  const circle = screen.getByTestId("steadybeat-circle");
  // Wait 1-beat pause before the first expected tap
  act(() => {
    vi.advanceTimersByTime(600);
  });

  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  // Advance past tap evaluation
  act(() => {
    vi.advanceTimersByTime(600);
  });

  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");

  // Advance past 1200ms result phase
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // Next round is generated and started
  expect(roundSpy).toHaveBeenCalledTimes(2);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("retries round after 1200ms result phase when round is failed", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  expect(roundSpy).toHaveBeenCalledTimes(1);

  // Advance past listen phase (2400ms) to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  // No taps, advance past tap phase evaluation timer (5300ms)
  act(() => {
    vi.advanceTimersByTime(6000);
  });

  expect(screen.getAllByText("☆")).toHaveLength(8);

  // Advance past 1200ms result phase
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // New round is generated for retry
  expect(roundSpy).toHaveBeenCalledTimes(2);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("plays exactly 4 drum beats during count-in and does not play a 5th beat at transition to tap phase", () => {
  vi.useFakeTimers();
  const playDrumSpy = vi.spyOn(music, "playDrum");
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // At t=0: 1st drum beat
  expect(playDrumSpy).toHaveBeenCalledTimes(1);

  // At t=600: 2nd drum beat
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(playDrumSpy).toHaveBeenCalledTimes(2);

  // At t=1200: 3rd drum beat
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(playDrumSpy).toHaveBeenCalledTimes(3);

  // At t=1800: 4th drum beat
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(playDrumSpy).toHaveBeenCalledTimes(4);

  // At t=2400: transition to tap phase ("Your turn!"), no 5th drum beat
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getByText("Your turn!")).toBeTruthy();
  expect(playDrumSpy).toHaveBeenCalledTimes(4);

  roundSpy.mockRestore();
  playDrumSpy.mockRestore();
  vi.useRealTimers();
});

it("scores all 8 hits when player taps along starting immediately on the downbeat when Your turn appears", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="hard" lang="en" />);

  // Advance past 4-beat count-in (2400ms at 100 bpm)
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  const circle = screen.getByTestId("steadybeat-circle");

  // Wait 1-beat pause before the first expected tap
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // Player taps immediately at 2400ms (downbeat), then 7 more times every 600ms
  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  // Advance past tap evaluation (5300ms)
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // All 8 taps on tempo starting on the downbeat are scored as hits
  expect(screen.queryAllByText("☆")).toHaveLength(0);
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/6");

  roundSpy.mockRestore();
  vi.useRealTimers();
});
