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
import { describe, expect, it, vi, afterEach } from "vitest";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import * as sound from "../../../sound";
import * as logic from "../logic";
import { CarModeGame } from "../CarModeGame";

const noop = () => {};

describe("CarModeGame interactions", () => {
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
    fireEvent.click(tapBtn);
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
    fireEvent.click(tapBtn);
    fireEvent.click(tapBtn);
    expect(screen.getByTestId("carmode-score").textContent).toContain("2/10");

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
});
