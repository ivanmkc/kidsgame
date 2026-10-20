// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { EchoBeatGame } from "./EchoBeatGame";
import * as logic from "./logic";
import type { EchoBeatRound } from "./logic";
import * as music from "../../music";
import * as sound from "../../sound";

function mockAudioContext() {
  const fakeCtx = {
    state: "running",
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createOscillator: () => ({
      type: "sine",
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBufferSource: () => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    resume: vi.fn().mockResolvedValue(undefined),
  };
  (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(
    function () {
      return fakeCtx;
    },
  );
}

describe("EchoBeatGame", () => {
  beforeEach(() => {
    mockAudioContext();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sound.setMuted(false);
  });

  it("plays demo and transitions to tap phase where drum can be tapped", () => {
    vi.useFakeTimers();

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(screen.getByText("Listen...")).toBeTruthy();
    const drum = screen.getByTestId("echobeat-drum");

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(screen.getByText("Your turn!")).toBeTruthy();

    act(() => {
      fireEvent.click(drum);
    });

    vi.useRealTimers();
  });

  it("plays demo visually when muted and transitions to tap phase", () => {
    vi.useFakeTimers();
    sound.setMuted(true);

    render(<EchoBeatGame onHome={() => {}} difficulty="medium" lang="en" />);

    expect(screen.getByText("Listen...")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(screen.getByText("Your turn!")).toBeTruthy();

    vi.useRealTimers();
  });

  it("locks drum input during celebration and retry so stray taps do not register", () => {
    vi.useFakeTimers();
    const round2Beat: EchoBeatRound = {
      bpm: 80,
      pattern: [{ duration: 2 }, { duration: 2 }],
      onsets: [0, 2],
      gaps: [1.5],
      hitCount: 2,
      totalBeats: 4,
    };
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      ...round2Beat,
    }));
    const playDrumSpy = vi.spyOn(music, "playDrum");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Wait for demo rhythm to finish playing (count-in + drum sequence)
    act(() => {
      vi.advanceTimersByTime(6050);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");

    // Tap drum twice (correct sequence for hitCount 2)
    act(() => {
      fireEvent.click(drum);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(2);

    // Celebration phase active immediately upon completion
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");

    // Stray taps during celebration should be dropped
    act(() => {
      fireEvent.click(drum);
      fireEvent.click(drum);
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(2);

    // Advance celebration timeout (800ms) to start round 2
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();

    // Advance past demo of round 2
    act(() => {
      vi.advanceTimersByTime(6050);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap once (missing second tap for hitCount 2)
    act(() => {
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(3);

    // Advance past grid deadline (4 beats = 3000ms + tolMs 300ms = 3300ms)
    act(() => {
      vi.advanceTimersByTime(3350);
    });

    // Retry phase active
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0);

    // Stray taps during retry timeout should be dropped
    act(() => {
      fireEvent.click(drum);
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(3);

    // Advance retry timeout (1000ms) to replay demo
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();

    vi.useRealTimers();
  });

  it("renders 4 beat dots corresponding to 4/4 bar", () => {
    vi.useFakeTimers();
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(screen.getByTestId("beat-dot-0")).toBeTruthy();
    expect(screen.getByTestId("beat-dot-1")).toBeTruthy();
    expect(screen.getByTestId("beat-dot-2")).toBeTruthy();
    expect(screen.getByTestId("beat-dot-3")).toBeTruthy();
    vi.useRealTimers();
  });

  it("disables drum during listen phase and ignores clicks", () => {
    vi.useFakeTimers();
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    const drum = screen.getByTestId("echobeat-drum");
    expect(drum.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(drum);
    expect(screen.queryByText("Your turn!")).toBeNull();
    vi.useRealTimers();
  });

  it("pulses beat dots continuously across listen and tap phases", () => {
    vi.useFakeTimers();
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // At 50ms: first beat fires, beat dot 0 is active
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("beat-dot-0").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByTestId("beat-dot-1").getAttribute("aria-selected")).toBe(
      "false",
    );

    // Advance 750ms (beat 1 at 80 bpm): beat dot 1 is active
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getByTestId("beat-dot-1").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByTestId("beat-dot-0").getAttribute("aria-selected")).toBe(
      "false",
    );

    // Advance into tap phase (total 8 beats = 6000ms + 50ms audio offset)
    act(() => {
      vi.advanceTimersByTime(5250);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();
    // Beat 8 (8 % 4 = 0): dot 0 is active on the downbeat of the tap phase!
    expect(screen.getByTestId("beat-dot-0").getAttribute("aria-selected")).toBe(
      "true",
    );

    // In tap phase, beat dots continue pulsing on the established tempo grid
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getByTestId("beat-dot-1").getAttribute("aria-selected")).toBe(
      "true",
    );

    vi.useRealTimers();
  });

  it("unlocks drum before downbeat so anticipatory taps within tolerance are accepted", () => {
    vi.useFakeTimers();
    const round2Beat: EchoBeatRound = {
      bpm: 80,
      pattern: [{ duration: 2 }, { duration: 2 }],
      onsets: [0, 2],
      gaps: [1.5],
      hitCount: 2,
      totalBeats: 4,
    };
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      ...round2Beat,
    }));

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    const drum = screen.getByTestId("echobeat-drum");

    // At 5800ms (250ms before downbeat at 6050ms, but within tolMs=300ms window):
    act(() => {
      vi.advanceTimersByTime(5800);
    });

    // Tap phase is unlocked early
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(drum.getAttribute("aria-disabled")).toBeNull();

    // Player taps 250ms early (anticipatory tap)
    act(() => {
      fireEvent.click(drum);
    });

    // Advance to second onset at 7550ms (1500ms after downbeat at 6050ms; 7550 - 5800 = 1750ms)
    act(() => {
      vi.advanceTimersByTime(1750);
      fireEvent.click(drum);
    });

    // Both taps accepted within tolerance window, scores good
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");

    vi.useRealTimers();
  });

  it("rejects tap landing 350ms early outside tolerance window and shows retry", () => {
    vi.useFakeTimers();
    const round2Beat: EchoBeatRound = {
      bpm: 80,
      pattern: [{ duration: 2 }, { duration: 2 }],
      onsets: [0, 2],
      gaps: [1.5],
      hitCount: 2,
      totalBeats: 4,
    };
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      ...round2Beat,
    }));

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    const drum = screen.getByTestId("echobeat-drum");

    // At 5700ms (350ms before downbeat at 6050ms, outside tolMs=300ms window):
    // drum is still locked in listen phase
    act(() => {
      vi.advanceTimersByTime(5700);
    });
    expect(drum.getAttribute("aria-disabled")).toBe("true");

    // Advance to downbeat (6050ms)
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap 1 on downbeat
    act(() => {
      fireEvent.click(drum);
    });

    // Second onset is at beat 2 (1500ms after downbeat = 7550ms).
    // Tap 2 lands 350ms early (1500 - 350 = 1150ms after downbeat = 7200ms).
    // Outside 300ms tolerance window, so it is rejected.
    act(() => {
      vi.advanceTimersByTime(1150);
      fireEvent.click(drum);
    });

    // Scored wrong and retry phase active
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it("accepts second tap landing 200ms late on a 2-beat-gap pattern and scores good", () => {
    vi.useFakeTimers();
    const round2Beat: EchoBeatRound = {
      bpm: 80,
      pattern: [{ duration: 2 }, { duration: 2 }],
      onsets: [0, 2],
      gaps: [1.5],
      hitCount: 2,
      totalBeats: 4,
    };
    vi.spyOn(logic, "makeEchoBeatRound").mockReturnValue(round2Beat);

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    const drum = screen.getByTestId("echobeat-drum");

    // Advance to downbeat of tap phase (50ms audio delay + 6000ms = 6050ms)
    act(() => {
      vi.advanceTimersByTime(6050);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap 1 on the exact downbeat (offset 0)
    act(() => {
      fireEvent.click(drum);
    });

    // Tap 2 is expected at beat 2 (2 * 750ms = 1500ms after downbeat).
    // Tap 2 lands 200ms late (1500 + 200 = 1700ms after downbeat).
    // The old 1500ms inactivity timer would have fired and marked this wrong;
    // the grid-derived deadline keeps waiting and judges immediately upon tap 2.
    act(() => {
      vi.advanceTimersByTime(1700);
      fireEvent.click(drum);
    });

    // Score is good!
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");

    vi.useRealTimers();
  });

  it("plays a four-chime count-in with playSequence at round tempo before drum pattern", () => {
    vi.useFakeTimers();
    const playSeqSpy = vi.spyOn(music, "playSequence");
    const playDrumSeqSpy = vi.spyOn(music, "playDrumSequence");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Count-in chimes are initiated immediately on demo start
    expect(playSeqSpy).toHaveBeenCalledTimes(1);
    const [notes, bpm] = playSeqSpy.mock.calls[0];
    expect(notes).toHaveLength(4);
    for (const note of notes) {
      expect(note.b).toBe(1); // 4 quarter clicks
      expect(note.m).toBe(72); // Distinct chime timbre (pitch 72 / C5)
    }
    expect(bpm).toBe(80); // Easy tempo

    // Pattern drum hits have not played yet during count-in (before 4 beats = 3000ms)
    act(() => {
      vi.advanceTimersByTime(2990);
    });
    expect(playDrumSeqSpy).not.toHaveBeenCalled();

    // Advance to 4 beats (4 * 750ms = 3000ms)
    act(() => {
      vi.advanceTimersByTime(20);
    });

    // Drum sequence for the pattern is scheduled after count-in finishes
    expect(playDrumSeqSpy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("triggers grid deadline when taps are missing, shows retry, and restarts demo", () => {
    vi.useFakeTimers();
    const wrongSpy = vi.spyOn(sound.sfx, "wrong");
    const playSeqSpy = vi.spyOn(music, "playSequence");

    const round2Beat: EchoBeatRound = {
      bpm: 80,
      pattern: [{ duration: 2 }, { duration: 2 }],
      onsets: [0, 2],
      gaps: [1.5],
      hitCount: 2,
      totalBeats: 4,
    };
    vi.spyOn(logic, "makeEchoBeatRound").mockReturnValue(round2Beat);

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    const drum = screen.getByTestId("echobeat-drum");

    // playSequence was called for the initial demo
    expect(playSeqSpy).toHaveBeenCalledTimes(1);

    // Advance to downbeat of tap phase (50ms audio delay + 6000ms = 6050ms)
    act(() => {
      vi.advanceTimersByTime(6050);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap once after the downbeat (only 1 of 2 required hits)
    act(() => {
      fireEvent.click(drum);
    });

    // Before the deadline, judging has not occurred yet
    expect(wrongSpy).not.toHaveBeenCalled();

    // Advance past the grid deadline:
    // gridStart (6050ms) + totalBeats * beatMs (3000ms) + tolMs (300ms) = 9350ms
    // We were at 6050ms, so advance 3350ms to reach 9400ms
    act(() => {
      vi.advanceTimersByTime(3350);
    });

    // Deadline timer fired and scored wrong for missing second tap
    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0);

    // After 1000ms wrong feedback, demo restarts
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(playSeqSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("shows retry immediately on second tap when second tap is off-grid", () => {
    vi.useFakeTimers();
    const wrongSpy = vi.spyOn(sound.sfx, "wrong");

    const round2Beat: EchoBeatRound = {
      bpm: 80,
      pattern: [{ duration: 2 }, { duration: 2 }],
      onsets: [0, 2],
      gaps: [1.5],
      hitCount: 2,
      totalBeats: 4,
    };
    vi.spyOn(logic, "makeEchoBeatRound").mockReturnValue(round2Beat);

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    const drum = screen.getByTestId("echobeat-drum");

    // Advance to downbeat of tap phase (6050ms)
    act(() => {
      vi.advanceTimersByTime(6050);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap 1 on the exact downbeat
    act(() => {
      fireEvent.click(drum);
    });

    // Tap 2 expected at beat 2 (1500ms after downbeat).
    // Tap 2 lands 0.6 beats (450ms) off the grid (at 1500 + 450 = 1950ms, outside 300ms tolerance)
    act(() => {
      vi.advanceTimersByTime(1950);
      fireEvent.click(drum);
    });

    // Both hits recorded, so finishRound ran immediately and marked it wrong
    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
