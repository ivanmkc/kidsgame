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
import * as sound from "../../sound";
import * as music from "../../music";
import * as logic from "./logic";

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
      vi.advanceTimersByTime(3000);
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
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText("Your turn!")).toBeTruthy();

    vi.useRealTimers();
  });

  it("locks drum input during celebration and retry so stray taps do not register", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.4],
      hitCount: 2,
    }));
    const playDrumSpy = vi.spyOn(music, "playDrum");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Wait for demo rhythm to finish playing
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");

    // Tap drum twice (correct sequence for hitCount 2)
    act(() => {
      fireEvent.click(drum);
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(2);

    // Wait for evaluation timer (1200ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Celebration phase active
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
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap once (incorrect sequence for hitCount 2)
    act(() => {
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(3);

    // Wait for evaluation timer (1200ms)
    act(() => {
      vi.advanceTimersByTime(1200);
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

  it("does not leak drum audio if unmounted during retry delay", () => {
    vi.useFakeTimers();
    const playDrumSequenceSpy = vi.spyOn(music, "playDrumSequence");

    const { unmount } = render(
      <EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(playDrumSequenceSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");
    act(() => {
      fireEvent.click(drum);
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0);

    unmount();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(playDrumSequenceSpy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("replays demo after 1000 ms even if drum is tapped during retry window", () => {
    vi.useFakeTimers();
    const playDrumSequenceSpy = vi.spyOn(music, "playDrumSequence");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(playDrumSequenceSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");
    act(() => {
      fireEvent.click(drum);
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0);

    act(() => {
      fireEvent.click(drum);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(playDrumSequenceSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
