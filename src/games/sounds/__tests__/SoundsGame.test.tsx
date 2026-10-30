// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LangContext } from "../../../components/GameShell";
import { t } from "../../../i18n";
import { Lang } from "../../../lang";
import { manifest } from "../../../manifest";
import * as sound from "../../../sound";
import { WORDS, wordFor } from "../../../curriculum/content";
import { SoundsGame } from "../SoundsGame";
import * as logic from "../logic";

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
      <SoundsGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe("SoundsGame language switch safety", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("updates display prompt and speaks new language prompt when language switches mid-round", () => {
    const saySeqSpy = vi.spyOn(sound, "saySequence");

    render(<LangHarness initialLang="en" />);

    // English prompt spoken initially
    expect(saySeqSpy).toHaveBeenCalledWith([
      expect.stringMatching(/^Which one starts with .+\?$/),
    ]);
    saySeqSpy.mockClear();

    // Verify visual prompt in English
    const promptText = screen.getByTestId(/^sounds-prompt-/).textContent;
    expect(promptText).toMatch(/^Which one starts with .+\?$/);

    // Initial tile set on the board
    const initialTiles = screen
      .getAllByTestId(/^sounds-tile-/)
      .map((t) => t.getAttribute("aria-label"));

    // Header chip switches to Japanese
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // Visual prompt immediately resolves to Japanese with "どれかな？"
    const jaPromptText = screen.getByTestId(/^sounds-prompt-/).textContent;
    expect(jaPromptText).toContain("どれかな？");

    // Japanese prompt is spoken via saySequence
    expect(saySeqSpy).toHaveBeenCalledWith(["どれかな？", expect.any(String)]);

    // Board tiles update to localized Japanese labels
    const currentTiles = screen
      .getAllByTestId(/^sounds-tile-/)
      .map((t) => t.getAttribute("aria-label"));
    expect(currentTiles).toHaveLength(initialTiles.length);
    currentTiles.forEach((label, i) => {
      const enLabel = initialTiles[i];
      const entry = WORDS.find((w) => w.en === enLabel);
      expect(entry).toBeDefined();
      expect(label).toBe(entry!.ja);
    });

    // Score remains at 0/8
    expect(screen.getByTestId("sounds-score").textContent).toContain("0/8");
  });

  it("plays confirmation in current language after mid-round switch", () => {
    const sayThenSpy = vi.spyOn(sound, "sayThen");

    render(<LangHarness initialLang="en" />);

    // Switch from EN to JA mid-round
    fireEvent.click(screen.getByTestId("lang-cycle"));
    sayThenSpy.mockClear();

    // Tap tiles until answer is found
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (sayThenSpy.mock.calls.length > 0) break;
    }

    // Confirmation must be spoken in Japanese (ends with full-width exclamation mark)
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    const confirmLines = sayThenSpy.mock.calls[0][0];
    expect(confirmLines[0]).toMatch(/！$/);
  });

  it("drops pending confirmation callback and does not advance round if language switches during praise", () => {
    vi.useFakeTimers();
    const saySeqSpy = vi.spyOn(sound, "saySequence");
    const goodSpy = vi.spyOn(sound.sfx, "good");

    render(<LangHarness initialLang="en" />);

    expect(screen.getByTestId("sounds-score").textContent).toContain("0/8");

    // Click answer tile in English
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (goodSpy.mock.calls.length > 0) break;
    }

    expect(goodSpy).toHaveBeenCalledTimes(1);
    saySeqSpy.mockClear();

    // Cycle language while confirmation is active
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // Old sayThen callback was cancelled by useLangEpoch and dropped by !isValid()
    expect(screen.getByTestId("sounds-score").textContent).toContain("0/8");

    // Japanese prompt is spoken for the active round
    expect(saySeqSpy).toHaveBeenCalledWith(["どれかな？", expect.any(String)]);
  });

  it("re-speaks prompt in current language on incorrect tile tap after language switch", () => {
    vi.useFakeTimers();
    const saySeqSpy = vi.spyOn(sound, "saySequence");
    const wrongSpy = vi.spyOn(sound.sfx, "wrong");

    render(<LangHarness initialLang="en" />);

    // Switch to JA
    fireEvent.click(screen.getByTestId("lang-cycle"));
    saySeqSpy.mockClear();

    // Find and click an incorrect tile
    const promptEl = screen.getByTestId(/^sounds-prompt-/);
    const targetIdx = Number(
      promptEl.getAttribute("data-testid")!.replace("sounds-prompt-", ""),
    );
    const pool = WORDS.filter((w) => manifest.spotit.icons.includes(w.icon));
    const targetWord = wordFor(pool[targetIdx], "ja").text;
    const incorrectTile = screen
      .getAllByTestId(/^sounds-tile-/)
      .find((t) => t.getAttribute("aria-label") !== targetWord)!;
    fireEvent.click(incorrectTile);

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(saySeqSpy).toHaveBeenCalledWith(["どれかな？", expect.any(String)]);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();
  });
});

