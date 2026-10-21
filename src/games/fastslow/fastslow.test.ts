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

    // Initially listen phase, waits 400ms to start sequence
    act(() => {
      vi.advanceTimersByTime(400);
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

    // During the 1000ms delay + 400ms next round delay, nothing new plays
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // After the new round is set, there's another 400ms before playSequence is called
    act(() => {
      vi.advanceTimersByTime(400);
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

    // Advance 400ms so playRound starts playSequence
    act(() => {
      vi.advanceTimersByTime(400);
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
    // playSequence is delayed by 400ms so narration isn't masked
    expect(playSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(400);
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

    // Advance 400ms so playRound starts playSequence
    act(() => {
      vi.advanceTimersByTime(400);
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
      vi.advanceTimersByTime(400);
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
      vi.advanceTimersByTime(400);
    });
    act(() => {
      if (playCb) playCb();
    });
    expect(saySequenceSpy).toHaveBeenCalledWith(["音樂係快定慢？", "快", "慢"]);
  });
});
