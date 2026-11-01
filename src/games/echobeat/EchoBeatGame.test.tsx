// @vitest-environment happy-dom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { EchoBeatGame } from "./EchoBeatGame";
import { LangContext } from "../../components/GameShell";
import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";
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
      disconnect: vi.fn(),
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
      vi.advanceTimersByTime(400);
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

    // Wait for evaluation timer (3000ms)
    act(() => {
      vi.advanceTimersByTime(3000);
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
      vi.advanceTimersByTime(400);
      fireEvent.click(drum);
      vi.advanceTimersByTime(400);
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

  it("allows pauses between taps without premature timeout on easy mode", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.5, 0.5],
      hitCount: 3,
    }));
    const wrongSpy = vi.spyOn(sound.sfx, "wrong");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Wait for demo rhythm to finish playing
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");

    // Tap 1
    act(() => {
      fireEvent.click(drum);
    });

    // Pause 1.25s (1250ms) - should not fail or trigger retry
    act(() => {
      vi.advanceTimersByTime(1250);
    });
    expect(wrongSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("🔄")).toBeNull();
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap 2
    act(() => {
      fireEvent.click(drum);
    });

    // Pause 1.25s again
    act(() => {
      vi.advanceTimersByTime(1250);
    });
    expect(wrongSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("🔄")).toBeNull();

    // Tap 3 (completes round)
    act(() => {
      fireEvent.click(drum);
    });

    // Evaluates immediately on completing hitCount
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");

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
        vi.advanceTimersByTime(400);
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
      vi.advanceTimersByTime(400);
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

  it("stops drum sequence when switching language while opening speech is active", () => {
    vi.useFakeTimers();
    const playSeqSpy = vi.spyOn(music, "playDrumSequence");
    const stopSeqSpy = vi.spyOn(music, "stopSequence");

    const { rerender } = render(
      <EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(playSeqSpy).not.toHaveBeenCalled();

    rerender(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);

    expect(stopSeqSpy).toHaveBeenCalled();
    expect(playSeqSpy).not.toHaveBeenCalled();
    expect(screen.getByText("きこえた リズムを タップ！")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(playSeqSpy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("renders drum with accessibilityRole button and localized label", () => {
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
    const drum = screen.getByTestId("echobeat-drum");
    expect(drum.getAttribute("role")).toBe("button");
    expect(drum.getAttribute("aria-label")).toBe("Tap the rhythm you hear!");
  });

  it("localizes drum accessibility label when lang is ja", () => {
    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);
    const drum = screen.getByTestId("echobeat-drum");
    expect(drum.getAttribute("aria-label")).toBe("きこえた リズムを タップ！");
  });

  it("keeps board children count stable and hides tap dots in listen phase", () => {
    vi.useFakeTimers();

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    const board = screen.getByTestId("echobeat-board");
    const tapDots = screen.getByTestId("echobeat-tap-dots");

    // In listen phase, the board has 3 children (statusCard, drum, tapDotRow)
    // and tap dots are hidden with opacity 0 so vertical layout stays stable.
    expect(board.children.length).toBe(3);
    expect(window.getComputedStyle(tapDots).opacity).toBe("0");
    expect(tapDots.getAttribute("aria-hidden")).toBe("true");

    // Advance past speech and demo rhythm into tap phase
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // In tap phase, board children count remains 3 and tap dots become visible
    expect(board.children.length).toBe(3);
    expect(window.getComputedStyle(tapDots).opacity).not.toBe("0");
    expect(tapDots.getAttribute("aria-hidden")).toBeNull();

    // Wrong rhythm triggers retry after evaluation timeout
    const drum = screen.getByTestId("echobeat-drum");
    act(() => {
      fireEvent.click(drum);
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0);

    // Advance retry timeout (1000ms) to replay demo
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();

    // After retry, board children count is still 3 and tap dots are hidden again
    expect(board.children.length).toBe(3);
    expect(window.getComputedStyle(tapDots).opacity).toBe("0");
    expect(tapDots.getAttribute("aria-hidden")).toBe("true");

    vi.useRealTimers();
  });

  it("preserves round transition and advances to next round when language is switched mid-transition", () => {
    vi.useFakeTimers();
    let roundIndex = 0;
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => {
      roundIndex++;
      return roundIndex === 1
        ? { gaps: [0.4], hitCount: 2 }
        : { gaps: [0.3, 0.3], hitCount: 3 };
    });

    render(<LangHarness initialLang="en" />);

    // Fast-forward initial speech and demo for round 1
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");

    // Tap the required 2 times for round 1
    act(() => {
      fireEvent.click(drum);
      vi.advanceTimersByTime(400);
      fireEvent.click(drum);
    });

    // Round 1 completed: score is 1/6, celebration is shown
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);

    // Mid-transition (during the 800ms delay), tap the in-game language button
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const langBtn = screen.getByTestId("lang-cycle");
    act(() => {
      fireEvent.click(langBtn);
    });

    // Subtitle is now localized in Japanese
    expect(screen.getByText("きこえた リズムを タップ！")).toBeTruthy();

    // Advance the remaining 600ms of the 800ms transition
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Score remains 1/6 (not reset or prematurely incremented)
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");

    // Advance past round 2 demo rhythm
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Round 2 is now in tap phase with 3 tap dots (new pattern!)
    expect(screen.getByText("きみの ばん！")).toBeTruthy();
    const tapDots = screen.getByTestId("echobeat-tap-dots");
    expect(tapDots.children.length).toBe(3);

    vi.useRealTimers();
  });

  it("restarts demo cleanly when switching language during listen phase", () => {
    vi.useFakeTimers();
    let roundIndex = 0;
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => {
      roundIndex++;
      return roundIndex === 1
        ? { gaps: [0.4], hitCount: 2 }
        : { gaps: [0.3, 0.3], hitCount: 3 };
    });
    const playSeqSpy = vi.spyOn(music, "playDrumSequence");
    const stopSeqSpy = vi.spyOn(music, "stopSequence");
    const sayThenSpy = vi.spyOn(sound, "sayThen");

    render(<LangHarness initialLang="en" />);

    // Round 1 opening speech completes (200ms) and demo rhythm begins playing
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(playSeqSpy).toHaveBeenCalledTimes(1);

    // Switch language mid-demo during listen phase
    const langBtn = screen.getByTestId("lang-cycle");
    act(() => {
      fireEvent.click(langBtn);
    });

    // Running demo sequence is stopped immediately
    expect(stopSeqSpy).toHaveBeenCalled();
    expect(screen.getByText("きこえた リズムを タップ！")).toBeTruthy();
    expect(screen.getByText("きいてね…")).toBeTruthy();

    // Opening instruction in Japanese completes (200ms) and restarts demo
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(playSeqSpy).toHaveBeenCalledTimes(2);

    // Advance past restarted demo to tap phase
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("きみの ばん！")).toBeTruthy();

    const drum = screen.getByTestId("echobeat-drum");
    // Complete round 1 in Japanese
    act(() => {
      fireEvent.click(drum);
      vi.advanceTimersByTime(400);
      fireEvent.click(drum);
    });
    expect(screen.getByTestId("echobeat-score").textContent).toContain("1/6");

    // Advance celebration timeout (800ms) to start round 2
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText("きいてね…")).toBeTruthy();
    expect(playSeqSpy).toHaveBeenCalledTimes(3);

    // Round 2 demo is now playing in listen phase.
    // Reset sayThen spy call count to verify round 2 language switch behavior.
    sayThenSpy.mockClear();

    // Switch language during round 2 listen phase (Japanese -> Mandarin)
    act(() => {
      fireEvent.click(langBtn);
    });

    // In round 2 (score > 0), demo restarts directly without repeating voice instruction
    expect(sayThenSpy).not.toHaveBeenCalled();
    expect(stopSeqSpy).toHaveBeenCalled();
    expect(playSeqSpy).toHaveBeenCalledTimes(4);
    expect(screen.getByText("听一听…")).toBeTruthy();

    // Advance past round 2 restarted demo rhythm
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("轮到你了！")).toBeTruthy();
    const tapDots = screen.getByTestId("echobeat-tap-dots");
    expect(tapDots.children.length).toBe(3);

    vi.useRealTimers();
  });

  it("renders visual tempo pulse indicator and pulses at round tempo", () => {
    vi.useFakeTimers();

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // In listen phase, tempo pulse element is present
    const tempoPulse = screen.getByTestId("echobeat-tempo-pulse");
    expect(tempoPulse).toBeTruthy();

    // Advance to tap phase
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // In tap phase, tempo pulse element is still present
    expect(screen.getByTestId("echobeat-tempo-pulse")).toBeTruthy();

    vi.useRealTimers();
  });

  it("synchronizes visual tempo pulse with demo sequence playback after instruction speech", () => {
    vi.useFakeTimers();
    let sayThenDone: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, done) => {
      sayThenDone = done;
    });

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // In listen phase during initial speech, tempo pulse indicator is present
    expect(screen.getByTestId("echobeat-tempo-pulse")).toBeTruthy();

    // Opening instruction speech completes -> demo and synchronized tempo pulse begin
    act(() => {
      sayThenDone?.();
    });

    // Advance through demo into tap phase
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(screen.getByTestId("echobeat-tempo-pulse")).toBeTruthy();

    vi.useRealTimers();
  });

  it("clamps drum container scale on short landscape viewports to prevent layout occlusion", () => {
    vi.useFakeTimers();
    setViewport(667, 375);

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    const drumContainer = screen.getByTestId("echobeat-drum-container");
    expect(drumContainer.style.transform).toBe("");

    vi.useRealTimers();
  });

  it("renders a single emoji in status card during celebration and retry without duplicating emojis", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.4],
      hitCount: 2,
    }));

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward demo rhythm into tap phase
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(screen.getAllByText("👆")).toHaveLength(1);

    const drum = screen.getByTestId("echobeat-drum");

    // Enter correct 2 taps to trigger celebration
    act(() => {
      fireEvent.click(drum);
      vi.advanceTimersByTime(400);
      fireEvent.click(drum);
    });

    // During celebration, only a single celebration emoji is rendered in status card
    expect(screen.getAllByText("🎉")).toHaveLength(1);
    expect(screen.queryByText("Your turn!")).toBeNull();

    // Advance past celebration (800ms) to start round 2
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();

    // Advance past round 2 demo into tap phase
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Your turn!")).toBeTruthy();

    // Tap once (incorrect rhythm) and wait for evaluation delay (3000ms)
    act(() => {
      fireEvent.click(drum);
      vi.advanceTimersByTime(3000);
    });

    // During retry, only a single retry emoji is rendered in status card
    expect(screen.getAllByText("🔄")).toHaveLength(1);
    expect(screen.queryByText("Your turn!")).toBeNull();

    vi.useRealTimers();
  });

  it("delays WinOverlay mount and sfx.win by 800ms on final round completion to show celebration sparkles", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.4],
      hitCount: 2,
    }));
    const goodSpy = vi.spyOn(sound.sfx, "good");
    const winSpy = vi.spyOn(sound.sfx, "win");

    render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance past initial speech and demo into tap phase
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    const drum = screen.getByTestId("echobeat-drum");

    // Complete rounds 1 through 5 (score reaches 5/6)
    for (let r = 0; r < 5; r++) {
      act(() => {
        fireEvent.click(drum);
        vi.advanceTimersByTime(400);
        fireEvent.click(drum);
      });
      // Advance past celebration (800ms)
      act(() => {
        vi.advanceTimersByTime(800);
      });
      // Advance past next round demo (2000ms)
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }

    expect(screen.getByTestId("echobeat-score").textContent).toContain("5/6");
    goodSpy.mockClear();
    winSpy.mockClear();

    // Round 6: tap rhythm to complete final winning round
    act(() => {
      fireEvent.click(drum);
      vi.advanceTimersByTime(400);
      fireEvent.click(drum);
    });

    // Immediately at 0ms: sfx.good fires, score is 6/6, celebration 🎉 shows,
    // but WinOverlay has NOT mounted yet and sfx.win has NOT fired
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("echobeat-score").textContent).toContain("6/6");
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 799ms: celebration is still visible, WinOverlay still deferred
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    expect(screen.getAllByText("🎉").length).toBeGreaterThan(0);

    // At 800ms: celebration timer fires, WinOverlay mounts and sfx.win plays without clashing
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(winSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("win-overlay")).toBeTruthy();

    // Advance through WinOverlay entrance animation (600ms) to arm Play Again
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const playAgain = screen.getByTestId("play-again");
    expect(playAgain).toBeTruthy();

    // Clicking Play Again resets score to 0 and clears WinOverlay
    act(() => {
      fireEvent.click(playAgain);
    });
    expect(screen.getByTestId("echobeat-score").textContent).toContain("0/6");
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    vi.useRealTimers();
  });

  it("preserves win transition when language is switched during final round celebration", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makeEchoBeatRound").mockImplementation(() => ({
      gaps: [0.4],
      hitCount: 2,
    }));
    const winSpy = vi.spyOn(sound.sfx, "win");

    render(<LangHarness initialLang="en" />);

    // Advance past initial speech and demo into tap phase
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    const drum = screen.getByTestId("echobeat-drum");

    // Complete rounds 1 through 5 (score reaches 5/6)
    for (let r = 0; r < 5; r++) {
      act(() => {
        fireEvent.click(drum);
        vi.advanceTimersByTime(400);
        fireEvent.click(drum);
      });
      act(() => {
        vi.advanceTimersByTime(800);
      });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }

    expect(screen.getByTestId("echobeat-score").textContent).toContain("5/6");
    winSpy.mockClear();

    // Round 6: tap rhythm to complete final winning round
    act(() => {
      fireEvent.click(drum);
      vi.advanceTimersByTime(400);
      fireEvent.click(drum);
    });

    // 200ms into the 800ms celebration, switch language to Japanese
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const langBtn = screen.getByTestId("lang-cycle");
    act(() => {
      fireEvent.click(langBtn);
    });

    // WinOverlay has not mounted yet (only 200ms elapsed)
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // Advance remaining 600ms of celebration
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // WinOverlay mounts in Japanese and sfx.win fires
    expect(winSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("win-overlay")).toBeTruthy();
    expect(screen.getByText("リズムスター！ かんぺきな エコー！")).toBeTruthy();

    vi.useRealTimers();
  });
});

function LangHarness({
  difficulty = "easy",
  initialLang = "en",
}: {
  difficulty?: Difficulty;
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
      <EchoBeatGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

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