describe("SoundsGame round transition lock", () => {
  let goodSpy: ReturnType<typeof vi.spyOn>;
  let wrongSpy: ReturnType<typeof vi.spyOn>;
  let saySequenceSpy: ReturnType<typeof vi.spyOn>;
  let sayThenSpy: ReturnType<typeof vi.spyOn>;
  let sayThenCallback = null as (() => void) | null;

  beforeEach(() => {
    vi.restoreAllMocks();
    sayThenCallback = null;
    goodSpy = vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    wrongSpy = vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    saySequenceSpy = vi.spyOn(sound, "saySequence").mockImplementation(() => {
      if (sayThenCallback) {
        const cb = sayThenCallback;
        sayThenCallback = null;
        cb();
      }
    });
    sayThenSpy = vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      sayThenCallback = cb ?? null;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("prevents taps during round transition after tapping the correct answer", () => {
    const generatedRounds: logic.SoundsRound[] = [];
    const origMakeSoundsRound = logic.makeSoundsRound;
    vi.spyOn(logic, "makeSoundsRound").mockImplementation((...args) => {
      const res = origMakeSoundsRound(...args);
      generatedRounds.push(res);
      return res;
    });

    render(<SoundsGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(generatedRounds.length).toBe(1);
    const round1 = generatedRounds[0];
    const correctIdx = round1.answerIdx;
    const wrongIdx = (correctIdx + 1) % round1.tiles.length;

    const correctTile = screen.getByTestId(`sounds-tile-${correctIdx}`);
    const wrongTile = screen.getByTestId(`sounds-tile-${wrongIdx}`);

    // Tap the correct tile
    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("sounds-score").textContent).toContain("0/8");

    // While celebration is playing (sayThen has not completed):
    // 1. Tapping a wrong tile is ignored (no wrong buzzer, no prompt re-narration)
    saySequenceSpy.mockClear();
    fireEvent.click(wrongTile);
    expect(wrongSpy).not.toHaveBeenCalled();
    expect(saySequenceSpy).not.toHaveBeenCalled();
    expect(sayThenCallback).not.toBeNull();

    // 2. Rapid second tap on the correct tile is also ignored
    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);

    // Spoken celebration finishes
    expect(sayThenCallback).not.toBeNull();
    act(() => {
      sayThenCallback!();
      sayThenCallback = null;
    });

    // Round has advanced
    expect(screen.getByTestId("sounds-score").textContent).toContain("1/8");
    expect(generatedRounds.length).toBe(2);

    // Input is unlocked in the next round
    const round2 = generatedRounds[1];
    const round2CorrectTile = screen.getByTestId(
      `sounds-tile-${round2.answerIdx}`,
    );
    fireEvent.click(round2CorrectTile);
    expect(goodSpy).toHaveBeenCalledTimes(2);
  });

  it("unlocks input when language changes during transition", () => {
    const generatedRounds: logic.SoundsRound[] = [];
    const origMakeSoundsRound = logic.makeSoundsRound;
    vi.spyOn(logic, "makeSoundsRound").mockImplementation((...args) => {
      const res = origMakeSoundsRound(...args);
      generatedRounds.push(res);
      return res;
    });

    const { rerender } = render(
      <SoundsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    const round1 = generatedRounds[0];
    const correctTile = screen.getByTestId(`sounds-tile-${round1.answerIdx}`);

    fireEvent.click(correctTile);
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenCallback).not.toBeNull();

    // Language changes mid-transition: saySequence cancels sayThen
    rerender(<SoundsGame onHome={() => {}} difficulty="easy" lang="ja" />);

    // sayThen callback was executed by saySequence cancellation
    expect(sayThenCallback).toBeNull();

    // Current round is active and interactive in new language
    const currentCorrectTile = screen.getByTestId(
      `sounds-tile-${round1.answerIdx}`,
    );
    fireEvent.click(currentCorrectTile);
    expect(goodSpy).toHaveBeenCalledTimes(2);
  });
});

describe("SoundsGame prompt replay affordance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders speaker button and re-speaks prompt when clicked", () => {
    const saySeqSpy = vi.spyOn(sound, "saySequence");
    render(<SoundsGame onHome={() => {}} difficulty="easy" lang="en" />);

    const speakerBtn = screen.getByTestId("speaker-button");
    expect(speakerBtn).toBeTruthy();
    expect(speakerBtn.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );

    saySeqSpy.mockClear();
    fireEvent.click(speakerBtn);

    expect(saySeqSpy).toHaveBeenCalledTimes(1);
    expect(saySeqSpy).toHaveBeenCalledWith([
      expect.stringMatching(/^Which one starts with .+\?$/),
    ]);
  });

  it("re-speaks prompt when prompt banner is tapped", () => {
    const saySeqSpy = vi.spyOn(sound, "saySequence");
    render(<SoundsGame onHome={() => {}} difficulty="easy" lang="en" />);

    const promptBtn = screen.getByTestId(/^sounds-prompt-/);
    expect(promptBtn.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );

    saySeqSpy.mockClear();
    fireEvent.click(promptBtn);

    expect(saySeqSpy).toHaveBeenCalledTimes(1);
    expect(saySeqSpy).toHaveBeenCalledWith([
      expect.stringMatching(/^Which one starts with .+\?$/),
    ]);
  });

  it("localizes speaker button accessibilityLabel and speaks in active language after switch", () => {
    const saySeqSpy = vi.spyOn(sound, "saySequence");
    render(<LangHarness initialLang="en" />);

    // Switch to Japanese
    fireEvent.click(screen.getByTestId("lang-cycle"));
    saySeqSpy.mockClear();

    const speakerBtn = screen.getByTestId("speaker-button");
    expect(speakerBtn.getAttribute("aria-label")).toBe(
      t("ja", "spell.hearAgain"),
    );

    fireEvent.click(speakerBtn);
    expect(saySeqSpy).toHaveBeenCalledWith(["どれかな？", expect.any(String)]);
  });

  it("ignores replay taps while transition lock is active", () => {
    let sayThenCb: (() => void) | null = null;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      sayThenCb = cb ?? null;
    });
    const saySeqSpy = vi.spyOn(sound, "saySequence");

    render(<SoundsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Tap tiles until answer is found to enter transition lock
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (sayThenCb) break;
    }
    expect(sayThenCb).not.toBeNull();

    saySeqSpy.mockClear();
    fireEvent.click(screen.getByTestId("speaker-button"));
    fireEvent.click(screen.getByTestId(/^sounds-prompt-/));

    expect(saySeqSpy).not.toHaveBeenCalled();
  });

  it("disables replay and ignores taps when game is won", () => {
    let sayThenCb: (() => void) | null = null;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      sayThenCb = cb ?? null;
    });
    vi.spyOn(logic, "settingsForSounds").mockReturnValue({
      rounds: 1,
      tiles: 3,
    });
    const saySeqSpy = vi.spyOn(sound, "saySequence");

    render(<SoundsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Solve the 1 round
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (sayThenCb) break;
    }
    act(() => {
      sayThenCb!();
    });

    saySeqSpy.mockClear();
    fireEvent.click(screen.getByTestId("speaker-button"));
    fireEvent.click(screen.getByTestId(/^sounds-prompt-/));

    expect(saySeqSpy).not.toHaveBeenCalled();
  });
});

