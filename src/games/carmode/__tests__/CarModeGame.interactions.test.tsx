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
import { CarModeGame } from "../CarModeGame";

const noop = () => {};

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

    render(<CarModeGame onHome={noop} lang="en" />);

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

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Listen...")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Your turn!")).toBeDefined();
  });

  it("allows user taps during prompt phase to advance directly to gap", () => {
    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("Listen...")).toBeDefined();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("Your turn!")).toBeDefined();
  });

  it("clears in-flight boop notes and visual flash when skipping prompt phase by tapping", () => {
    vi.useFakeTimers();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();
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

    render(<CarModeGame onHome={noop} lang="en" />);

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

    // Tap to skip prompt phase and advance to gap phase.
    const tapBtn = screen.getByTestId("carmode-tap");
    act(() => {
      fireEvent.click(tapBtn);
    });

    expect(screen.getByText("Your turn!")).toBeDefined();
    expect(stopSequenceSpy).toHaveBeenCalled();
    expect(screen.queryByTestId("carmode-boop-flash")).toBeNull();

    // Advance through gap and reveal duration.
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // In-flight boop note timers must NOT continue firing in gap or reveal phases.
    expect(screen.queryByTestId("carmode-boop-flash")).toBeNull();
    expect(sayThenSpy).not.toHaveBeenCalled();
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

    render(<CarModeGame onHome={noop} lang="en" />);

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

    render(<CarModeGame onHome={noop} lang="en" />);

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
    render(<CarModeGame onHome={noop} lang="ja" />);

    expect(screen.getByText("きいてね…")).toBeDefined();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(screen.getByText("きみの ばん！")).toBeDefined();
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

      render(<CarModeGame onHome={noop} lang={lang} />);
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
    "localizes completion screen text for $lang",
    ({ lang, expected }) => {
      const actual = logic.startState("boops", 42);
      vi.spyOn(logic, "startState").mockReturnValue({
        ...actual,
        phase: "done",
      });

      render(<CarModeGame onHome={noop} lang={lang} />);
      expect(screen.getByText(expected)).toBeDefined();
      expect(screen.queryByText("All done!")).toBeNull();
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

    render(<LangHarness initialLang="en" />);

    // Advance to round 2
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    fireEvent.click(tapBtn);

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

    render(<LangHarness initialLang="en" />);

    // Advance to round 2, then to gap phase
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    fireEvent.click(tapBtn);
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");

    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.click(tapBtn);
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

    render(<CarModeGame onHome={noop} lang="en" />);
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

    render(<CarModeGame onHome={noop} lang="en" />);
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

    render(<CarModeGame onHome={noop} lang="en" />);
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

    render(<CarModeGame onHome={noop} lang="en" />);

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

    render(<CarModeGame onHome={noop} lang="en" />);

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

    render(<CarModeGame onHome={noop} lang="en" />);

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

    render(<CarModeGame onHome={noop} lang="en" />);

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

  it("replays spoken prompt when tapped during gap phase for standard packs", () => {
    vi.useFakeTimers();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");

    const actual = logic.startState("rhyme", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
    });

    render(<CarModeGame onHome={noop} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    sayThenSpy.mockClear();
    stopNarrationSpy.mockClear();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(stopNarrationSpy).toHaveBeenCalled();
    expect(sayThenSpy).toHaveBeenCalledWith(
      actual.rounds[0].prompt,
      expect.any(Function),
    );
    expect(screen.getByText("Your turn!")).toBeDefined();
  });

  it("scales total rounds based on difficulty prop", () => {
    render(<CarModeGame onHome={noop} lang="en" difficulty="easy" />);
    expect(screen.getByTestId("carmode-score").textContent).toContain("1/3");
  });

  it("replays boops notes and prompt when tapped during gap phase for boops pack", () => {
    vi.useFakeTimers();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");

    const actual = logic.startState("boops", 42);
    const testRounds = [...actual.rounds];
    testRounds[0] = { ...testRounds[0], noteCount: 2 };
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      rounds: testRounds,
      phase: "gap",
    });

    render(<CarModeGame onHome={noop} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    sayThenSpy.mockClear();
    stopNarrationSpy.mockClear();

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(stopNarrationSpy).toHaveBeenCalled();
    expect(sayThenSpy).not.toHaveBeenCalled();

    // Advance 50ms: note 0 fires, visual flash triggers
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("carmode-boop-flash")).toBeDefined();
    expect(sayThenSpy).not.toHaveBeenCalled();

    // Advance 400ms: note 1 fires
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId("carmode-boop-flash")).toBeDefined();
    expect(sayThenSpy).not.toHaveBeenCalled();

    // Advance 400ms: sequence completes (onDone), prompt is spoken
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(sayThenSpy).toHaveBeenCalledWith(
      testRounds[0].prompt,
      expect.any(Function),
    );
    expect(screen.getByText("Your turn!")).toBeDefined();
  });

  it("calls playSequence with pentatonic notes at 150 BPM for boops pack", () => {
    vi.useFakeTimers();
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

    render(<CarModeGame onHome={noop} lang="en" />);

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

    render(<CarModeGame onHome={noop} lang="en" />);

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

  it("advances to reveal after gap tap even when audio is muted or sayThen completes via fallback", () => {
    vi.useFakeTimers();
    // In sound.ts, sayThen uses a 600ms fallback when muted
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, done) => {
      setTimeout(done, 600);
    });

    const actual = logic.startState("rhyme", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
    });

    render(<CarModeGame onHome={noop} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    // Advance through sayThen 600ms fallback + gapMs (3000ms)
    act(() => {
      vi.advanceTimersByTime(600 + actual.rounds[0].gapMs);
    });

    // Reaches reveal phase hands-free even with muted/stalled audio
    expect(screen.getByText("Tap!")).toBeDefined();
  });
});
