// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import { t } from "../../../i18n";
import { SpellGame } from "../SpellGame";
import * as logic from "../logic";

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
  window.dispatchEvent(new Event("resize"));
}

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
    setViewport(1024, 768);
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

  it("rapidly tapping the same incorrect tile plays the error sound only once", () => {
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

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Rapidly hammer the same wrong tile
    fireEvent.click(screen.getByTestId("spell-tile-2"));
    fireEvent.click(screen.getByTestId("spell-tile-2"));
    fireEvent.click(screen.getByTestId("spell-tile-2"));

    expect(sfx.wrong).toHaveBeenCalledTimes(1);

    // After 500ms error wobble finishes, it can be tapped again
    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.click(screen.getByTestId("spell-tile-2"));
    expect(sfx.wrong).toHaveBeenCalledTimes(2);
  });

  it("allows tapping the correct tile immediately while a wrong tile is wobbling", () => {
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
        ],
      }),
    );

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Tap wrong tile 'Z'
    fireEvent.click(screen.getByTestId("spell-tile-2"));
    expect(sfx.wrong).toHaveBeenCalledTimes(1);

    // Immediately tap correct tile 'C' without waiting for 500ms
    fireEvent.click(screen.getByTestId("spell-tile-1"));
    expect(sfx.good).toHaveBeenCalledTimes(1);
  });

  it("fast taps during state transitions evaluate correctly without marking them wrong", () => {
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
          { id: 2, char: "A" },
          { id: 3, char: "T" },
        ],
      }),
    );

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-hammer correct tiles during state transition:
    // Tap 'C', hammer 'C' again, and tap 'A' before 'C' commits
    act(() => {
      fireEvent.click(screen.getByTestId("spell-tile-1")); // 'C'
      fireEvent.click(screen.getByTestId("spell-tile-1")); // repeated tap on 'C'
      fireEvent.click(screen.getByTestId("spell-tile-2")); // 'A' in rapid succession
    });

    expect(sfx.wrong).not.toHaveBeenCalled();
    expect(sfx.good).toHaveBeenCalledTimes(2);

    // Tap 'T' to complete word
    fireEvent.click(screen.getByTestId("spell-tile-3"));
    expect(sfx.good).toHaveBeenCalledTimes(3);
    expect(sfx.wrong).not.toHaveBeenCalled();
  });

  it("localizes speaker button and tile accessibilityLabels according to lang", () => {
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
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      chars: ["C", "A", "T"],
      decoys: [],
      tiles: [
        { id: 1, char: "C" },
        { id: 2, char: "A" },
        { id: 3, char: "T" },
      ],
    });

    const { rerender } = render(
      <SpellGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    const enSpeaker = screen.getByTestId("spell-word-cat");
    expect(enSpeaker.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );
    const enTile = screen.getByTestId("spell-tile-1");
    expect(enTile.getAttribute("aria-label")).toBe("C");

    // In Japanese, verify localized speaker label and kana tile label without English
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "cat",
        lang: "ja",
        text: "ねこ",
        chars: ["ね", "こ"],
        roman: "neko",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "ja",
        text: "ねこ",
        chars: ["ね", "こ"],
        roman: "neko",
        source: "spotit",
      },
      chars: ["ね", "こ"],
      decoys: [],
      tiles: [
        { id: 10, char: "ね" },
        { id: 20, char: "こ" },
      ],
    });

    rerender(<SpellGame onHome={() => {}} difficulty="easy" lang="ja" />);

    const jaSpeaker = screen.getByTestId("spell-word-cat");
    expect(jaSpeaker.getAttribute("aria-label")).toBe(
      t("ja", "spell.hearAgain"),
    );
    expect(jaSpeaker.getAttribute("aria-label")).toBe("🔊 タップでもういちどきく");
    expect(jaSpeaker.getAttribute("aria-label")).not.toContain("Hear the word");
    expect(screen.getByText("🔊 タップでもういちどきく")).toBeDefined();

    const jaTile = screen.getByTestId("spell-tile-10");
    expect(jaTile.getAttribute("aria-label")).toBe("ね");
    expect(jaTile.getAttribute("aria-label")).not.toContain("Letter");
  });

  it("pronounces earlier characters via say and sequences final character with done in sayThen", () => {
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
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      chars: ["C", "A", "T"],
      decoys: [],
      tiles: [
        { id: 1, char: "C" },
        { id: 2, char: "A" },
        { id: 3, char: "T" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    vi.mocked(sound.say).mockClear();
    vi.mocked(sound.sayThen).mockClear();

    fireEvent.click(screen.getByTestId("spell-tile-1"));
    expect(sound.say).toHaveBeenCalledWith("C!");
    expect(sound.sayThen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("spell-tile-2"));
    expect(sound.say).toHaveBeenCalledWith("A!");
    expect(sound.sayThen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("spell-tile-3"));
    expect(sound.say).not.toHaveBeenCalledWith("T!");
    expect(sound.sayThen).toHaveBeenCalledWith(
      ["T!", "You spelled cat!"],
      expect.any(Function),
    );
  });

  it("sequences final character in non-English words into sayThen", () => {
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "cat",
        lang: "ja",
        text: "ねこ",
        chars: ["ね", "こ"],
        roman: "neko",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "ja",
        text: "ねこ",
        chars: ["ね", "こ"],
        roman: "neko",
        source: "spotit",
      },
      chars: ["ね", "こ"],
      decoys: [],
      tiles: [
        { id: 10, char: "ね" },
        { id: 20, char: "こ" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="ja" />);

    vi.mocked(sound.say).mockClear();
    vi.mocked(sound.sayThen).mockClear();

    fireEvent.click(screen.getByTestId("spell-tile-10"));
    expect(sound.say).toHaveBeenCalledWith("ね！");
    expect(sound.sayThen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("spell-tile-20"));
    expect(sound.say).not.toHaveBeenCalledWith("こ！");
    expect(sound.sayThen).toHaveBeenCalledWith(
      ["こ！", "できた！ねこ！"],
      expect.any(Function),
    );
  });

  it("disables word card speaker button during celebration delay and victory screen", () => {
    let completionCallback: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      completionCallback = cb;
    });

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
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      chars: ["C", "A", "T"],
      decoys: [],
      tiles: [
        { id: 1, char: "C" },
        { id: 2, char: "A" },
        { id: 3, char: "T" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    const speakerCard = screen.getByTestId("spell-word-cat");

    // Initially active - tapping speaks the prompt
    expect(speakerCard.getAttribute("aria-disabled")).not.toBe("true");
    vi.mocked(sound.saySequence).mockClear();
    vi.mocked(sfx.tap).mockClear();
    fireEvent.click(speakerCard);
    expect(sfx.tap).toHaveBeenCalledTimes(1);
    expect(sound.saySequence).toHaveBeenCalledTimes(1);

    // Place first two tiles - still active
    fireEvent.click(screen.getByTestId("spell-tile-1"));
    fireEvent.click(screen.getByTestId("spell-tile-2"));
    expect(speakerCard.getAttribute("aria-disabled")).not.toBe("true");

    // Place final tile - completion delay begins
    fireEvent.click(screen.getByTestId("spell-tile-3"));
    expect(sound.sayThen).toHaveBeenCalledTimes(1);
    expect(speakerCard.getAttribute("aria-disabled")).toBe("true");

    // Tapping during celebration delay does NOT trigger audio replay
    vi.mocked(sound.saySequence).mockClear();
    vi.mocked(sfx.tap).mockClear();
    fireEvent.click(speakerCard);
    expect(sfx.tap).not.toHaveBeenCalled();
    expect(sound.saySequence).not.toHaveBeenCalled();

    // Now trigger the sayThen callback to transition to victory screen
    act(() => {
      completionCallback?.();
    });

    // On victory screen, speaker card remains disabled
    expect(speakerCard.getAttribute("aria-disabled")).toBe("true");
    vi.mocked(sound.saySequence).mockClear();
    vi.mocked(sfx.tap).mockClear();
    fireEvent.click(speakerCard);
    expect(sfx.tap).not.toHaveBeenCalled();
    expect(sound.saySequence).not.toHaveBeenCalled();
  });

  it("clamps slot and tile sizes on narrow viewport to avoid negative dimensions", () => {
    setViewport(90, 600);
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "zebra",
        lang: "en",
        text: "ZEBRA",
        chars: ["Z", "E", "B", "R", "A"],
        roman: "",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "zebra",
        lang: "en",
        text: "ZEBRA",
        chars: ["Z", "E", "B", "R", "A"],
        roman: "",
        source: "spotit",
      },
      chars: ["Z", "E", "B", "R", "A"],
      decoys: ["X", "Y", "W"],
      tiles: [
        { id: 1, char: "Z" },
        { id: 2, char: "E" },
        { id: 3, char: "B" },
        { id: 4, char: "R" },
        { id: 5, char: "A" },
        { id: 6, char: "X" },
        { id: 7, char: "Y" },
        { id: 8, char: "W" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="hard" lang="en" />);

    const tile = screen.getByTestId("spell-tile-1");
    expect(tile.style.width).toBe("28px");
    const slot = screen.getByTestId("spell-slot-0");
    expect(slot.style.width).toBe("24px");
  });

  it("scales tile font size and border radius proportionally on compact mobile viewport", () => {
    setViewport(360, 640);
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "zebra",
        lang: "en",
        text: "ZEBRA",
        chars: ["Z", "E", "B", "R", "A"],
        roman: "",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "zebra",
        lang: "en",
        text: "ZEBRA",
        chars: ["Z", "E", "B", "R", "A"],
        roman: "",
        source: "spotit",
      },
      chars: ["Z", "E", "B", "R", "A"],
      decoys: ["X", "Y", "W"],
      tiles: [
        { id: 1, char: "Z" },
        { id: 2, char: "E" },
        { id: 3, char: "B" },
        { id: 4, char: "R" },
        { id: 5, char: "A" },
        { id: 6, char: "X" },
        { id: 7, char: "Y" },
        { id: 8, char: "W" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="hard" lang="en" />);

    const tile = screen.getByTestId("spell-tile-1");
    // With 360px viewport and 8 tiles, tileSize is 32.25px.
    // borderRadius scales to Math.min(16, Math.round(32.25 * 0.22)) = 7px.
    // fontSize scales to Math.min(32, Math.round(32.25 * 0.55)) = 18px.
    expect(tile.style.width).toBe("32.25px");
    expect(tile.style.borderRadius).toBe("7px");

    const tileText = within(tile).getByText("Z");
    expect(tileText.style.fontSize).toBe("18px");
  });

  it("caps tile font size and border radius at default maximums on wide viewport", () => {
    setViewport(1024, 768);
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
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      chars: ["C", "A", "T"],
      decoys: [],
      tiles: [
        { id: 1, char: "C" },
        { id: 2, char: "A" },
        { id: 3, char: "T" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    const tile = screen.getByTestId("spell-tile-1");
    expect(tile.style.width).toBe("74px");
    expect(tile.style.borderRadius).toBe("16px");

    const tileText = within(tile).getByText("C");
    expect(tileText.style.fontSize).toBe("32px");
  });

  it("scales slot and tile sizes based on height on compact landscape viewport", () => {
    setViewport(568, 320); // compact landscape
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
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      chars: ["C", "A", "T"],
      decoys: [],
      tiles: [
        { id: 1, char: "C" },
        { id: 2, char: "A" },
        { id: 3, char: "T" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    const slot = screen.getByTestId("spell-slot-0");
    expect(slot.style.width).toBe("48px");

    const tile = screen.getByTestId("spell-tile-1");
    expect(tile.style.width).toBe("51.2px");
  });

  describe("language switch safety", () => {
    function SpellGameTestHarness({
      initialLang = "en",
      difficulty = "easy",
    }: {
      initialLang?: Lang;
      difficulty?: "easy" | "medium" | "hard";
    }) {
      const [lang, setLang] = React.useState<Lang>(initialLang);
      const onCycle = () => {
        setLang((prev) =>
          prev === "en" ? "ja" : prev === "ja" ? "cmn" : "en",
        );
      };
      return (
        <LangContext.Provider value={{ lang, onCycle }}>
          <SpellGame onHome={() => {}} difficulty={difficulty} lang={lang} />
        </LangContext.Provider>
      );
    }

    it("preserves victory state when language switches on win screen", () => {
      vi.spyOn(logic, "pickGameWords").mockImplementation((_rng, pool) => {
        const lang = pool[0]?.lang ?? "en";
        if (lang === "en") {
          return [
            {
              icon: "cat",
              lang: "en",
              text: "CAT",
              chars: ["C", "A", "T"],
              roman: "",
              fallbackText: "🐱",
              source: "spotit",
            } as logic.SpellWord,
          ];
        } else {
          return [
            {
              icon: "dog",
              lang: "ja",
              text: "いぬ",
              chars: ["い", "ぬ"],
              roman: "inu",
              fallbackText: "🐶",
              source: "spotit",
            } as logic.SpellWord,
          ];
        }
      });
      vi.spyOn(logic, "makeRound").mockImplementation((_rng, word) => {
        if (word.lang === "en") {
          return {
            word,
            chars: ["C", "A", "T"],
            tiles: [
              { id: 1, char: "T" },
              { id: 2, char: "A" },
              { id: 3, char: "C" },
            ],
            decoys: [],
          };
        } else {
          return {
            word,
            chars: ["い", "ぬ"],
            tiles: [
              { id: 10, char: "い" },
              { id: 11, char: "ぬ" },
            ],
            decoys: [],
          };
        }
      });

      render(<SpellGameTestHarness initialLang="en" />);

      fireEvent.click(screen.getByTestId("spell-tile-3")); // C
      fireEvent.click(screen.getByTestId("spell-tile-2")); // A
      fireEvent.click(screen.getByTestId("spell-tile-1")); // T

      act(() => {
        vi.runAllTimers();
      });

      expect(screen.getByTestId("win-overlay")).toBeTruthy();

      act(() => {
        fireEvent.click(screen.getByTestId("lang-cycle"));
      });

      expect(screen.getByTestId("win-overlay")).toBeTruthy();
    });
    it("cancels pending wrong wobble timer when language switches mid-wobble", () => {
      vi.spyOn(sound, "stopNarration");
      vi.spyOn(logic, "pickGameWords").mockImplementation((_rng, pool) => {
        const lang = pool[0]?.lang ?? "en";
        if (lang === "en") {
          return [
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
          ];
        }
        return [
          {
            icon: "inu",
            lang: "ja",
            text: "いぬ",
            chars: ["い", "ぬ"],
            roman: "inu",
            source: "spotit",
          },
          {
            icon: "neko",
            lang: "ja",
            text: "ねこ",
            chars: ["ね", "こ"],
            roman: "neko",
            source: "spotit",
          },
        ];
      });

      vi.spyOn(logic, "makeRound").mockImplementation((_rng, word) => {
        if (word.lang === "en") {
          return {
            word,
            chars: word.chars,
            decoys: ["Z"],
            tiles: [
              { id: 1, char: "C" },
              { id: 2, char: "A" },
              { id: 3, char: "T" },
              { id: 4, char: "Z" },
            ],
          };
        }
        return {
          word,
          chars: word.chars,
          decoys: ["き"],
          tiles: [
            { id: 10, char: "い" },
            { id: 20, char: "ぬ" },
            { id: 30, char: "き" },
          ],
        };
      });

      render(<SpellGameTestHarness initialLang="en" />);

      expect(screen.getByTestId("spell-score").textContent).toBe("🔤 0/2");
      expect(screen.getByTestId("spell-word-cat")).toBeTruthy();

      // Tap wrong tile 'Z' (id 4)
      fireEvent.click(screen.getByTestId("spell-tile-4"));
      expect(sfx.wrong).toHaveBeenCalledTimes(1);

      // Advance 200ms into the 500ms wrong timer
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Switch language to Japanese mid-wobble
      act(() => {
        fireEvent.click(screen.getByTestId("lang-cycle"));
      });

      expect(sound.stopNarration).toHaveBeenCalled();
      // Round rebuilt to Japanese word 0
      expect(screen.getByTestId("spell-word-inu")).toBeTruthy();
      expect(screen.getByTestId("spell-score").textContent).toBe("🔤 0/2");
      expect(screen.getByTestId("spell-tile-10")).toBeTruthy();
      expect(screen.queryByTestId("spell-tile-4")).toBeNull();

      // Clear spy call history before advancing timer
      vi.mocked(sound.say).mockClear();
      vi.mocked(sound.saySequence).mockClear();

      // Advance remaining 300ms + extra to ensure stale wobble timer was dropped
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(sound.say).not.toHaveBeenCalled();
      expect(sound.saySequence).not.toHaveBeenCalled();

      // Now tapping correct Japanese tile succeeds and updates placed state
      fireEvent.click(screen.getByTestId("spell-tile-10"));
      expect(sfx.good).toHaveBeenCalled();
      expect(sound.say).toHaveBeenCalledWith("い！");
    });

    it("drops pending sayThen callback when language switches during word celebration", () => {
      // Restore real sayThen so activeSayThen is registered
      vi.spyOn(sound, "sayThen").mockRestore();
      vi.spyOn(sound, "stopNarration");

      vi.spyOn(logic, "pickGameWords").mockImplementation((_rng, pool) => {
        const lang = pool[0]?.lang ?? "en";
        if (lang === "en") {
          return [
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
          ];
        }
        return [
          {
            icon: "inu",
            lang: "ja",
            text: "いぬ",
            chars: ["い", "ぬ"],
            roman: "inu",
            source: "spotit",
          },
          {
            icon: "neko",
            lang: "ja",
            text: "ねこ",
            chars: ["ね", "こ"],
            roman: "neko",
            source: "spotit",
          },
        ];
      });

      vi.spyOn(logic, "makeRound").mockImplementation((_rng, word) => {
        if (word.lang === "en") {
          return {
            word,
            chars: word.chars,
            decoys: [],
            tiles: [
              { id: 1, char: "C" },
              { id: 2, char: "A" },
              { id: 3, char: "T" },
            ],
          };
        }
        return {
          word,
          chars: word.chars,
          decoys: [],
          tiles: [
            { id: 10, char: "い" },
            { id: 20, char: "ぬ" },
          ],
        };
      });

      render(<SpellGameTestHarness initialLang="en" />);

      expect(screen.getByTestId("spell-score").textContent).toBe("🔤 0/2");

      // Place all letters of first English word
      fireEvent.click(screen.getByTestId("spell-tile-1"));
      fireEvent.click(screen.getByTestId("spell-tile-2"));
      fireEvent.click(screen.getByTestId("spell-tile-3"));

      // sayThen celebration is active (waiting for speech or cap timeout)
      // Switch language to Japanese mid-celebration
      vi.mocked(sound.saySequence).mockClear();
      act(() => {
        fireEvent.click(screen.getByTestId("lang-cycle"));
      });

      expect(sound.stopNarration).toHaveBeenCalled();

      // Board has rebuilt to Japanese word 0 ('いぬ'), NOT advanced to English word 1 ('dog')
      expect(screen.getByTestId("spell-word-inu")).toBeTruthy();
      expect(screen.getByTestId("spell-score").textContent).toBe("🔤 0/2");
      expect(sound.saySequence).toHaveBeenCalledWith([
        "「いぬ」を つくってね！",
        "い… ぬ！",
      ]);

      // Fast-forward past sayThen's cap timeout (9000ms)
      vi.mocked(sound.saySequence).mockClear();
      vi.mocked(sound.say).mockClear();
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // The stale sayThen callback was dropped by !isValid():
      // Score remains at 0/2 and board is still word 0
      expect(screen.getByTestId("spell-score").textContent).toBe("🔤 0/2");
      expect(screen.getByTestId("spell-word-inu")).toBeTruthy();
      expect(sound.say).not.toHaveBeenCalled();
      expect(sound.saySequence).not.toHaveBeenCalled();
    });
  });

  it("remounts confetti on subsequent words", () => {
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "a",
        lang: "en",
        text: "A",
        chars: ["A"],
        roman: "",
        source: "spotit",
      },
      {
        icon: "b",
        lang: "en",
        text: "B",
        chars: ["B"],
        roman: "",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockImplementation((_rng, gw) => {
      if (gw.text === "A") {
        return {
          word: gw,
          chars: ["A"],
          decoys: [],
          tiles: [
            { id: 1, char: "A" },
            { id: 2, char: "X" },
          ],
        };
      }
      return {
        word: gw,
        chars: ["B"],
        decoys: [],
        tiles: [
          { id: 3, char: "B" },
          { id: 4, char: "Y" },
        ],
      };
    });

    render(
      <LangContext.Provider value={{ lang: "en", onCycle: () => {} }}>
        <SpellGame difficulty="easy" onHome={() => {}} lang="en" />
      </LangContext.Provider>,
    );

    // Complete first word
    fireEvent.click(screen.getByTestId("spell-tile-1"));

    act(() => {
      vi.runAllTimers();
    });

    const confetti1 = screen.getAllByText("🎉")[0];
    expect(confetti1).toBeDefined();

    // Complete second word
    fireEvent.click(screen.getByTestId("spell-tile-3"));

    act(() => {
      vi.runAllTimers();
    });

    const confetti2 = screen.getAllByText("🎉")[0];
    expect(confetti2).toBeDefined();
    expect(confetti2).not.toBe(confetti1);
  });

  it("renders faint ghost character previews in unfilled slots and replaces them with placed letters", () => {
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
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      chars: ["C", "A", "T"],
      decoys: [],
      tiles: [
        { id: 1, char: "C" },
        { id: 2, char: "A" },
        { id: 3, char: "T" },
      ],
    });

    const { rerender } = render(
      <SpellGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    const slot0 = screen.getByTestId("spell-slot-0");
    const slot1 = screen.getByTestId("spell-slot-1");
    const slot2 = screen.getByTestId("spell-slot-2");

    // All slots initially show ghost letters with faint opacity
    const ghost0 = within(slot0).getByText("C");
    const ghost1 = within(slot1).getByText("A");
    const ghost2 = within(slot2).getByText("T");

    expect(window.getComputedStyle(ghost0).opacity).toBe("0.28");
    expect(window.getComputedStyle(ghost1).opacity).toBe("0.28");
    expect(window.getComputedStyle(ghost2).opacity).toBe("0.28");

    // Tap first tile 'C'
    fireEvent.click(screen.getByTestId("spell-tile-1"));

    // Slot 0 is now filled with placed char 'C' (not ghost opacity)
    const filled0 = within(slot0).getByText("C");
    expect(window.getComputedStyle(filled0).opacity).not.toBe("0.28");

    // Slots 1 and 2 still show faint ghost letters
    expect(window.getComputedStyle(within(slot1).getByText("A")).opacity).toBe(
      "0.28",
    );
    expect(window.getComputedStyle(within(slot2).getByText("T")).opacity).toBe(
      "0.28",
    );

    // Tap second tile 'A'
    fireEvent.click(screen.getByTestId("spell-tile-2"));

    const filled1 = within(slot1).getByText("A");
    expect(window.getComputedStyle(filled1).opacity).not.toBe("0.28");
    expect(window.getComputedStyle(within(slot2).getByText("T")).opacity).toBe(
      "0.28",
    );

    // Japanese word also renders kana ghost scaffolding
    vi.spyOn(logic, "pickGameWords").mockReturnValue([
      {
        icon: "cat",
        lang: "ja",
        text: "ねこ",
        chars: ["ね", "こ"],
        roman: "neko",
        source: "spotit",
      },
    ]);
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "ja",
        text: "ねこ",
        chars: ["ね", "こ"],
        roman: "neko",
        source: "spotit",
      },
      chars: ["ね", "こ"],
      decoys: [],
      tiles: [
        { id: 10, char: "ね" },
        { id: 20, char: "こ" },
      ],
    });

    rerender(<SpellGame onHome={() => {}} difficulty="easy" lang="ja" />);

    const jaSlot0 = screen.getByTestId("spell-slot-0");
    const jaSlot1 = screen.getByTestId("spell-slot-1");
    const jaGhost0 = within(jaSlot0).getByText("ね");
    const jaGhost1 = within(jaSlot1).getByText("こ");

    expect(window.getComputedStyle(jaGhost0).opacity).toBe("0.28");
    expect(window.getComputedStyle(jaGhost1).opacity).toBe("0.28");
  });

  it("highlights the currently active unfilled letter slot and advances the highlight as letters are placed", () => {
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
    vi.spyOn(logic, "makeRound").mockReturnValue({
      word: {
        icon: "cat",
        lang: "en",
        text: "CAT",
        chars: ["C", "A", "T"],
        roman: "",
        source: "spotit",
      },
      chars: ["C", "A", "T"],
      decoys: [],
      tiles: [
        { id: 1, char: "C" },
        { id: 2, char: "A" },
        { id: 3, char: "T" },
      ],
    });

    render(<SpellGame onHome={() => {}} difficulty="easy" lang="en" />);

    const slot0 = screen.getByTestId("spell-slot-0");
    const slot1 = screen.getByTestId("spell-slot-1");
    const slot2 = screen.getByTestId("spell-slot-2");

    // Slot 0 is active initially (solid gold border), slots 1 and 2 are inactive unfilled (dashed purple)
    expect(window.getComputedStyle(slot0).borderTopStyle).toBe("solid");
    expect(window.getComputedStyle(slot0).borderTopColor).toBe(
      "rgba(255, 194, 75, 1.00)",
    );
    expect(window.getComputedStyle(slot1).borderTopStyle).toBe("dashed");
    expect(window.getComputedStyle(slot1).borderTopColor).toBe(
      "rgba(155, 126, 222, 1.00)",
    );
    expect(window.getComputedStyle(slot2).borderTopStyle).toBe("dashed");
    expect(window.getComputedStyle(slot2).borderTopColor).toBe(
      "rgba(155, 126, 222, 1.00)",
    );

    // Tap first tile 'C'
    fireEvent.click(screen.getByTestId("spell-tile-1"));

    // Slot 0 is now done (solid green border), slot 1 is active (solid gold), slot 2 remains inactive (dashed purple)
    expect(window.getComputedStyle(slot0).borderTopStyle).toBe("solid");
    expect(window.getComputedStyle(slot0).borderTopColor).toBe(
      "rgba(95, 191, 110, 1.00)",
    );
    expect(window.getComputedStyle(slot1).borderTopStyle).toBe("solid");
    expect(window.getComputedStyle(slot1).borderTopColor).toBe(
      "rgba(255, 194, 75, 1.00)",
    );
    expect(window.getComputedStyle(slot2).borderTopStyle).toBe("dashed");
    expect(window.getComputedStyle(slot2).borderTopColor).toBe(
      "rgba(155, 126, 222, 1.00)",
    );

    // Tap second tile 'A'
    fireEvent.click(screen.getByTestId("spell-tile-2"));

    // Slots 0 and 1 are done, slot 2 is now active
    expect(window.getComputedStyle(slot1).borderTopColor).toBe(
      "rgba(95, 191, 110, 1.00)",
    );
    expect(window.getComputedStyle(slot2).borderTopStyle).toBe("solid");
    expect(window.getComputedStyle(slot2).borderTopColor).toBe(
      "rgba(255, 194, 75, 1.00)",
    );
  });
});
