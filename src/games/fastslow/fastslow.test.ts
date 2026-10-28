// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as music from "../../music";
import * as sound from "../../sound";
import { FastSlowGame } from "./FastSlowGame";
import { speechLines } from "./logic";

describe("speechLines", () => {
  it("covers prompt question, listen, fast, and slow across all languages without duplicates", () => {
    const lines = speechLines();
    expect(lines).toContain("Is the music fast or slow?");
    expect(lines).toContain("Listen...");
    expect(lines).toContain("Fast");
    expect(lines).toContain("Slow");
    expect(lines).toContain("おんがくは はやい？ おそい？");
    expect(lines).toContain("きいてね…");
    expect(lines).toContain("はやい");
    expect(lines).toContain("おそい");
    expect(lines).toContain("音乐是快还是慢？");
    expect(lines).toContain("听一听…");
    expect(lines).toContain("快");
    expect(lines).toContain("慢");
    expect(lines).toContain("音樂係快定慢？");
    expect(lines).toContain("聽下…");
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe("FastSlowGame", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("delays playing the next round by 1000ms after a correct pick", () => {
    vi.useFakeTimers();
    let playCb: (() => void) | undefined;
    let actualSpeed: "fast" | "slow" | undefined;

    const playSpy = vi
      .spyOn(music, "playSequence")
      .mockImplementation((notes, bpm, inst, cb) => {
        playCb = cb;
        actualSpeed = bpm >= 140 ? "fast" : "slow";
        return () => {};
      });

    render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "en",
      }),
    );

    // Initially listen phase, waits 1000ms to start sequence
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Sequence finishes, changes phase to 'pick'
    act(() => {
      if (playCb) playCb();
    });

    // Tap the correct answer
    const btn = screen.getByTestId(
      actualSpeed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );
    fireEvent.click(btn);

    // During the 1000ms delay + 1000ms next round delay, nothing new plays
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // After the new round is set, there's another 1000ms before playSequence is called
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("speaks instructions on listen and pick phases, and delays melody on replay", () => {
    vi.useFakeTimers();
    let playCb: (() => void) | undefined;
    const playSpy = vi
      .spyOn(music, "playSequence")
      .mockImplementation((_notes, _bpm, _inst, cb) => {
        playCb = cb;
        return () => {};
      });

    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const saySequenceSpy = vi
      .spyOn(sound, "saySequence")
      .mockImplementation(() => {});

    render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "en",
      }),
    );

    // Initial render: listen phase
    expect(saySpy).toHaveBeenCalledWith("Listen...");
    expect(saySequenceSpy).not.toHaveBeenCalled();

    // Advance 1000ms so playRound starts playSequence
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Music finishes: switches to pick phase
    act(() => {
      if (playCb) playCb();
    });

    expect(saySequenceSpy).toHaveBeenCalledWith([
      "Is the music fast or slow?",
      "Fast",
      "Slow",
    ]);

    // Tap replay button: switches back to listen phase
    saySpy.mockClear();
    saySequenceSpy.mockClear();

    fireEvent.click(screen.getByTestId("fastslow-replay"));

    expect(saySpy).toHaveBeenCalledWith("Listen...");
    // playSequence is delayed by 1000ms so narration isn't masked
    expect(playSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSpy).toHaveBeenCalledTimes(2);

    // Replayed music finishes: back to pick phase
    act(() => {
      if (playCb) playCb();
    });

    expect(saySequenceSpy).toHaveBeenCalledWith([
      "Is the music fast or slow?",
      "Fast",
      "Slow",
    ]);
  });

  it("speaks localized instructions for non-English languages", () => {
    vi.useFakeTimers();
    let playCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, _inst, cb) => {
        playCb = cb;
        return () => {};
      },
    );

    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const saySequenceSpy = vi
      .spyOn(sound, "saySequence")
      .mockImplementation(() => {});

    const { unmount } = render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "ja",
      }),
    );

    expect(saySpy).toHaveBeenCalledWith("きいてね…");

    // Advance 1000ms so playRound starts playSequence
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      if (playCb) playCb();
    });

    expect(saySequenceSpy).toHaveBeenCalledWith([
      "おんがくは はやい？ おそい？",
      "はやい",
      "おそい",
    ]);
    unmount();

    saySpy.mockClear();
    saySequenceSpy.mockClear();

    // Mandarin (cmn)
    const { unmount: unmountCmn } = render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "cmn",
      }),
    );
    expect(saySpy).toHaveBeenCalledWith("听一听…");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      if (playCb) playCb();
    });
    expect(saySequenceSpy).toHaveBeenCalledWith([
      "音乐是快还是慢？",
      "快",
      "慢",
    ]);
    unmountCmn();

    saySpy.mockClear();
    saySequenceSpy.mockClear();

    // Cantonese (yue)
    render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "yue",
      }),
    );
    expect(saySpy).toHaveBeenCalledWith("聽下…");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      if (playCb) playCb();
    });
    expect(saySequenceSpy).toHaveBeenCalledWith(["音樂係快定慢？", "快", "慢"]);
  });

  it("speaks localized instructional feedback on incorrect pick in Japanese", () => {
    vi.useFakeTimers();
    let playCb: (() => void) | undefined;
    let actualSpeed: "fast" | "slow" | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, bpm, _inst, cb) => {
        playCb = cb;
        actualSpeed = bpm >= 140 ? "fast" : "slow";
        return () => {};
      },
    );

    const sayThenSpy = vi.spyOn(sound, "sayThen").mockImplementation(() => {});

    render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "ja",
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      if (playCb) playCb();
    });

    const wrongBtn = screen.getByTestId(
      actualSpeed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );
    fireEvent.click(wrongBtn);

    // Advance 500ms wrong tint timer to transition into listen phase
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(sayThenSpy).toHaveBeenCalledWith(
      [actualSpeed === "fast" ? "はやい" : "おそい", "きいてね…"],
      expect.any(Function),
      3000,
    );
    expect(screen.getByTestId("fastslow-instructional-tempo").textContent).toBe(
      actualSpeed === "fast" ? "🐰 はやい" : "🐢 おそい",
    );
  });

  it("delays melody playback by 1000ms so opening narration ('Listen...') is not masked", () => {
    vi.useFakeTimers();
    let playCb: (() => void) | undefined;
    const playSpy = vi
      .spyOn(music, "playSequence")
      .mockImplementation((_notes, _bpm, _inst, cb) => {
        playCb = cb;
        return () => {};
      });
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});

    render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "en",
      }),
    );

    expect(saySpy).toHaveBeenCalledWith("Listen...");
    // At 400ms and 800ms, narration is still speaking; music sequence must not start yet
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(playSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(playSpy).not.toHaveBeenCalled();

    // At 1000ms, narration has completed; music sequence starts
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Music finishes -> pick phase
    act(() => {
      if (playCb) playCb();
    });

    // Replay button also delays melody playback by 1000ms
    saySpy.mockClear();
    fireEvent.click(screen.getByTestId("fastslow-replay"));
    expect(saySpy).toHaveBeenCalledWith("Listen...");
    expect(playSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("provides visual note cues during muted playback without dropping tempo feedback (R3)", () => {
    vi.useFakeTimers();
    sound.setMuted(true);

    render(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "en",
      }),
    );

    const pulseEl = screen.getByTestId("fastslow-note-pulse");
    expect(pulseEl.getAttribute("aria-selected")).toBe("false");

    // Advance 1000ms delay to start sequence
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // In playSequence, note 0 is scheduled at t=50ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(
      screen.getByTestId("fastslow-note-pulse").getAttribute("aria-selected"),
    ).toBe("true");

    // Fast-forward through playback
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Playback finishes and enters pick phase
    expect(screen.getByTestId("fastslow-pick-row")).toBeTruthy();
    expect(screen.queryByTestId("fastslow-note-pulse")).toBeNull();
  });
});