describe("SoundsGame narration cleanup", () => {
  afterEach(() => {
    cleanup();
  });

  it("stops narration on unmount", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const saySequenceSpy = vi
      .spyOn(sound, "saySequence")
      .mockImplementation(() => {});

    const onHome = vi.fn();
    const { unmount } = render(
      <SoundsGame onHome={onHome} difficulty="easy" lang="en" />,
    );
    expect(saySequenceSpy).toHaveBeenCalledTimes(1);
    unmount();
    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });

  it("clears wrong timer on unmount", () => {
    vi.useFakeTimers();
    try {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      vi.spyOn(sound, "saySequence").mockImplementation(() => {});
      vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});

      let roundInfo: logic.SoundsRound | undefined;
      const origMakeSoundsRound = logic.makeSoundsRound;
      vi.spyOn(logic, "makeSoundsRound").mockImplementation((...args) => {
        const res = origMakeSoundsRound(...args);
        roundInfo = res;
        return res;
      });

      const { unmount } = render(
        <SoundsGame onHome={() => {}} difficulty="easy" lang="en" />,
      );

      // Tap an incorrect tile to trigger wrong timer (450ms)
      const wrongIdx = (roundInfo!.answerIdx + 1) % roundInfo!.tiles.length;
      fireEvent.click(screen.getByTestId(`sounds-tile-${wrongIdx}`));

      const callIdx = setTimeoutSpy.mock.calls.findLastIndex(
        (args) => args[1] === 450,
      );
      expect(callIdx).toBeGreaterThanOrEqual(0);
      const timerId = setTimeoutSpy.mock.results[callIdx].value;

      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("SoundsGame timer behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("stops timer during final round confirmation", () => {
    const onHome = vi.fn();

    // Force 1 round to win, but keeping medium so timer is true
    vi.spyOn(logic, "settingsForSounds").mockReturnValue({
      rounds: 1,
      tiles: 3,
    });

    let roundInfo: logic.SoundsRound | undefined;
    const origMakeSoundsRound = logic.makeSoundsRound;
    vi.spyOn(logic, "makeSoundsRound").mockImplementation((...args) => {
      const res = origMakeSoundsRound(...args);
      roundInfo = res;
      return res;
    });

    let sayThenCallback: (() => void) | null = null;
    vi.spyOn(sound, "sayThen").mockImplementation((_seq, cb) => {
      sayThenCallback = cb;
    });
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});

    render(<SoundsGame onHome={onHome} difficulty="medium" lang="en" />);

    // Timer starts at 0:00
    expect(screen.getByTestId("sounds-timer").textContent).toContain("0:00");

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("sounds-timer").textContent).toContain("0:05");

    // Tap correct tile
    if (!roundInfo) throw new Error("roundInfo not set");
    const correctTile = screen.getByTestId(
      `sounds-tile-${roundInfo.answerIdx}`,
    );
    fireEvent.click(correctTile);

    // We are now in final celebration, sayThenCallback is captured
    expect(sayThenCallback).not.toBeNull();

    // Advance time again. Since we tapped the final correct tile, timer should NOT advance
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId("sounds-timer").textContent).toContain("0:05");

    // Finish celebration
    act(() => {
      sayThenCallback?.();
    });

    // Time still not advancing because we won
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId("sounds-timer").textContent).toContain("0:05");
  });
});

