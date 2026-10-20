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
import { speechLines } from "./logic";

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

    // Celebration phase active immediately upon completing required taps
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

  it("evaluates immediately upon final tap and ignores extra tap after all dots filled", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.4, 0.4],
      hitCount: 3,
    }));
    const playDrumSpy = vi.spyOn(music, "playDrum");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Wait for demo rhythm to finish playing
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");

    // Enter all 3 required taps to fill all dots
    act(() => {
      fireEvent.click(drum);
      fireEvent.click(drum);
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(3);

    // Round evaluates immediately without 1.2s delay
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");

    // Extra tap after all dots filled is ignored and does not fail the round
    act(() => {
      fireEvent.click(drum);
    });
    expect(playDrumSpy).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("🔄")).toBeNull();
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it("renders scaled drum in mobile landscape orientation (667x375)", () => {
    setViewport(667, 375);
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    const drum = screen.getByTestId("echobeat-drum");
    expect(drum.style.width).toBe("142px");
    expect(drum.style.height).toBe("142px");
  });

  it("renders compact drum in 568x320 landscape orientation", () => {
    setViewport(568, 320);
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    const drum = screen.getByTestId("echobeat-drum");
    expect(drum.style.width).toBe("121px");
    expect(drum.style.height).toBe("121px");
  });

  it("speaks instruction prompt on mount", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(saySpy).toHaveBeenCalledWith("Tap the rhythm you hear!");
  });

  it("speaks localized instruction prompt for selected language", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(saySpy).toHaveBeenCalledWith("きこえた リズムを タップ！");
  });

  it("speechLines exports localized subtitles for all languages", () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines).toContain("Tap the rhythm you hear!");
    expect(lines).toContain("きこえた リズムを タップ！");
    expect(lines).toContain("拍出你听到的节拍！");
    expect(lines).toContain("撳出你聽到嘅節拍！");
  });
});

function setViewport(width: number, height: number) {
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
