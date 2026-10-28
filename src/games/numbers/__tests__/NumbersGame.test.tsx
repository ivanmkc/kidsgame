// @vitest-environment happy-dom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import { t } from "../../../i18n";
import { hanNumeral } from "../../../lang";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import { NumbersGame } from "../NumbersGame";
import * as logic from "../logic";

describe("NumbersGame", () => {

  it("highlights the correct tile on tap before advancing the round", () => {
    vi.useFakeTimers();
    try {
      render(<NumbersGame onHome={vi.fn()} difficulty="easy" lang="en" />);

      const promptEl = screen.getByTestId(/^numbers-prompt-/);
      const targetN = promptEl
        .getAttribute("data-testid")!
        .replace("numbers-prompt-n-", "");

      let correctTile: HTMLElement | null = null;
      for (let i = 0; i < 5; i++) {
        const tile = screen.getByTestId(`numbers-tile-${i}`);
        if (tile.getAttribute("aria-label") === targetN) {
          correctTile = tile;
        }
      }
      expect(correctTile).not.toBeNull();

      const initialClass = correctTile!.className;

      // Tap correct tile
      fireEvent.click(correctTile!);

      // Visual success feedback is applied immediately (style/class changes)
      expect(correctTile!.className).not.toBe(initialClass);

      // Advance timer by SUCCESS_DELAY_MS
      act(() => { vi.advanceTimersByTime(400); });

      // After round advances, the tile at this index resets its highlight
      const resetTile = screen.getByTestId(correctTile!.getAttribute("data-testid")!);
      expect(resetTile.className).toBe(initialClass);
    } finally {
      vi.useRealTimers();
    }
  });
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("re-skins tiles and prompt without re-rolling the target number on script toggle", () => {
    const onHome = vi.fn();
    render(<NumbersGame onHome={onHome} difficulty="easy" lang="ja" />);

    // In easy ja, initial script is Arabic numbers.
    const scriptBtn = screen.getByTestId("numbers-script");
    expect(scriptBtn).toBeDefined();

    // Check the initial prompt text and tile values.
    const promptEl = screen.getByTestId(/^numbers-prompt-/);
    const initialPromptId = promptEl.getAttribute("data-testid");
    const targetKey = initialPromptId?.replace("numbers-prompt-", "");
    expect(targetKey).toMatch(/^n-\d+$/);
    const targetN = targetKey?.replace("n-", "");

    const initialTileLabels = [0, 1, 2, 3, 4].map((i) => {
      const tile = screen.getByTestId(`numbers-tile-${i}`);
      return tile.getAttribute("aria-label");
    });

    // Toggle script to Han.
    fireEvent.click(scriptBtn);

    // Prompt key should now be h-<targetN>, preserving the exact target number.
    const toggledPromptEl = screen.getByTestId(/^numbers-prompt-/);
    expect(toggledPromptEl.getAttribute("data-testid")).toBe(
      `numbers-prompt-h-${targetN}`,
    );
    expect(toggledPromptEl.textContent).toContain(targetN);

    // All tiles should preserve their numbers in the same positions, re-skinned to Han.
    const hanTileLabels = [0, 1, 2, 3, 4].map((i) => {
      const tile = screen.getByTestId(`numbers-tile-${i}`);
      return tile.getAttribute("aria-label");
    });

    for (const label of hanTileLabels) {
      expect(label).toMatch(/^[一二三四五六七八九十]+$/);
    }

    // Toggle script back to Arabic.
    fireEvent.click(scriptBtn);

    const restoredPromptEl = screen.getByTestId(/^numbers-prompt-/);
    expect(restoredPromptEl.getAttribute("data-testid")).toBe(
      `numbers-prompt-n-${targetN}`,
    );

    const restoredTileLabels = [0, 1, 2, 3, 4].map((i) => {
      const tile = screen.getByTestId(`numbers-tile-${i}`);
      return tile.getAttribute("aria-label");
    });

    expect(restoredTileLabels).toEqual(initialTileLabels);
  });

  it.each(["ja", "cmn", "yue"] as const)(
    "uses localized accessibilityLabel for script switch button in %s",
    (lang) => {
      render(<NumbersGame onHome={vi.fn()} difficulty="easy" lang={lang} />);
      const btn = screen.getByTestId("numbers-script");
      expect(btn.getAttribute("role")).toBe("button");
      expect(btn.getAttribute("aria-label")).toBe(
        t(lang, "button.switchScript"),
      );
      expect(btn.getAttribute("aria-label")).not.toBe("Switch numeral script");
    },
  );

  it("does not render script switch button in English", () => {
    render(<NumbersGame onHome={vi.fn()} difficulty="easy" lang="en" />);
    expect(screen.queryByTestId("numbers-script")).toBeNull();
  });

  it("toggles script between Arabic and Han when clicked", () => {
    render(<NumbersGame onHome={vi.fn()} difficulty="easy" lang="ja" />);
    const btn = screen.getByTestId("numbers-script");
    expect(btn.textContent).toBe("123");
    fireEvent.click(btn);
    expect(sound.sfx.tap).toHaveBeenCalled();
    expect(btn.textContent).toBe("一二三");
  });

  it("keeps prompt card as Arabic numeral across rounds after toggling to Han script", () => {
    vi.useFakeTimers();
    try {
      const onHome = vi.fn();
      render(<NumbersGame onHome={onHome} difficulty="easy" lang="ja" />);

      // Toggle script to Han.
      const scriptBtn = screen.getByTestId("numbers-script");
      fireEvent.click(scriptBtn);

      // Initial round after toggle: prompt card displays Arabic numeral while tiles are Han.
      const promptEl = screen.getByTestId(/^numbers-prompt-/);
      const targetKey1 = promptEl
        .getAttribute("data-testid")!
        .replace("numbers-prompt-", "");
      expect(targetKey1).toMatch(/^h-\d+$/);
      const targetN1 = targetKey1.replace("h-", "");
      expect(promptEl.textContent).toContain(targetN1);

      // Tap the correct Han tile to advance to the next round.
      const targetHan1 = hanNumeral(Number(targetN1));
      let correctTile: HTMLElement | null = null;
      for (let i = 0; i < 5; i++) {
        const tile = screen.getByTestId(`numbers-tile-${i}`);
        if (tile.getAttribute("aria-label") === targetHan1) {
          correctTile = tile;
        }
      }
      expect(correctTile).not.toBeNull();
      fireEvent.click(correctTile!);
      act(() => { vi.advanceTimersByTime(400); });

      // Next round: prompt card remains Arabic numeral, and tiles remain Han numerals.
      const nextPromptEl = screen.getByTestId(/^numbers-prompt-/);
      const targetKey2 = nextPromptEl
        .getAttribute("data-testid")!
        .replace("numbers-prompt-", "");
      expect(targetKey2).toMatch(/^h-\d+$/);
      const targetN2 = targetKey2.replace("h-", "");
      expect(nextPromptEl.textContent).toContain(targetN2);

      const nextHanLabels = [0, 1, 2, 3, 4].map((i) =>
        screen.getByTestId(`numbers-tile-${i}`).getAttribute("aria-label"),
      );
      for (const label of nextHanLabels) {
        expect(label).toMatch(/^[一二三四五六七八九十]+$/);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("rebuilds active round, updates spoken prompts, removes 0 and cancels stale timers on language switch", () => {
    vi.useFakeTimers();
    try {
      function NumbersGameTestWrapper() {
        const [lang, setLang] = React.useState<Lang>("en");
        const onCycle = () => {
          setLang((prev) => (prev === "en" ? "ja" : "en"));
        };
        return (
          <LangContext.Provider value={{ lang, onCycle }}>
            <NumbersGame onHome={vi.fn()} difficulty="easy" lang={lang} />
          </LangContext.Provider>
        );
      }

      const generatedRounds: logic.NumberRound[] = [];
      const origMakeNumberRound = logic.makeNumberRound;
      vi.spyOn(logic, "makeNumberRound").mockImplementation(
        (rng, settings, lang, avoidN) => {
          if (lang === "en") {
            const round = origMakeNumberRound(() => 0, settings, lang, avoidN);
            generatedRounds.push(round);
            return round;
          }
          const res = origMakeNumberRound(rng, settings, lang, avoidN);
          generatedRounds.push(res);
          return res;
        },
      );

      render(<NumbersGameTestWrapper />);

      // Initial English round speaks English prompt line
      expect(sound.saySequence).toHaveBeenCalledTimes(1);
      expect(sound.saySequence).toHaveBeenLastCalledWith([
        "Find the number 0!",
      ]);

      // Confirm 0 is on the board in English
      expect(screen.queryByLabelText("0")).toBeTruthy();

      const round1 = generatedRounds[0];
      const wrongTile = round1.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn = screen.getByTestId(
        `numbers-tile-${round1.tiles.indexOf(wrongTile)}`,
      );

      // Tap wrong tile
      fireEvent.click(wrongBtn);
      expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);
      expect(sound.saySequence).toHaveBeenCalledTimes(2);
      expect(sound.saySequence).toHaveBeenLastCalledWith([
        "Find the number 0!",
      ]);

      // Advance timers partially (200ms of 450ms)
      vi.advanceTimersByTime(200);
      expect(vi.getTimerCount()).toBe(1);

      // Switch language to Japanese via header lang button
      fireEvent.click(screen.getByTestId("lang-cycle"));

      // Stale error timer from old language must be cancelled immediately
      expect(vi.getTimerCount()).toBe(0);

      // Active round rebuilt for Japanese
      expect(generatedRounds).toHaveLength(2);
      const round2 = generatedRounds[1];
      expect(sound.saySequence).toHaveBeenCalledTimes(3);
      expect(sound.saySequence).toHaveBeenLastCalledWith([
        "さがしてね！",
        expect.any(String),
      ]);

      // Tile 0 must not remain on the board in Asian language
      expect(screen.queryByLabelText("0")).toBeNull();
      for (const t of round2.tiles) {
        expect(t.n).toBeGreaterThanOrEqual(1);
      }

      // Round counter agrees
      expect(screen.getByTestId("numbers-score").textContent).toContain("0/8");

      // Tap wrong tile in Japanese round: must speak Japanese prompt, never old English prompt
      const wrongTile2 = round2.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn2 = screen.getByTestId(
        `numbers-tile-${round2.tiles.indexOf(wrongTile2)}`,
      );
      fireEvent.click(wrongBtn2);
      expect(sound.sfx.wrong).toHaveBeenCalledTimes(2);
      expect(sound.saySequence).toHaveBeenCalledTimes(4);
      expect(sound.saySequence).toHaveBeenLastCalledWith([
        "さがしてね！",
        expect.any(String),
      ]);
      expect(vi.getTimerCount()).toBe(1);

      // Advance timers past error timer
      vi.advanceTimersByTime(450);
      expect(vi.getTimerCount()).toBe(0);

      // Tap correct tile in Japanese: advances round
      const correctTile2 = round2.tiles.find((t) => t.isAnswer)!;
      const correctBtn2 = screen.getByTestId(
        `numbers-tile-${round2.tiles.indexOf(correctTile2)}`,
      );
      fireEvent.click(correctBtn2);
      expect(sound.sfx.good).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(400); });
      expect(screen.getByTestId("numbers-score").textContent).toContain("1/8");
    } finally {
      vi.useRealTimers();
    }
  });

  it("locks input between rounds so rapid double-taps do not register wrong answers on the next round", () => {
    vi.useFakeTimers();
    try {
      render(<NumbersGame onHome={vi.fn()} difficulty="easy" lang="en" />);

      const promptEl = screen.getByTestId(/^numbers-prompt-/);
      const targetN = promptEl
        .getAttribute("data-testid")!
        .replace("numbers-prompt-n-", "");

      let correctTile: HTMLElement | null = null;
      for (let i = 0; i < 5; i++) {
        const tile = screen.getByTestId(`numbers-tile-${i}`);
        if (tile.getAttribute("aria-label") === targetN) {
          correctTile = tile;
          break;
        }
      }
      expect(correctTile).not.toBeNull();

      // First tap on the correct tile starts transition feedback and locks input
      fireEvent.click(correctTile!);
      expect(sound.sfx.good).toHaveBeenCalledTimes(1);

      // Trailing tap 80ms later (within celebration lock window) must be ignored
      const otherTile =
        screen.getByTestId("numbers-tile-0") === correctTile
          ? screen.getByTestId("numbers-tile-1")
          : screen.getByTestId("numbers-tile-0");
      vi.advanceTimersByTime(80);
      fireEvent.click(otherTile);

      expect(sound.sfx.wrong).not.toHaveBeenCalled();
      expect(sound.sfx.good).toHaveBeenCalledTimes(1);

      // Advance past celebration lock delay (remaining 320ms of 400ms)
      vi.advanceTimersByTime(320);

      // Identify distractor and answer tiles in the newly mounted round
      const nextPromptEl = screen.getByTestId(/^numbers-prompt-/);
      const nextTargetN = nextPromptEl
        .getAttribute("data-testid")!
        .replace("numbers-prompt-n-", "");
      let nextCorrectTile: HTMLElement | null = null;
      for (let i = 0; i < 5; i++) {
        const tile = screen.getByTestId(`numbers-tile-${i}`);
        if (tile.getAttribute("aria-label") === nextTargetN) {
          nextCorrectTile = tile;
          break;
        }
      }
      expect(nextCorrectTile).not.toBeNull();

      // Next round now accepts input
      fireEvent.click(nextCorrectTile!);
      expect(sound.sfx.good).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders prompt card as button with speaker icon and replays audio on click", () => {
    const onHome = vi.fn();
    render(<NumbersGame onHome={onHome} difficulty="easy" lang="en" />);

    // Prompt badge is rendered as an accessible button with the speaker icon.
    const promptEl = screen.getByTestId(/^numbers-prompt-/);
    expect(promptEl.getAttribute("role")).toBe("button");
    expect(promptEl.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );
    expect(promptEl.textContent).toContain("🔊");
    expect(screen.getByTestId("speaker-icon")).toBeDefined();

    // Initial mount spoke the prompt line once.
    expect(sound.saySequence).toHaveBeenCalledTimes(1);

    // Clicking the prompt card replays spoken prompt audio.
    fireEvent.click(promptEl);
    expect(sound.saySequence).toHaveBeenCalledTimes(2);

    // Another click replays again.
    fireEvent.click(promptEl);
    expect(sound.saySequence).toHaveBeenCalledTimes(3);
  });

  it.each(["ja", "cmn", "yue"] as const)(
    "localizes prompt card replay accessibility label in %s",
    (lang) => {
      render(<NumbersGame onHome={vi.fn()} difficulty="easy" lang={lang} />);
      const promptEl = screen.getByTestId(/^numbers-prompt-/);
      expect(promptEl.getAttribute("role")).toBe("button");
      expect(promptEl.getAttribute("aria-label")).toBe(
        t(lang, "spell.hearAgain"),
      );
      expect(promptEl.textContent).toContain("🔊");
    },
  );

  it("does not replay prompt while locked", () => {
    vi.useFakeTimers();
    try {
      render(<NumbersGame onHome={vi.fn()} difficulty="easy" lang="en" />);
      const promptEl = screen.getByTestId(/^numbers-prompt-/);
      const targetN = promptEl
        .getAttribute("data-testid")!
        .replace("numbers-prompt-n-", "");

      let correctTile: HTMLElement | null = null;
      for (let i = 0; i < 5; i++) {
        const tile = screen.getByTestId(`numbers-tile-${i}`);
        if (tile.getAttribute("aria-label") === targetN) {
          correctTile = tile;
          break;
        }
      }
      expect(correctTile).not.toBeNull();

      // Tap correct tile to start lock
      fireEvent.click(correctTile!);
      vi.mocked(sound.saySequence).mockClear();

      // Within the 400ms celebration lock, tapping prompt does not replay
      const lockedPromptEl = screen.getByTestId(/^numbers-prompt-/);
      fireEvent.click(lockedPromptEl);
      expect(sound.saySequence).not.toHaveBeenCalled();

      // Past celebration lock, tapping prompt replays
      act(() => { vi.advanceTimersByTime(400); });
      const nextPromptEl = screen.getByTestId(/^numbers-prompt-/);
      fireEvent.click(nextPromptEl);
      expect(sound.saySequence).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("calls stopNarration and handles language switch safely on victory screen", () => {
    vi.useFakeTimers();
    try {
      const stopSpy = vi.spyOn(sound, "stopNarration");

      function VictoryLangWrapper() {
        const [lang, setLang] = React.useState<Lang>("en");
        return (
          <LangContext.Provider
            value={{
              lang,
              onCycle: () => setLang((l) => (l === "en" ? "ja" : "en")),
            }}
          >
            <NumbersGame
              onHome={vi.fn()}
              difficulty="easy"
              lang={lang}
            />
          </LangContext.Provider>
        );
      }

      render(<VictoryLangWrapper />);

      // Fast-forward rounds to win (easy requires 8 rounds)
      for (let round = 0; round < 8; round++) {
        const promptEl = screen.getByTestId(/^numbers-prompt-/);
        const targetKey = promptEl
          .getAttribute("data-testid")!
          .replace("numbers-prompt-", "");
        const targetN = targetKey.replace(/^[a-z]-/, "");
        let correctTile: HTMLElement | null = null;
        for (let i = 0; i < 5; i++) {
          const tile = screen.getByTestId(`numbers-tile-${i}`);
          const label = tile.getAttribute("aria-label");
          if (label === targetN || label === hanNumeral(Number(targetN))) {
            correctTile = tile;
            break;
          }
        }
        expect(correctTile).not.toBeNull();
        fireEvent.click(correctTile!);
        act(() => { vi.advanceTimersByTime(400); });
      }

      vi.advanceTimersByTime(600);

      // Win overlay is now displayed
      expect(screen.queryByTestId("win-overlay")).not.toBeNull();

      // Switch language mid-victory
      stopSpy.mockClear();
      fireEvent.click(screen.getByTestId("lang-cycle"));

      // stopNarration must be called via useLangEpoch layout effect
      expect(stopSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
