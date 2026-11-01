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

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: height,
    configurable: true,
  });
  if (window.visualViewport) {
    Object.defineProperty(window.visualViewport, "width", {
      value: width,
      configurable: true,
    });
    Object.defineProperty(window.visualViewport, "height", {
      value: height,
      configurable: true,
    });
  }
  window.dispatchEvent(new Event("resize"));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sound.setMuted(false);
  setViewport(1024, 768);
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
  expect(saySpy).toHaveBeenCalledWith("ビートに あわせて タップ！");
  saySpy.mockClear();

  // After 1200ms (elapsed time for old timer), old interval was cancelled and round restarted
  act(() => {
    vi.advanceTimersByTime(1200);
  });
  expect(saySpy).not.toHaveBeenCalledWith("きみの ばん！");
  expect(saySpy).not.toHaveBeenCalledWith("Your turn!");

  // Advance remaining 1200ms to complete the restarted listen phase (2400ms = 4 beats)
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // Should speak "Your turn!" in Japanese, not English
  expect(saySpy).toHaveBeenCalledWith("きみの ばん！");
  expect(saySpy).not.toHaveBeenCalledWith("Your turn!");

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

it("restarts round and speaks new subtitle when language button is clicked mid-round", () => {
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

  // Round restarts: new subtitle is spoken in Japanese
  expect(saySpy).toHaveBeenCalledWith("ビートに あわせて タップ！");
  saySpy.mockClear();

  // Subtitle header updates to Japanese
  expect(screen.getByText("ビートに あわせて タップ！")).toBeTruthy();

  // Metronome has restarted from beat 0: dots reset to 1 filled, 3 empty
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);

  // Advance 1200ms (when the old interval would have fired if not cancelled)
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // Old interval was cleared: no speech fired yet, still in listen phase
  expect(saySpy).not.toHaveBeenCalledWith("Your turn!");
  expect(saySpy).not.toHaveBeenCalledWith("きみの ばん！");
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(3);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(1);

  // Advance remaining 1200ms (2400ms total after language switch)
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  // Restarted round enters tap phase and speaks in Japanese
  expect(saySpy).toHaveBeenCalledWith("きみの ばん！");
  expect(saySpy).not.toHaveBeenCalledWith("Your turn!");
  expect(screen.getByText("きみの ばん！")).toBeTruthy();

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

it("delays WinOverlay mount on final winning round by 1200ms without sfx collision", () => {
  vi.useFakeTimers();
  vi.spyOn(logic, "roundsToWin").mockReturnValue(1);
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });
  const goodSpy = vi.spyOn(sound.sfx, "good");
  const winSpy = vi.spyOn(sound.sfx, "win");

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Advance past listen phase (4 beats at 100 bpm = 2400ms)
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  const circle = screen.getByTestId("steadybeat-circle");

  // Wait 1-beat pause before first tap
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // Tap 8 times to pass the round
  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  // Advance time to reach exactly totalTime (5400ms elapsed + 500ms = 5900ms)
  act(() => {
    vi.advanceTimersByTime(500);
  });

  // Immediate evaluation tick: sfx.good fires, score increments, result stars show, but WinOverlay is deferred
  expect(goodSpy).toHaveBeenCalledTimes(1);
  expect(winSpy).not.toHaveBeenCalled();
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/1");
  expect(screen.queryAllByText("☆")).toHaveLength(0);
  expect(screen.queryByTestId("win-overlay")).toBeNull();

  // At 1199ms: WinOverlay has not mounted yet, stars are still visible, sfx.win has not fired
  act(() => {
    vi.advanceTimersByTime(1199);
  });
  expect(winSpy).not.toHaveBeenCalled();
  expect(screen.queryByTestId("win-overlay")).toBeNull();

  // At 1200ms: WinOverlay mounts and sfx.win fires without clashing with sfx.good
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(winSpy).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("win-overlay")).toBeTruthy();

  // Play again button arms after 600ms entrance animation
  act(() => {
    vi.advanceTimersByTime(600);
  });
  const playAgain = screen.getByTestId("play-again");
  act(() => {
    fireEvent.click(playAgain);
  });

  // Win overlay closes and new game starts
  expect(screen.queryByTestId("win-overlay")).toBeNull();
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("0/1");

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("clears win timeout on unmount during final round result phase", () => {
  vi.useFakeTimers();
  vi.spyOn(logic, "roundsToWin").mockReturnValue(1);
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });
  const winSpy = vi.spyOn(sound.sfx, "win");

  const { unmount } = render(
    <SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
  );

  // Advance past listen phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  const circle = screen.getByTestId("steadybeat-circle");
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

  // Advance time to reach exactly totalTime (5400ms elapsed + 500ms = 5900ms)
  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/1");
  expect(screen.queryByTestId("win-overlay")).toBeNull();

  unmount();

  // Advance past 1200ms win delay
  act(() => {
    vi.advanceTimersByTime(1200);
  });

  expect(winSpy).not.toHaveBeenCalled();

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("disables tap circle and ignores extra taps once all 8 beats are completed", () => {
  vi.useFakeTimers();
  const playDrumSpy = vi.spyOn(music, "playDrum");
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

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

  // Tap 8 times on each beat (every 600ms)
  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  // All 8 progress dots are filled and circle is disabled
  expect(screen.getAllByTestId("steadybeat-tap-dot-filled")).toHaveLength(8);
  expect(circle.getAttribute("aria-disabled")).toBe("true");

  // Drum was played 4 times in listen phase + 8 times for player taps = 12 times
  expect(playDrumSpy).toHaveBeenCalledTimes(12);

  // Extra taps during the remaining wait window before totalTime expires
  for (let i = 0; i < 5; i++) {
    act(() => {
      fireEvent.click(circle);
    });
  }

  // Extra taps should not play drum sound
  expect(playDrumSpy).toHaveBeenCalledTimes(12);

  // Advance past tap evaluation (totalTime: 9 * 600 + 500 = 5900ms)
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // Round is evaluated with exactly 8 hits and no penalty for extra taps
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");
  expect(screen.queryAllByText("☆")).toHaveLength(0);

  roundSpy.mockRestore();
  playDrumSpy.mockRestore();
  vi.useRealTimers();
});

