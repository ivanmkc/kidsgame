// @vitest-environment happy-dom
import React, { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LangContext } from "../../../components/GameShell";
import { t } from "../../../i18n";
import { Lang } from "../../../lang";
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

function LangHarness({
  initialLang = "en",
  difficulty = "easy",
}: {
  initialLang?: Lang;
  difficulty?: "easy" | "medium" | "hard";
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) =>
      l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
    );
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <RhymeGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
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
    vi.spyOn(sound, "say").mockImplementation(() => {});
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

  it("speaks distractor word before prompt on wrong tap", () => {
    const saySequenceSpy = vi.spyOn(sound, "saySequence");
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const round = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const wrongIdx = round.tiles.findIndex((t) => !t.isAnswer);
    const wrongTile = round.tiles[wrongIdx];

    saySequenceSpy.mockClear();
    fireEvent.click(screen.getByTestId(`rhyme-tile-${wrongIdx}`));

    expect(sound.sfx.wrong).toHaveBeenCalled();
    expect(saySequenceSpy).toHaveBeenCalledWith([
      wrongTile.word,
      ...round.promptLines,
    ]);
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
    const rhymeKeys = new Map(
      entries.flatMap((e) => [
        [e.icon, e.rhymeKey],
        [e.word, e.rhymeKey],
      ]),
    );
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

  it("shows correct style on the tapped answer tile during celebration", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    render(<RhymeGame onHome={() => {}} difficulty="easy" lang="en" />);

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const correctTile = screen.getByTestId(
      `rhyme-tile-${currentRound.answerIdx}`,
    );

    const before = correctTile.className;
    fireEvent.click(correctTile);
    const after = correctTile.className;

    expect(after).not.toEqual(before);
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

  it("generates only one round and narrates prompt once on initial mount", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const saySequenceSpy = vi.spyOn(sound, "saySequence");

    const { rerender } = render(
      <RhymeGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(makeRhymeRoundSpy).toHaveBeenCalledTimes(1);
    expect(saySequenceSpy).toHaveBeenCalledTimes(1);
    const initialRound = makeRhymeRoundSpy.mock.results[0]
      .value as logic.RhymeRound;
    expect(saySequenceSpy).toHaveBeenLastCalledWith(initialRound.promptLines);

    // Rerender with same language: does not regenerate round or duplicate prompt
    rerender(<RhymeGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(makeRhymeRoundSpy).toHaveBeenCalledTimes(1);
    expect(saySequenceSpy).toHaveBeenCalledTimes(1);

    // Language change: regenerates round for new language and narrates its prompt
    rerender(<RhymeGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    expect(makeRhymeRoundSpy).toHaveBeenCalledTimes(2);
    expect(saySequenceSpy).toHaveBeenCalledTimes(2);
    const cmnRound = makeRhymeRoundSpy.mock.results[1]
      .value as logic.RhymeRound;
    expect(saySequenceSpy).toHaveBeenLastCalledWith(cmnRound.promptLines);
  });

  it("sets localized accessibilityLabel on choice tiles across locales", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const { rerender } = render(
      <RhymeGame onHome={() => {}} difficulty="easy" lang="ja" />,
    );

    const jaRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    for (let i = 0; i < jaRound.tiles.length; i++) {
      const tile = screen.getByTestId(`rhyme-tile-${i}`);
      expect(tile.getAttribute("aria-label")).toBe(jaRound.tiles[i].word);
      expect(tile.getAttribute("role")).toBe("button");
    }

    rerender(<RhymeGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    const cmnRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    for (let i = 0; i < cmnRound.tiles.length; i++) {
      const tile = screen.getByTestId(`rhyme-tile-${i}`);
      expect(tile.getAttribute("aria-label")).toBe(cmnRound.tiles[i].word);
    }

    rerender(<RhymeGame onHome={() => {}} difficulty="easy" lang="en" />);
    const enRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    for (let i = 0; i < enRound.tiles.length; i++) {
      const tile = screen.getByTestId(`rhyme-tile-${i}`);
      expect(tile.getAttribute("aria-label")).toBe(enRound.tiles[i].word);
    }
  });

  it("drops pending sayThen callback on language switch mid-celebration and avoids double-advance", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const saySequenceSpy = vi.spyOn(sound, "saySequence");
    render(<LangHarness initialLang="en" />);

    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");

    const firstRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const answerIdx = firstRound.answerIdx;

    // Verify initial English prompt and speech
    expect(saySequenceSpy).toHaveBeenCalledWith(firstRound.promptLines);
    saySequenceSpy.mockClear();

    // Tap correct tile to start celebration
    fireEvent.click(screen.getByTestId(`rhyme-tile-${answerIdx}`));
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);
    expect(sayThenDoneCallbacks).toHaveLength(1);
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");

    // Change language mid-celebration
    fireEvent.click(screen.getByTestId("lang-cycle"));

    // The new round is generated for Japanese
    const jaRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;

    // 1. Spoken text matches Japanese and only new language's speech fires
    expect(saySequenceSpy).toHaveBeenCalledTimes(1);
    expect(saySequenceSpy).toHaveBeenCalledWith(jaRound.promptLines);
    expect(jaRound.promptLines[0]).toBe(t("ja", "rhyme.ask"));
    saySequenceSpy.mockClear();

    // 2. Prompt card visual text and testID match the new language round
    const promptContainer = screen
      .getAllByTestId(/^rhyme-prompt-/)
      .find((el) => el.getAttribute("data-testid") !== "rhyme-prompt-image")!;
    expect(promptContainer.getAttribute("data-testid")).toBe(
      `rhyme-prompt-${jaRound.target.icon}`,
    );
    expect(promptContainer.textContent).toContain(jaRound.displayPrompt);
    expect(promptContainer.textContent).toContain(t("ja", "rhyme.ask"));

    // 3. Board tiles' aria-labels match the new Japanese round tiles
    const currentTiles = screen.getAllByTestId(/^rhyme-tile-/);
    expect(currentTiles).toHaveLength(jaRound.tiles.length);
    const tileLabels = currentTiles.map((t) => t.getAttribute("aria-label"));
    const expectedLabels = jaRound.tiles.map((t) => t.word || t.icon);
    expect(tileLabels).toEqual(expectedLabels);

    // Attempt to invoke the pending sayThen callback from the earlier language
    const pendingCelebration = sayThenDoneCallbacks.pop()!;
    act(() => {
      pendingCelebration();
    });

    // 4. Round counter agrees: remains 0/8, not double-advanced
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");

    // 5. No speech fired from the stale English callback
    expect(saySequenceSpy).not.toHaveBeenCalled();
    expect(sound.say).not.toHaveBeenCalled();

    // Advance all pending timers to ensure no trailing old timer fires
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 0/8");
    expect(saySequenceSpy).not.toHaveBeenCalled();

    // 6. Board remains fully playable in the new language
    fireEvent.click(screen.getByTestId(`rhyme-tile-${jaRound.answerIdx}`));
    expect(sayThenDoneCallbacks).toHaveLength(1);
    const jaCelebration = sayThenDoneCallbacks.pop()!;
    act(() => {
      jaCelebration();
    });
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 1/8");
  });

  it("does not drop sayThen callback or brick board when switching between languages that share effectiveLang", () => {
    // When languages share effectiveLang 'en', gameLang stays 'en' across switch
    vi.spyOn(logic, "effectiveLang").mockReturnValue("en");
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    render(<LangHarness initialLang="ja" />);

    const firstRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const answerIdx = firstRound.answerIdx;

    // Start celebration in round 0
    fireEvent.click(screen.getByTestId(`rhyme-tile-${answerIdx}`));
    expect(sayThenDoneCallbacks).toHaveLength(1);

    // Switch language from ja to cmn (both share effectiveLang 'en')
    fireEvent.click(screen.getByTestId("lang-cycle"));

    // Celebration completes: because gameLang did not change, callback is valid
    const finishCelebration = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishCelebration();
    });

    // Round advances and input unlocks instead of bricking
    expect(screen.getByTestId("rhyme-score").textContent).toBe("🎵 1/8");

    // Board in round 1 accepts input without being stuck locked
    const round1Tile = screen.getByTestId("rhyme-tile-0");
    fireEvent.click(round1Tile);
    expect(goodSpy.mock.calls.length + wrongSpy.mock.calls.length).toBe(2);
  });

  it("makes promptCard an accessible button with spell.hearAgain and replays round prompt on tap", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const saySequenceSpy = vi.spyOn(sound, "saySequence");

    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const round = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const promptCard = screen
      .getAllByTestId(/^rhyme-prompt-/)
      .find((el) => el.getAttribute("data-testid") !== "rhyme-prompt-image")!;

    expect(promptCard.getAttribute("role")).toBe("button");
    expect(promptCard.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );
    expect(
      within(promptCard).getByText(t("en", "spell.hearAgain")),
    ).toBeDefined();

    saySequenceSpy.mockClear();
    fireEvent.click(promptCard);
    expect(saySequenceSpy).toHaveBeenCalledTimes(1);
    expect(saySequenceSpy).toHaveBeenCalledWith(round.promptLines);

    fireEvent.click(promptCard);
    expect(saySequenceSpy).toHaveBeenCalledTimes(2);
    expect(saySequenceSpy).toHaveBeenLastCalledWith(round.promptLines);
  });

  it("shows localized spell.hearAgain accessibility label and speaker hint across languages", () => {
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const saySequenceSpy = vi.spyOn(sound, "saySequence");

    const { rerender } = render(
      <RhymeGame onHome={onHome} difficulty="easy" lang="ja" />,
    );

    const jaRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const promptCardJa = screen
      .getAllByTestId(/^rhyme-prompt-/)
      .find((el) => el.getAttribute("data-testid") !== "rhyme-prompt-image")!;

    expect(promptCardJa.getAttribute("role")).toBe("button");
    expect(promptCardJa.getAttribute("aria-label")).toBe(
      t("ja", "spell.hearAgain"),
    );
    expect(
      within(promptCardJa).getByText(t("ja", "spell.hearAgain")),
    ).toBeDefined();

    saySequenceSpy.mockClear();
    fireEvent.click(promptCardJa);
    expect(saySequenceSpy).toHaveBeenCalledWith(jaRound.promptLines);

    rerender(<RhymeGame onHome={onHome} difficulty="easy" lang="cmn" />);
    const cmnRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const promptCardCmn = screen
      .getAllByTestId(/^rhyme-prompt-/)
      .find((el) => el.getAttribute("data-testid") !== "rhyme-prompt-image")!;

    expect(promptCardCmn.getAttribute("aria-label")).toBe(
      t("cmn", "spell.hearAgain"),
    );
    expect(
      within(promptCardCmn).getByText(t("cmn", "spell.hearAgain")),
    ).toBeDefined();

    saySequenceSpy.mockClear();
    fireEvent.click(promptCardCmn);
    expect(saySequenceSpy).toHaveBeenCalledWith(cmnRound.promptLines);
  });

  it("guards prompt replay during celebration and when won", () => {
    vi.spyOn(logic, "settingsForRhyme").mockReturnValue({
      rounds: 1,
      tiles: 3,
    });
    const makeRhymeRoundSpy = vi.spyOn(logic, "makeRhymeRound");
    const saySequenceSpy = vi.spyOn(sound, "saySequence");

    render(<RhymeGame onHome={onHome} difficulty="easy" lang="en" />);

    const currentRound = makeRhymeRoundSpy.mock.results.at(-1)!
      .value as logic.RhymeRound;
    const promptCard = screen
      .getAllByTestId(/^rhyme-prompt-/)
      .find((el) => el.getAttribute("data-testid") !== "rhyme-prompt-image")!;

    // Tap correct tile to start celebration
    fireEvent.click(screen.getByTestId(`rhyme-tile-${currentRound.answerIdx}`));
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);

    // Tapping prompt card while celebration is in progress is ignored
    saySequenceSpy.mockClear();
    fireEvent.click(promptCard);
    expect(saySequenceSpy).not.toHaveBeenCalled();

    // Finish celebration -> game is won
    const finishCelebration = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishCelebration();
    });

    expect(screen.getByTestId("play-again")).toBeDefined();

    // Tapping prompt card when won is ignored
    saySequenceSpy.mockClear();
    fireEvent.click(promptCard);
    expect(saySequenceSpy).not.toHaveBeenCalled();
  });
});
