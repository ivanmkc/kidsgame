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

function mockSpeechSynthesis() {
  (
    window as unknown as { SpeechSynthesisUtterance: unknown }
  ).SpeechSynthesisUtterance = class {
    text: string;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    speak: (u: { onstart?: () => void; onend?: () => void }) => {
      u.onstart?.();
      setTimeout(() => u.onend?.(), 200);
    },
    cancel: vi.fn(),
  };
}

describe("EchoBeatGame", () => {
  beforeEach(() => {
    mockAudioContext();
    mockSpeechSynthesis();
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
    const sayThenSpy = vi.spyOn(sound, "sayThen");
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(sayThenSpy).toHaveBeenCalledWith(
      ["Tap the rhythm you hear!"],
      expect.any(Function),
    );
  });

  it("speaks localized instruction prompt for selected language", () => {
    const sayThenSpy = vi.spyOn(sound, "sayThen");
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(sayThenSpy).toHaveBeenCalledWith(
      ["きこえた リズムを タップ！"],
      expect.any(Function),
    );
  });

  it("sequences demo rhythm after opening instruction completes on mount", () => {
    let sayThenDone: (() => void) | undefined;
    const sayThenSpy = vi
      .spyOn(sound, "sayThen")
      .mockImplementation((_texts, done) => {
        sayThenDone = done;
      });
    const playSeqSpy = vi.spyOn(music, "playDrumSequence");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(sayThenSpy).toHaveBeenCalledWith(
      ["Tap the rhythm you hear!"],
      expect.any(Function),
    );
    expect(playSeqSpy).not.toHaveBeenCalled();

    act(() => {
      sayThenDone?.();
    });
    expect(playSeqSpy).toHaveBeenCalledTimes(1);
  });

  it("sequences demo rhythm after opening instruction when resetting on Play Again", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.4],
      hitCount: 2,
    }));

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance past speech and demo
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    const drum = screen.getByTestId("echobeat-drum");
    for (let r = 0; r < 6; r++) {
      act(() => {
        fireEvent.click(drum);
        fireEvent.click(drum);
      });
      act(() => {
        vi.advanceTimersByTime(800);
      });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const playAgain = screen.getByTestId("play-again");
    expect(playAgain).toBeTruthy();

    let sayThenDone: (() => void) | undefined;
    const sayThenSpy = vi
      .spyOn(sound, "sayThen")
      .mockImplementation((_texts, done) => {
        sayThenDone = done;
      });
    const playSeqSpy = vi.spyOn(music, "playDrumSequence");

    act(() => {
      fireEvent.click(playAgain);
    });

    expect(sayThenSpy).toHaveBeenCalledWith(
      ["Tap the rhythm you hear!"],
      expect.any(Function),
    );
    expect(playSeqSpy).not.toHaveBeenCalled();

    act(() => {
      sayThenDone?.();
    });
    expect(playSeqSpy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("plays demo rhythm directly on round advance without repeating voice instruction", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.4],
      hitCount: 2,
    }));
    const sayThenSpy = vi.spyOn(sound, "sayThen");
    const playSeqSpy = vi.spyOn(music, "playDrumSequence");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Initial mount calls sayThen once
    expect(sayThenSpy).toHaveBeenCalledTimes(1);

    // Advance past opening speech (200ms) and round 1 demo
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(playSeqSpy).toHaveBeenCalledTimes(1);

    const drum = screen.getByTestId("echobeat-drum");
    // Complete round 1
    act(() => {
      fireEvent.click(drum);
      fireEvent.click(drum);
    });

    // Advance celebration timeout (800ms) to start round 2
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Round 2 should play demo directly without calling sayThen again
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    expect(playSeqSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
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

  it("cancels speech and pending demo on unmount", () => {
    let sayThenDone: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, done) => {
      sayThenDone = done;
    });
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const playSeqSpy = vi.spyOn(music, "playDrumSequence");

    const { unmount } = render(
      <EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(playSeqSpy).not.toHaveBeenCalled();

    unmount();

    expect(stopNarrationSpy).toHaveBeenCalled();

    act(() => {
      sayThenDone?.();
    });
    expect(playSeqSpy).not.toHaveBeenCalled();
  });

  it("handles mid-round language switch safely and resets phase to listen", () => {
    vi.useFakeTimers();
    let sayThenDone: (() => void) | undefined;
    const sayThenSpy = vi
      .spyOn(sound, "sayThen")
      .mockImplementation((_texts, done) => {
        sayThenDone = done;
      });
    const playSeqSpy = vi.spyOn(music, "playDrumSequence");
    const playDrumSpy = vi.spyOn(music, "playDrum");

    const { rerender } = render(
      <EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Opening speech completes, demo plays, transitions to tap phase
    act(() => {
      sayThenDone?.();
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");

    // Switch language to Japanese mid-round while in tap phase
    rerender(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);

    expect(sayThenSpy).toHaveBeenLastCalledWith(
      ["きこえた リズムを タップ！"],
      expect.any(Function),
    );

    // Phase must immediately revert to listen while speech is active
    expect(screen.getByText("きこえた リズムを タップ！")).toBeTruthy();
    expect(screen.getByText("きいてね…")).toBeTruthy();

    // Drum taps must be blocked during speech
    act(() => {
      fireEvent.click(drum);
    });
    expect(playDrumSpy).not.toHaveBeenCalled();

    // Completing speech allows demo to run
    act(() => {
      sayThenDone?.();
    });
    expect(playSeqSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
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