it("evaluates canTap correctly across phases, tap counts, and won state", () => {
  const round: logic.SteadyBeatRound = { bpm: 100, beatsPerRound: 8 };
  expect(logic.canTap(round, 0, "tap", false)).toBe(true);
  expect(logic.canTap(round, 7, "tap", false)).toBe(true);
  expect(logic.canTap(round, 8, "tap", false)).toBe(false);
  expect(logic.canTap(round, 9, "tap", false)).toBe(false);
  expect(logic.canTap(round, 0, "listen", false)).toBe(false);
  expect(logic.canTap(round, 0, "result", false)).toBe(false);
  expect(logic.canTap(round, 0, "tap", true)).toBe(false);
});

it("scales down circle and gap on compact viewports", () => {
  const seLandscape = logic.steadyBeatLayout(375);
  expect(seLandscape.circleSize).toBe(140);
  expect(seLandscape.gap).toBe(14);

  const androidLandscape = logic.steadyBeatLayout(360);
  expect(androidLandscape.circleSize).toBe(140);
  expect(androidLandscape.gap).toBe(14);

  const compactLandscape = logic.steadyBeatLayout(320);
  expect(compactLandscape.circleSize).toBe(128);
  expect(compactLandscape.gap).toBe(10);
});

it("preserves 180px circle and 28px gap on portrait and tablet screens", () => {
  const portrait375 = logic.steadyBeatLayout(667);
  expect(portrait375.circleSize).toBe(180);
  expect(portrait375.gap).toBe(28);

  const portrait390 = logic.steadyBeatLayout(844);
  expect(portrait390.circleSize).toBe(180);
  expect(portrait390.gap).toBe(28);

  const tablet = logic.steadyBeatLayout(768);
  expect(tablet.circleSize).toBe(180);
  expect(tablet.gap).toBe(28);
});

it("fits total content height within compact mobile landscape viewports without clipping", () => {
  // GameShell header (74px) + root bottom padding (10px) = 84px chrome.
  // Status card (~60px), tap progress dots (~28px), circle (circleSize), and 2 vertical gaps.
  const heights = [320, 360, 375, 390, 414, 428];
  for (const h of heights) {
    const layout = logic.steadyBeatLayout(h);
    const totalHeight = 84 + 60 + 28 + layout.circleSize + layout.gap * 2;
    expect(totalHeight).toBeLessThanOrEqual(h);
  }
});

it("renders compact 140px circle and 14px gap on 667x375 landscape viewport", () => {
  setViewport(667, 375);
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  const circle = screen.getByTestId("steadybeat-circle");
  expect(circle.style.width).toBe("140px");
  expect(circle.style.height).toBe("140px");

  const board = screen.getByTestId("steadybeat-board");
  expect(board.style.gap).toBe("14px");
});

it("renders scaled 128px circle and 10px gap on 568x320 landscape viewport without clipping dots", () => {
  vi.useFakeTimers();
  setViewport(568, 320);

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Advance past 4-beat count-in to tap phase
  act(() => {
    vi.advanceTimersByTime(5000);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  expect(screen.getAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(8);

  const circle = screen.getByTestId("steadybeat-circle");
  expect(circle.style.width).toBe("128px");
  expect(circle.style.height).toBe("128px");

  const board = screen.getByTestId("steadybeat-board");
  expect(board.style.gap).toBe("10px");

  vi.useRealTimers();
});

it("renders all 8 tap progress dots in tap phase on compact landscape viewport without overflow", () => {
  vi.useFakeTimers();
  setViewport(667, 375);

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Advance past 4-beat count-in to tap phase
  act(() => {
    vi.advanceTimersByTime(5000);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  expect(screen.getAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(8);

  const circle = screen.getByTestId("steadybeat-circle");
  expect(circle.style.width).toBe("140px");
  expect(circle.style.height).toBe("140px");

  const board = screen.getByTestId("steadybeat-board");
  expect(board.style.gap).toBe("14px");

  vi.useRealTimers();
});

it("renders default 180px circle and 28px gap on standard viewport", () => {
  setViewport(1024, 768);
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  const circle = screen.getByTestId("steadybeat-circle");
  expect(circle.style.width).toBe("180px");
  expect(circle.style.height).toBe("180px");

  const board = screen.getByTestId("steadybeat-board");
  expect(board.style.gap).toBe("28px");
});