describe("SoundsGame visual feedback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
  });

  it("applies sparkles to correct tile during transition, then clears them", () => {
    let sayThenCb: (() => void) | null = null;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      sayThenCb = cb ?? null;
    });
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});

    render(<SoundsGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(screen.queryAllByText(/✨|⭐/).length).toBe(0);

    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (sayThenCb) break;
    }

    // Sparkles should now be present
    expect(screen.queryAllByText(/✨|⭐/).length).toBeGreaterThan(0);

    // Call sayThen callback
    act(() => {
      sayThenCb!();
    });

    // Sparkles should be cleared
    expect(screen.queryAllByText(/✨|⭐/).length).toBe(0);
  });
});

describe("SoundsGame tile accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes localized names to screen readers on tiles across languages", () => {
    for (const lang of ["en", "ja", "cmn", "yue"] as const) {
      const { unmount } = render(
        <SoundsGame onHome={() => {}} difficulty="easy" lang={lang} />,
      );
      const tiles = screen.getAllByTestId(/^sounds-tile-/);
      expect(tiles.length).toBeGreaterThan(0);
      for (const tile of tiles) {
        const label = tile.getAttribute("aria-label");
        expect(label).toBeTruthy();
        const entry = WORDS.find((w) => wordFor(w, lang).text === label);
        expect(entry).toBeDefined();
        if (lang !== "en") {
          // Non-English mode must not expose raw developer icon keys
          expect(label).not.toBe(entry!.icon);
        }
      }
      unmount();
    }
  });
});
