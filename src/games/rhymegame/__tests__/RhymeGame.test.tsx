// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { manifest } from "../../../manifest";
import * as sound from "../../../sound";
import { RhymeGame } from "../RhymeGame";
import * as logic from "../logic";
import { availableEntries } from "../logic";

vi.mock("../../assets/images", () => {
  const rhymeKeys = [
    "sun",
    "bun",
    "cake",
    "snake",
    "bear",
    "pear",
    "moon",
    "spoon",
    "tree",
    "bee",
    "house",
    "mouse",
    "hat",
    "bat",
    "sock",
    "rock",
    "clock",
    "box",
    "whale",
    "snail",
    "jar",
    "coat",
    "boat",
    "goat",
  ];
  const stub = { uri: "stub.png" };
  const target = Object.fromEntries(rhymeKeys.map((k) => [k, stub]));
  const p = new Proxy(target, {
    get: (t, prop) => (typeof prop === "string" && prop in t ? t[prop] : stub),
  });
  return {
    SPOTIT_ICONS: p,
    RHYME_SPRITES: p,
  };
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

describe("RhymeGame", () => {
  const onHome = vi.fn();
  let goodSpy: ReturnType<typeof vi.spyOn>;
  let wrongSpy: ReturnType<typeof vi.spyOn>;
  let sayThenDoneCallbacks: Array<() => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    cleanup();
    sayThenDoneCallbacks = [];
    vi.restoreAllMocks();
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      if (cb) sayThenDoneCallbacks.push(cb);
    });
    goodSpy = vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    wrongSpy = vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it("renders prompt and tiles on portrait orientation", () => {
    setViewport(390, 844);
    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const promptImage = screen.getByTestId("rhyme-prompt-image");
    expect(promptImage.style.width).toBe("110px");

    const tile0 = screen.getByTestId("rhyme-tile-0");
    expect(tile0.style.width).toBe("110px");
    expect(screen.getByTestId("rhyme-tile-1")).toBeDefined();
    expect(screen.getByTestId("rhyme-tile-2")).toBeDefined();
  });

  it("renders responsive landscape layout on mobile landscape viewports", () => {
    setViewport(844, 390);
    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const promptImage = screen.getByTestId("rhyme-prompt-image");
    expect(promptImage.style.width).toBe("68px");

    const tile0 = screen.getByTestId("rhyme-tile-0");
    expect(tile0.style.width).toBe("91px");
    expect(tile0.style.height).toBe("91px");
  });

  it("handles correct and wrong tile taps", () => {
    setViewport(844, 390);
    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    fireEvent.click(screen.getByTestId("rhyme-tile-0"));
    expect(
      goodSpy.mock.calls.length + wrongSpy.mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("tapping a correct tile twice only triggers sfx.good once", () => {
    let sayThenDone: (() => void) | undefined;
    const sayThenSpy = vi
      .spyOn(sound, "sayThen")
      .mockImplementation((_, cb) => {
        sayThenDone = cb;
      });

    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const entries = availableEntries("en", manifest.spotit.icons);
    const rhymeKeys = new Map(entries.map((e) => [e.icon, e.rhymeKey]));
    const promptEl = screen
      .getAllByTestId(/^rhyme-prompt-/)
      .find((el) => el.getAttribute("data-testid") !== "rhyme-prompt-image")!;
    const testId = promptEl.getAttribute("data-testid") || "";
    const targetIcon = testId.replace("rhyme-prompt-", "");
    const targetRhyme = rhymeKeys.get(targetIcon);

    const tiles = [0, 1, 2].map((i) => screen.getByTestId(`rhyme-tile-${i}`));
    const correctTile = tiles.find(
      (t) => rhymeKeys.get(t.getAttribute("aria-label") || "") === targetRhyme,
    )!;
    expect(correctTile).toBeDefined();

    // First click: triggers confirmation speech and sfx.good
    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);

    // Second rapid click while confirmation is queued/playing: ignored by lockedRef
    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);

    // Confirmation speech finishes, advancing round and unlocking input
    act(() => {
      sayThenDone?.();
    });
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 1/8");

    // Input is unlocked for the new round
    const round2Tile = screen.getByTestId("rhyme-tile-0");
    fireEvent.click(round2Tile);
    expect(goodSpy.mock.calls.length + wrongSpy.mock.calls.length).toBe(2);
  });

  it("handles wrong tile tap when not celebrating with wrong buzzer and prompt replay", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    render(<RhymeGame onHome={() => {}} difficulty="easy" lang="en" />);

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const wrongIdx = currentRound.answerIdx === 0 ? 1 : 0;

    fireEvent.click(screen.getByTestId(`rhyme-tile-${wrongIdx}`));

    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);
    expect(sound.sfx.good).not.toHaveBeenCalled();
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");
    expect(sayThenDoneCallbacks).toHaveLength(0);
  });

  it("ignores wrong tile taps during celebration audio without buzzing or advancing round prematurely", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    render(<RhymeGame onHome={() => {}} difficulty="easy" lang="en" />);

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const answerIdx = currentRound.answerIdx;
    const wrongIdx = answerIdx === 0 ? 1 : 0;

    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");

    // Tap correct tile
    fireEvent.click(screen.getByTestId(`rhyme-tile-${answerIdx}`));

    expect(sound.sfx.good).toHaveBeenCalledTimes(1);
    expect(sayThenDoneCallbacks).toHaveLength(1);
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");

    // While celebration is in progress, tap wrong tile
    fireEvent.click(screen.getByTestId(`rhyme-tile-${wrongIdx}`));

    // Wrong buzzer must NOT sound, and round must not advance prematurely
    expect(sound.sfx.wrong).not.toHaveBeenCalled();
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");

    // Rapid second tap on correct tile must also be ignored
    fireEvent.click(screen.getByTestId(`rhyme-tile-${answerIdx}`));
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);
    expect(sayThenDoneCallbacks).toHaveLength(1);

    const callCountBeforeAdvance = makeRhymeRoundSpy.mock.calls.length;

    // Celebration completes
    const finishCelebration = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishCelebration();
    });

    // Score advances to next round
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 1/8");
    expect(makeRhymeRoundSpy).toHaveBeenCalledTimes(callCountBeforeAdvance + 1);

    // Tiles in round 2 can be tapped
    const secondRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const secondWrongIdx = secondRound.answerIdx === 0 ? 1 : 0;
    fireEvent.click(screen.getByTestId(`rhyme-tile-${secondWrongIdx}`));
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);
  });

  it("resets locked state on play again after winning", () => {
    vi.spyOn(logic, "settingsForRhyme").mockReturnValue({
      rounds: 1,
      tiles: 3,
    });
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");

    render(<RhymeGame onHome={() => {}} difficulty="easy" lang="en" />);

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const answerIdx = currentRound.answerIdx;

    // Answer single round to win
    fireEvent.click(screen.getByTestId(`rhyme-tile-${answerIdx}`));
    expect(sayThenDoneCallbacks).toHaveLength(1);
    const finishCelebration = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishCelebration();
    });

    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 1/1");
    const playAgainBtn = screen.getByTestId("play-again");
    expect(playAgainBtn).toBeDefined();

    // Advance past the 600ms tap shield on WinOverlay
    act(() => {
      vi.advanceTimersByTime(650);
    });

    // Reset game
    fireEvent.click(playAgainBtn);
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/1");

    // Verify advancing/locked lock is released in reset game
    const newRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const newWrongIdx = newRound.answerIdx === 0 ? 1 : 0;
    fireEvent.click(screen.getByTestId(`rhyme-tile-${newWrongIdx}`));
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);
  });

  it("rapidly tapping a wrong tile multiple times only plays error sound and voice prompt once, but allows correct answer", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const saySequenceSpy = vi.spyOn(sound, "saySequence");
    render(<RhymeGame onHome={() => {}} difficulty="easy" lang="en" />);

    const initialSayCalls = saySequenceSpy.mock.calls.length;
    expect(initialSayCalls).toBeGreaterThan(0);

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const wrongIdx = currentRound.answerIdx === 0 ? 1 : 0;
    const wrongTile = screen.getByTestId(`rhyme-tile-${wrongIdx}`);

    fireEvent.click(wrongTile);
    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(saySequenceSpy).toHaveBeenCalledTimes(initialSayCalls + 1);

    // Rapid successive taps on the wrong tile while wrong feedback is active are ignored
    fireEvent.click(wrongTile);
    fireEvent.click(wrongTile);

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(goodSpy).not.toHaveBeenCalled();
    expect(saySequenceSpy).toHaveBeenCalledTimes(initialSayCalls + 1);

    // A tap on the correct tile immediately after a wrong tap succeeds without being blocked
    const correctTile = screen.getByTestId(
      `rhyme-tile-${currentRound.answerIdx}`,
    );
    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
  });

  it("resets wrongIdx and clears wrong timer when language changes mid-round", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const { rerender } = render(
      <RhymeGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const wrongIdx = currentRound.answerIdx === 0 ? 1 : 0;
    const wrongTile = screen.getByTestId(`rhyme-tile-${wrongIdx}`);

    fireEvent.click(wrongTile);
    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    // Switch language while wrong tile animation is active
    rerender(<RhymeGame onHome={() => {}} difficulty="easy" lang="cmn" />);

    // Timer is cleared and wrong state is reset
    expect(vi.getTimerCount()).toBe(0);
  });

  it("navigating home before wrong-tap timeout fires clears timer without errors", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const onHome = vi.fn();
    const { unmount } = render(
      <RhymeGame onHome={onHome} difficulty="easy" lang="en" />,
    );

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const wrongIdx = currentRound.answerIdx === 0 ? 1 : 0;

    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    fireEvent.click(screen.getByTestId(`rhyme-tile-${wrongIdx}`));
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    const wrongTimerCall = setTimeoutSpy.mock.results.find(
      (_, index) => setTimeoutSpy.mock.calls[index]?.[1] === 450,
    );
    expect(wrongTimerCall).toBeDefined();
    const timerId = wrongTimerCall!.value;

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(500);
    });
  });
});
