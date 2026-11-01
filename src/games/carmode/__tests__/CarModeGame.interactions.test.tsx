// @vitest-environment happy-dom
import React, { useState } from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import * as sound from "../../../sound";
import * as music from "../../../music";
import * as logic from "../logic";
import { ALL_PACKS, PACK_ORDER } from "../packs";
import { t, UIKey } from "../../../i18n";
import { CarModeGame } from "../CarModeGame";

const noop = () => {};

const renderAndStart = (ui: React.ReactElement) => {
  const result = render(ui);
  if (screen.queryByText("▶️")) {
    const origNow = Date.now;
    Date.now = () => origNow() - 500;
    try {
      fireEvent.click(screen.getByTestId("carmode-tap"));
    } finally {
      Date.now = origNow;
    }
  }
  return result;
};

describe("CarModeGame interactions", () => {
  let activeCancel: (() => void) | null = null;

  beforeEach(() => {
    activeCancel = null;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, bpm, onNote, onDone) => {
        const beatSec = 60 / bpm;
        const timers: ReturnType<typeof setTimeout>[] = [];
        let cancelled = false;
        let offset = 0;
        for (let i = 0; i < notes.length; i++) {
          if (onNote) {
            const idx = i;
            const ms = Math.max(0, (0.05 + offset) * 1000);
            timers.push(
              setTimeout(() => {
                if (!cancelled) onNote(idx);
              }, ms),
            );
          }
          offset += notes[i].b * beatSec;
        }
        if (onDone) {
          const endMs = Math.max(0, (0.05 + offset) * 1000);
          timers.push(
            setTimeout(() => {
              if (!cancelled) onDone();
            }, endMs),
          );
        }
        const cancel = () => {
          cancelled = true;
          for (const t of timers) clearTimeout(t);
        };
        activeCancel = cancel;
        return cancel;
      },
    );
    vi.spyOn(music, "stopSequence").mockImplementation(() => {
      if (activeCancel) {
        activeCancel();
        activeCancel = null;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    cleanup();
  });

  it("calls startRound on mount and advances to gap on audio completion", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "sayThen").mockImplementation((_text, cb) => {
      setTimeout(cb, 100);
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Listen...")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText("Your turn!")).toBeDefined();
  });

  it("handles standard packs without boops delay", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "sayThen").mockImplementation((_text, cb) => {
      setTimeout(cb, 100);
    });

    const actual = logic.startState("silly", 42);
    vi.spyOn(logic, "startState").mockReturnValue(actual);

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Listen...")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Your turn!")).toBeDefined();
  });

  it("allows user taps during prompt phase to advance directly to gap", () => {
    const actual = logic.startState("silly", 42);
    vi.spyOn(logic, "startState").mockReturnValue(actual);

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Listen...")).toBeDefined();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("Your turn!")).toBeDefined();
  });

  it("ignores tap during prompt phase for boops to prevent skipping sequence", () => {
    vi.useFakeTimers();
    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_t, cb) => {
      sayThenCb = cb;
    });
    const stopSequenceSpy = vi.spyOn(music, "stopSequence");

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "prompt",
      rounds: [
        {
          id: "test-boops-5",
          pack: "boops",
          noteCount: 5,
          prompt: ["boops.count5"],
          reveal: ["boops.reveal5"],
          sfx: "good",
          gapMs: 3000,
        },
      ],
      roundIdx: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Invoke sayThen callback to start boops
    act(() => {
      sayThenCb?.();
    });

    // At t = 50ms: note 0 fires, visual flash cue is active with 🎵
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("carmode-boop-flash")).toBeDefined();
    expect(screen.getByText("🎵")).toBeDefined();

    // At t = 250ms: flash has cleared between notes
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId("carmode-boop-flash")).toBeNull();
    expect(screen.getByText("👂")).toBeDefined();

    // Advance 200ms more (t = 450ms): note 1 fires; past PHASE_DEBOUNCE_MS (400ms).
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("carmode-boop-flash")).toBeDefined();

    // Tap to skip prompt phase (now ignored for boops)
    const tapBtn = screen.getByTestId("carmode-tap");
    act(() => {
      fireEvent.click(tapBtn);
    });

    expect(screen.getByText("Listen...")).toBeDefined();
    expect(stopSequenceSpy).toHaveBeenCalledTimes(1);
  });

  it("advances round immediately on single tap during reveal phase for twoTapAnswer pack", () => {
    vi.spyOn(sound, "saySequence").mockReturnValue();
    vi.spyOn(sound, "sayThen").mockReturnValue();
    vi.spyOn(sound, "stopNarration").mockReturnValue();

    const actual = logic.startState("silly", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
      pendingTaps: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Tap!")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("1/24");

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("Listen...")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/24");
  });

  it("resets celebratory confetti when switching packs after completion", () => {
    const initial = logic.startState("boops", 42);
    const lastRoundState: logic.CarModeState = {
      ...initial,
      roundIdx: initial.rounds.length - 1,
      phase: "reveal",
    };
    vi.spyOn(logic, "startState").mockReturnValueOnce(lastRoundState);

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.queryAllByText("🎉")).toHaveLength(0);

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("All done!")).toBeDefined();
    expect(screen.queryAllByText("🎉").length).toBeGreaterThan(0);

    const rhymeBtn = screen.getByTestId("carmode-pack-rhyme");
    fireEvent.click(rhymeBtn);

    expect(screen.queryByText("All done!")).toBeNull();
    expect(screen.queryAllByText("🎉")).toHaveLength(0);
  });

  it("displays localized phase text in Japanese when advancing from prompt to gap", () => {
    const actual = logic.startState("silly", 42);
    vi.spyOn(logic, "startState").mockReturnValue(actual);

    renderAndStart(<CarModeGame onHome={noop} lang="ja" />);

    expect(screen.getByText("きいてね…")).toBeDefined();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("きみの ばん！")).toBeDefined();
  });

  it("exposes localized phase text to screen readers on main button without hardcoded English label", () => {
    renderAndStart(<CarModeGame onHome={noop} lang="ja" />);

    expect(
      screen.queryByRole("button", { name: "Tap to continue" }),
    ).toBeNull();
    const tapBtn = screen.getByRole("button", { name: /きいてね/ });
    expect(tapBtn).toBeDefined();
    expect(tapBtn.getAttribute("data-testid")).toBe("carmode-tap");
  });

  it.each([
    { lang: "ja", expected: "タップ！" },
    { lang: "cmn", expected: "点一点！" },
    { lang: "yue", expected: "撳一撳！" },
  ] as const)(
    "localizes reveal button text for $lang",
    ({ lang, expected }) => {
      const actual = logic.startState("silly", 42);
      vi.spyOn(logic, "startState").mockReturnValue({
        ...actual,
        phase: "reveal",
        pendingTaps: 0,
      });

      renderAndStart(<CarModeGame onHome={noop} lang={lang} />);
      const tapBtn = screen.getByTestId("carmode-tap");
      expect(within(tapBtn).getByText(expected)).toBeDefined();
      expect(within(tapBtn).queryByText("Tap!")).toBeNull();
    },
  );

  it.each([
    { lang: "ja", expected: "おしまい！" },
    { lang: "cmn", expected: "全部完成！" },
    { lang: "yue", expected: "全部搞掂！" },
  ] as const)(
    "localizes completion screen text and pack buttons for $lang",
    ({ lang, expected }) => {
      const actual = logic.startState("boops", 42);
      vi.spyOn(logic, "startState").mockReturnValue({
        ...actual,
        phase: "done",
      });

      renderAndStart(<CarModeGame onHome={noop} lang={lang} />);
      expect(screen.getByText(expected)).toBeDefined();
      expect(screen.queryByText("All done!")).toBeNull();

      for (const packId of PACK_ORDER) {
        const localizedName = t(lang, `carmode.pack.${packId}` as UIKey);
        const englishName = ALL_PACKS[packId].name;
        const btn = screen.getByTestId(`carmode-pack-${packId}`);
        expect(within(btn).getByText(localizedName)).toBeDefined();
        expect(within(btn).queryByText(englishName)).toBeNull();
        expect(btn.getAttribute("aria-label")).toBe(localizedName);
        expect(btn.getAttribute("aria-label")).not.toBe(englishName);
      }
    },
  );

  it("safely restarts round and stops narration when language is switched mid-round", () => {
    vi.useFakeTimers();
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const sayThenSpy = vi
      .spyOn(sound, "sayThen")
      .mockImplementation((_text, cb) => {
        setTimeout(cb, 100);
      });

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      roundIdx: 1,
    });

    function LangHarness({ initialLang = "en" }: { initialLang?: Lang }) {
      const [lang, setLang] = useState<Lang>(initialLang);
      const cycleLang = () => {
        setLang((l) =>
          l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
        );
      };
      return (
        <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
          <CarModeGame onHome={noop} lang={lang} />
        </LangContext.Provider>
      );
    }

    renderAndStart(<LangHarness initialLang="en" />);

    expect(screen.getByText("Car Mode")).toBeDefined();
    expect(screen.getByText("Listen...")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");

    stopNarrationSpy.mockClear();
    sayThenSpy.mockClear();

    // Switch language to Japanese mid-round via in-game header chip
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // Old narration is immediately stopped
    expect(stopNarrationSpy).toHaveBeenCalled();

    // UI and prompt are reset to the new language without losing progress
    expect(screen.getByText("くるまモード")).toBeDefined();
    expect(screen.getByText("きいて こたえて タップ！")).toBeDefined();
    expect(screen.getByText("きいてね…")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");

    // Advance fake timers: prompt plays and sayThen finishes
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Prompt was re-spoken for round 2
    expect(sayThenSpy).toHaveBeenCalledWith(
      ["How many boops?"],
      expect.any(Function),
    );

    // Advances to Japanese gap phase exactly once, still on round 2/10
    expect(screen.getByText("きみの ばん！")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");
  });

  it("resets to prompt phase and clears gap timer when switching language during gap phase", () => {
    vi.useFakeTimers();
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const sayThenSpy = vi
      .spyOn(sound, "sayThen")
      .mockImplementation((_text, cb) => {
        setTimeout(cb, 100);
      });

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      roundIdx: 1,
    });

    function LangHarness({ initialLang = "en" }: { initialLang?: Lang }) {
      const [lang, setLang] = useState<Lang>(initialLang);
      const cycleLang = () => {
        setLang((l) =>
          l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
        );
      };
      return (
        <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
          <CarModeGame onHome={noop} lang={lang} />
        </LangContext.Provider>
      );
    }

    renderAndStart(<LangHarness initialLang="en" />);

    // Advance to gap phase by waiting out boops sequence
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");
    expect(screen.getByText("Your turn!")).toBeDefined();

    stopNarrationSpy.mockClear();
    sayThenSpy.mockClear();

    // Switch language to Japanese during gap phase
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // Narration stops, gap timer is cleared, and state restarts to prompt phase in Japanese
    expect(stopNarrationSpy).toHaveBeenCalled();
    expect(screen.getByText("きいてね…")).toBeDefined();
    expect(screen.queryByText("きみの ばん！")).toBeNull();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");

    // Advance fake timers: prompt plays and sayThen finishes
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Prompt was re-spoken for round 2
    expect(sayThenSpy).toHaveBeenCalledWith(
      ["How many boops?"],
      expect.any(Function),
    );

    // Advances to Japanese gap phase exactly once, still on round 2/10
    expect(screen.getByText("きみの ばん！")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");
  });

  it("switches packs cleanly on completion screen without double restarting", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const startStateSpy = vi.spyOn(logic, "startState");
    const initial = logic.startState("boops", 42);
    const doneState: logic.CarModeState = {
      ...initial,
      phase: "done",
    };
    startStateSpy.mockReturnValue(doneState);

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);
    expect(screen.getByText("All done!")).toBeDefined();

    stopNarrationSpy.mockClear();
    startStateSpy.mockClear();

    const rhymeBtn = screen.getByTestId("carmode-pack-rhyme");
    fireEvent.click(rhymeBtn);

    // switchPack should only be called once by the click handler, not re-triggered by an effect
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
    expect(startStateSpy).toHaveBeenCalledOnce();
    expect(startStateSpy).toHaveBeenCalledWith("rhyme", expect.any(Number));
  });

  it("ignores rapid taps when transitioning to reveal phase to prevent cutting off reveal audio", () => {
    vi.useFakeTimers();
    const saySequenceSpy = vi.spyOn(sound, "saySequence").mockReturnValue();
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");

    const actual = logic.startState("silly", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
      pendingTaps: 1,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);
    const tapBtn = screen.getByTestId("carmode-tap");

    // Advance past debounce window
    act(() => {
      vi.advanceTimersByTime(400);
    });

    stopNarrationSpy.mockClear();

    // Tap completes twoTapAnswer and enters reveal phase
    fireEvent.click(tapBtn);
    expect(screen.getByText("Tap!")).toBeDefined();
    expect(saySequenceSpy).toHaveBeenCalled();
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    // Rapid double-tap 50ms later must be ignored so it does not cancel reveal audio
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.click(tapBtn);

    // Stays in reveal phase on round 1/24 without cutting off audio
    expect(screen.getByText("Tap!")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("1/24");
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    // After debounce window (another 350ms to reach 400ms total), next tap advances to prompt
    act(() => {
      vi.advanceTimersByTime(350);
    });
    fireEvent.click(tapBtn);

    expect(screen.getByText("Listen...")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/24");
    expect(stopNarrationSpy).toHaveBeenCalled();
  });

  it("allows rapid second tap in twoTapAnswer gap phase but ignores subsequent rapid tap in reveal", () => {
    vi.useFakeTimers();
    const saySequenceSpy = vi.spyOn(sound, "saySequence").mockReturnValue();
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");

    const actual = logic.startState("silly", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
      pendingTaps: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);
    const tapBtn = screen.getByTestId("carmode-tap");

    // Advance past initial debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    stopNarrationSpy.mockClear();

    // First tap in gap for twoTapAnswer round: sets pendingTaps to 1
    fireEvent.click(tapBtn);
    expect(screen.getByText("Your turn!")).toBeDefined();

    // Rapid second tap 100ms later (answering silly statement) must be accepted
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(tapBtn);

    // Enters reveal phase
    expect(screen.getByText("Tap!")).toBeDefined();
    expect(saySequenceSpy).toHaveBeenCalled();
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    // Rapid third tap 50ms later must be ignored by reveal debounce
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.click(tapBtn);

    // Still in reveal phase, audio has not been stopped
    expect(screen.getByText("Tap!")).toBeDefined();
    expect(stopNarrationSpy).not.toHaveBeenCalled();
  });

  it("auto-advances to next round in reveal phase after speech completes without manual tap", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "saySequence").mockImplementation((_texts, onDone) => {
      setTimeout(() => onDone?.(), 1000);
    });

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
      pendingTaps: 0,
      roundIdx: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Tap!")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("1/10");

    // 1000ms: reveal speech finishes, starting the 3500ms auto-advance delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Tap!")).toBeDefined();

    // 3500ms: auto-advance delay completes, advancing hands-free to round 2
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(screen.getByText("Listen...")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");
  });

  it("auto-advances to completion screen on last round in reveal phase hands-free", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "saySequence").mockImplementation((_texts, onDone) => {
      setTimeout(() => onDone?.(), 500);
    });

    const initial = logic.startState("boops", 42);
    const lastRoundState: logic.CarModeState = {
      ...initial,
      roundIdx: initial.rounds.length - 1,
      phase: "reveal",
    };
    vi.spyOn(logic, "startState").mockReturnValueOnce(lastRoundState);

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Tap!")).toBeDefined();
    expect(screen.queryByText("All done!")).toBeNull();

    // Advance through speech (500ms) + auto-advance delay (3500ms)
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText("All done!")).toBeDefined();
  });

  it("auto-advances via safety cap timer if reveal speech onDone does not fire", () => {
    vi.useFakeTimers();
    // saySequence mock does not invoke callback (simulating blocked audio or autoplay restriction)
    vi.spyOn(sound, "saySequence").mockReturnValue();

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
      pendingTaps: 0,
      roundIdx: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Tap!")).toBeDefined();

    // Advance past safety cap (4000ms) + auto-advance delay (3500ms) = 7500ms
    act(() => {
      vi.advanceTimersByTime(7500);
    });

    expect(screen.getByText("Listen...")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");
  });

  it("cancels reveal auto-advance timer when manual tap occurs", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "saySequence").mockImplementation((_texts, onDone) => {
      setTimeout(() => onDone?.(), 500);
    });

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
      pendingTaps: 0,
      roundIdx: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Advance 500ms past speech and debounce
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Manually tap to advance early
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("Listen...")).toBeDefined();
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");

    // Advance past the remaining time of the old auto-advance timer
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Still on round 2 (not accidentally skipped to round 3)
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");
  });

  it("advances to reveal when tapped during gap phase for standard packs", () => {
    vi.useFakeTimers();
    const saySequenceSpy = vi.spyOn(sound, "saySequence").mockReturnValue();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();

    const actual = logic.startState("rhyme", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    sayThenSpy.mockClear();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("Tap!")).toBeDefined();
    expect(saySequenceSpy).toHaveBeenCalledWith(
      actual.rounds[0].reveal,
      expect.any(Function),
    );
    expect(sayThenSpy).not.toHaveBeenCalled();
  });

  it("repeated taps during gap phase advance to reveal and do not trap player in prompt replay", () => {
    vi.useFakeTimers();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();

    const actual = logic.startState("rhyme", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    sayThenSpy.mockClear();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);
    fireEvent.click(tapBtn);
    fireEvent.click(tapBtn);

    expect(screen.getByText("Tap!")).toBeDefined();
    expect(screen.queryByText("Your turn!")).toBeNull();
    expect(sayThenSpy).not.toHaveBeenCalled();
  });

  it("scales total rounds based on difficulty prop", () => {
    renderAndStart(<CarModeGame onHome={noop} lang="en" difficulty="easy" />);
    expect(screen.getByTestId("carmode-score").textContent).toContain("1/3");
  });

  it("advances to reveal when tapped during gap phase for boops pack", () => {
    vi.useFakeTimers();
    const saySequenceSpy = vi.spyOn(sound, "saySequence").mockReturnValue();

    const actual = logic.startState("boops", 42);
    const testRounds = [...actual.rounds];
    testRounds[0] = { ...testRounds[0], noteCount: 2 };
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      rounds: testRounds,
      phase: "gap",
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("Tap!")).toBeDefined();
    expect(saySequenceSpy).toHaveBeenCalledWith(
      testRounds[0].reveal,
      expect.any(Function),
    );
  });

  it("calls playSequence with pentatonic notes at 150 BPM for boops pack", () => {
    vi.useFakeTimers();
    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_t, cb) => {
      sayThenCb = cb;
    });
    const playSequenceSpy = vi.spyOn(music, "playSequence");
    const actual = logic.startState("boops", 42);
    const testRounds = [...actual.rounds];
    testRounds[0] = { ...testRounds[0], noteCount: 3 };
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      rounds: testRounds,
      phase: "prompt",
      roundIdx: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Invoke sayThen callback to start boops
    act(() => {
      sayThenCb?.();
    });

    expect(playSequenceSpy).toHaveBeenCalledWith(
      [
        { m: 60, b: 1 },
        { m: 62, b: 1 },
        { m: 64, b: 1 },
      ],
      150,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("renders visual boop cues when muted satisfying R3 constraint", () => {
    vi.useFakeTimers();
    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_t, cb) => {
      sayThenCb = cb;
    });
    sound.setMuted(true);

    const actual = logic.startState("boops", 42);
    const testRounds = [...actual.rounds];
    testRounds[0] = { ...testRounds[0], noteCount: 2 };
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      rounds: testRounds,
      phase: "prompt",
      roundIdx: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Invoke sayThen callback to start boops
    act(() => {
      sayThenCb?.();
    });

    // Note 0 visual cue at 50ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("carmode-boop-flash")).toBeDefined();
    expect(screen.getByText("🎵")).toBeDefined();

    // Cue clears between notes
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId("carmode-boop-flash")).toBeNull();
    expect(screen.getByText("👂")).toBeDefined();

    // Note 1 visual cue at 450ms
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("carmode-boop-flash")).toBeDefined();
    expect(screen.getByText("🎵")).toBeDefined();

    sound.setMuted(false);
  });

  it("advances to reveal immediately on gap tap without waiting for gapMs timer", () => {
    vi.useFakeTimers();

    const actual = logic.startState("rhyme", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    // Reaches reveal phase immediately on tap, without waiting for gapMs
    expect(screen.getByText("Tap!")).toBeDefined();
  });
  it("plays correct feedback sound based on silly round answer", () => {
    vi.useFakeTimers();
    const goodSpy = vi.spyOn(sound.sfx, "good");
    const boingSpy = vi.spyOn(sound.sfx, "boing");

    const actual = logic.startState("silly", 42);
    // Find a round where answer is true (1 tap) and false (2 taps)
    const trueRoundIndex = actual.rounds.findIndex((r) => r.answer === true);
    const falseRoundIndex = actual.rounds.findIndex((r) => r.answer === false);

    // Test correct 1-tap answer
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      roundIdx: trueRoundIndex,
      phase: "gap",
      pendingTaps: 0,
    });

    const { unmount } = renderAndStart(<CarModeGame onHome={noop} lang="en" />);
    const tapBtn = screen.getByTestId("carmode-tap");

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // 1 tap for true
    fireEvent.click(tapBtn);

    // Wait for TAP_WINDOW_MS timeout
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(goodSpy).toHaveBeenCalled();
    expect(boingSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("carmode-emoji-right")).toBeDefined();
    expect(screen.getByText("⭐️")).toBeDefined();

    unmount();
    goodSpy.mockClear();
    boingSpy.mockClear();

    // Test incorrect 1-tap answer (should be 2 taps)
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      roundIdx: falseRoundIndex, // answer is false (Silly), wants 2 taps
      phase: "gap",
      pendingTaps: 0,
    });

    const { unmount: unmount2 } = renderAndStart(
      <CarModeGame onHome={noop} lang="en" />,
    );
    const tapBtn2 = screen.getByTestId("carmode-tap");

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // 1 tap for false answer -> should play boing
    fireEvent.click(tapBtn2);

    // Wait for TAP_WINDOW_MS timeout
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(boingSpy).toHaveBeenCalled();
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("carmode-emoji-wrong")).toBeDefined();
    expect(screen.getByText("🔄")).toBeDefined();

    unmount2();
    goodSpy.mockClear();
    boingSpy.mockClear();

    // Test correct 2-tap answer for silly round
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      roundIdx: falseRoundIndex, // answer is false (Silly), wants 2 taps
      phase: "gap",
      pendingTaps: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);
    const tapBtn3 = screen.getByTestId("carmode-tap");

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // 2 taps for false answer
    fireEvent.click(tapBtn3);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(tapBtn3);

    expect(goodSpy).toHaveBeenCalled();
    expect(boingSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("carmode-emoji-right")).toBeDefined();
    expect(screen.getByText("⭐️")).toBeDefined();

    cleanup();
    goodSpy.mockClear();
    boingSpy.mockClear();

    // Test 0-tap timeout answer for silly round: reveals with round sfx, not penalized as wrong
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      roundIdx: falseRoundIndex,
      phase: "gap",
      pendingTaps: 0,
    });

    renderAndStart(<CarModeGame onHome={noop} lang="en" />);

    // Advance through the entire gap time with 0 taps
    act(() => {
      vi.advanceTimersByTime(actual.rounds[falseRoundIndex].gapMs + 100);
    });

    expect(boingSpy).toHaveBeenCalled();
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("carmode-emoji-wrong")).toBeNull();
    expect(screen.queryByTestId("carmode-emoji-right")).toBeNull();
    expect(screen.getByText("👆")).toBeDefined();

    cleanup();
    goodSpy.mockClear();
    boingSpy.mockClear();

    // Test 0-tap timeout answer for true round: plays good chime, not penalized as wrong
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      roundIdx: trueRoundIndex,
      phase: "gap",
      pendingTaps: 0,
    });

    render(<CarModeGame onHome={noop} lang="en" />);

    act(() => {
      vi.advanceTimersByTime(actual.rounds[trueRoundIndex].gapMs + 100);
    });

    expect(goodSpy).toHaveBeenCalled();
    expect(boingSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("carmode-emoji-wrong")).toBeNull();
    expect(screen.queryByTestId("carmode-emoji-right")).toBeNull();
    expect(screen.getByText("👆")).toBeDefined();
  });
});
