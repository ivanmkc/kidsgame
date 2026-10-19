// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { SpellGame } from "../SpellGame";
import * as logic from "../logic";

describe("SpellGame", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb && cb());
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it("runs a complete game, handling right and wrong tiles", async () => {
    const pickSpy = vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      {
        icon: "dog",
        lang: "en",
        text: "DOG",
        chars: ["D", "O", "G"],
        roman: "",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockImplementation(
      (_rng, word, _decoys, _alphabet) => ({
        word,
        chars: word.chars,
        decoys: [],
        tiles: [
          { id: 1, char: word.chars[0] },
          { id: 2, char: word.chars[1] },
          { id: 3, char: word.chars[2] },
          { id: 4, char: "Z" }, // decoy
        ],
      }),
    );

    const onHome = vi.fn();
    const { rerender } = render(
      <SpellGame onHome={onHome} difficulty="easy" lang="en" />,
    );

    // First word is CAT
    expect(screen.getByTestId("spell-word-cat")).toBeTruthy();

    // Tap the word to replay the sound
    fireEvent.click(screen.getByTestId("spell-word-cat"));
    expect(sfx.tap).toHaveBeenCalled();

    // Tap the wrong tile 'Z' (id 4)
    fireEvent.click(screen.getByTestId("spell-tile-4"));
    expect(sfx.wrong).toHaveBeenCalled();

    // Fast forward to clear wrongTimer
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Tap 'C' (id 1)
    fireEvent.click(screen.getByTestId("spell-tile-1"));
    expect(sfx.good).toHaveBeenCalled();

    // Tap 'A' (id 2)
    fireEvent.click(screen.getByTestId("spell-tile-2"));

    // Tap 'T' (id 3)
    fireEvent.click(screen.getByTestId("spell-tile-3"));

    // Test second word is generated (DOG)
    expect(screen.getByTestId("spell-word-dog")).toBeTruthy();

    // Complete second word
    fireEvent.click(screen.getByTestId("spell-tile-1")); // 'D'
    fireEvent.click(screen.getByTestId("spell-tile-2")); // 'O'
    fireEvent.click(screen.getByTestId("spell-tile-3")); // 'G'

    // Win overlay animations need to finish so buttons become armed
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Win overlay should appear. Let's tap Play Again.
    const playAgainBtn = screen.getByText("Play Again ▶️");
    fireEvent.click(playAgainBtn);

    // Should reset to word index 0
    expect(screen.getByTestId("spell-word-cat")).toBeTruthy();

    // Change lang to Japanese to hit the lang switch useEffect
    pickSpy.mockReturnValue([
      {
        icon: "inu",
        lang: "ja",
        text: "INU",
        chars: ["I", "N", "U"],
        roman: "",
        source: "spotit",
      },
    ]);
    rerender(<SpellGame onHome={onHome} difficulty="easy" lang="ja" />);
    // Should reset to the Japanese word
    expect(screen.getByTestId("spell-word-inu")).toBeTruthy();
  });

  it("unmount clears wrong timer", () => {
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockImplementation(
      (_rng, word, _decoys, _alphabet) => ({
        word,
        chars: word.chars,
        decoys: [],
        tiles: [
          { id: 1, char: "C" },
          { id: 2, char: "Z" }, // decoy
        ],
      }),
    );

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(
      <SpellGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    fireEvent.click(screen.getByTestId("spell-tile-2")); // start wrong timer

    const wrongCallIndex = setTimeoutSpy.mock.calls.findIndex(
      (call) => call[1] === 500,
    );
    expect(wrongCallIndex).toBeGreaterThanOrEqual(0);
    const wrongTimerId = setTimeoutSpy.mock.results[wrongCallIndex].value;

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(wrongTimerId);
  });

  it("clears previous wrong timer when another wrong tile is tapped", () => {
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockImplementation(
      (_rng, word, _decoys, _alphabet) => ({
        word,
        chars: word.chars,
        decoys: [],
        tiles: [
          { id: 1, char: "C" },
          { id: 2, char: "Z" },
          { id: 3, char: "X" },
        ],
      }),
    );

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(
      <SpellGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // First wrong tap
    fireEvent.click(screen.getByTestId("spell-tile-2"));
    const firstWrongCallIndex = setTimeoutSpy.mock.calls.findIndex(
      (call) => call[1] === 500,
    );
    expect(firstWrongCallIndex).toBeGreaterThanOrEqual(0);
    const firstTimerId = setTimeoutSpy.mock.results[firstWrongCallIndex].value;

    // Second wrong tap before 500ms
    fireEvent.click(screen.getByTestId("spell-tile-3"));
    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimerId);

    const secondWrongCallIndex = setTimeoutSpy.mock.calls.findLastIndex(
      (call) => call[1] === 500,
    );
    expect(secondWrongCallIndex).toBeGreaterThan(firstWrongCallIndex);
    const secondTimerId =
      setTimeoutSpy.mock.results[secondWrongCallIndex].value;

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(secondTimerId);
  });
});
