// @vitest-environment happy-dom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import * as music from "../../../music";
import * as logic from "../logic";
import { ALL_PACKS, PACK_ORDER } from "../packs";
import { CarModeGame } from "../CarModeGame";
import { t, UIKey } from "../../../i18n";

describe("CarModeGame", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("waits for user tap to prime music before playing first round sequence", () => {
    vi.useFakeTimers();
    const primeMusicSpy = vi.spyOn(music, "primeMusic").mockReturnValue();
    const playSequenceSpy = vi.spyOn(music, "playSequence").mockReturnValue(() => {});
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();

    const actual = logic.startState("boops", 42);
    // Ensure the first round is a boops round that plays a sequence
    const rounds = [...actual.rounds];
    rounds[0] = { ...rounds[0], noteCount: 4 };
    vi.spyOn(logic, "startState").mockReturnValue({ ...actual, rounds });

    render(<CarModeGame onHome={noop} lang="en" />);

    // Advance time to show that the sequence is NOT playing automatically on mount
    vi.advanceTimersByTime(500);

    expect(primeMusicSpy).not.toHaveBeenCalled();
    expect(playSequenceSpy).not.toHaveBeenCalled();
    expect(sayThenSpy).not.toHaveBeenCalled();
    expect(screen.getByText("▶️")).toBeDefined();

    // Now tap the start screen
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(primeMusicSpy).toHaveBeenCalled();
    expect(playSequenceSpy).toHaveBeenCalled();

    // Ensure primeMusic was called before playSequence
    const primeOrder = primeMusicSpy.mock.invocationCallOrder[0];
    const playOrder = playSequenceSpy.mock.invocationCallOrder[0];
    expect(primeOrder).toBeLessThan(playOrder);
  });

  it("renders initial prompt phase with start affordance, score chip and navigates home", () => {
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const primeMusicSpy = vi.spyOn(music, "primeMusic").mockReturnValue();
    const onHomeSpy = vi.fn();

    render(<CarModeGame onHome={onHomeSpy} lang="en" />);

    expect(screen.getByText("Car Mode")).toBeDefined();
    expect(screen.getByText("Listen, answer, and tap!")).toBeDefined();
    expect(screen.getByText("1/10")).toBeDefined();
    expect(screen.getByText("▶️")).toBeDefined();
    expect(screen.getByText("Tap!")).toBeDefined();

    const tapBtn = screen.getByTestId("carmode-tap");

    // Tapping the start screen starts the game
    fireEvent.click(tapBtn);
    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(primeMusicSpy).toHaveBeenCalledOnce();

    expect(screen.getByText("👂")).toBeDefined();
    expect(screen.getByText("Listen...")).toBeDefined();

    const backBtn = screen.getByTestId("back-button");
    fireEvent.click(backBtn);

    expect(sfxTapSpy).toHaveBeenCalledTimes(2);
    expect(onHomeSpy).toHaveBeenCalledOnce();
  });

  it("debounces rapid double taps on the start screen", () => {
    vi.useFakeTimers();
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    render(<CarModeGame onHome={noop} lang="en" />);

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);
    fireEvent.click(tapBtn); // Immediate second click

    expect(sfxTapSpy).toHaveBeenCalledOnce(); // Debounced
  });

  it("renders localized shell titles, subtitles, and instructions in supported languages", () => {
    const { unmount } = render(<CarModeGame onHome={noop} lang="ja" />);
    expect(screen.getByText("くるまモード")).toBeDefined();
    expect(screen.getByText("きいて こたえて タップ！")).toBeDefined();
    fireEvent.click(screen.getByTestId("carmode-tap"));
    expect(screen.getByText("きいてね…")).toBeDefined();
    unmount();

    const { unmount: unmountCmn } = render(
      <CarModeGame onHome={noop} lang="cmn" />,
    );
    expect(screen.getByText("车载模式")).toBeDefined();
    expect(screen.getByText("听，回答，点一点！")).toBeDefined();
    fireEvent.click(screen.getByTestId("carmode-tap"));
    expect(screen.getByText("听一听…")).toBeDefined();
    unmountCmn();

    render(<CarModeGame onHome={noop} lang="yue" />);
    expect(screen.getByText("車載模式")).toBeDefined();
    expect(screen.getByText("聽，答，撳一撳！")).toBeDefined();
    fireEvent.click(screen.getByTestId("carmode-tap"));
    expect(screen.getByText("聽下…")).toBeDefined();
  });

  it("renders localized phase instructions during gap phase across languages", () => {
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({ ...actual, phase: "gap" });

    const { unmount } = render(<CarModeGame onHome={noop} lang="ja" />);
    fireEvent.click(screen.getByTestId("carmode-tap"));
    expect(screen.getByText("きみの ばん！")).toBeDefined();
    unmount();

    const { unmount: unmountCmn } = render(
      <CarModeGame onHome={noop} lang="cmn" />,
    );
    fireEvent.click(screen.getByTestId("carmode-tap"));
    expect(screen.getByText("轮到你了！")).toBeDefined();
    unmountCmn();

    render(<CarModeGame onHome={noop} lang="yue" />);
    fireEvent.click(screen.getByTestId("carmode-tap"));
    expect(screen.getByText("到你喇！")).toBeDefined();
  });

  it("renders gap phase and plays sounds when tapped", () => {
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({ ...actual, phase: "gap" });

    render(<CarModeGame onHome={noop} lang="en" />);
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn); // Start screen tap

    // Now it's in gap phase
    expect(screen.getByText("🤔")).toBeDefined();
    expect(screen.getByText("Your turn!")).toBeDefined();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 500); // Advance time past debounce
    fireEvent.click(tapBtn); // Action tap
    expect(sfxTapSpy).toHaveBeenCalledTimes(2);
  });

  it("renders reveal phase and transitions to prompt on single tap for standard packs", () => {
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration").mockReturnValue();

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
    });

    render(<CarModeGame onHome={noop} lang="en" />);
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn); // Start screen tap

    expect(screen.getByText("👆")).toBeDefined();
    expect(screen.getByText("Tap!")).toBeDefined();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 500); // Advance time past debounce
    fireEvent.click(tapBtn); // Action tap

    expect(sfxTapSpy).toHaveBeenCalledTimes(2);
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
  });

  it("handles twoTapAnswer rounds by advancing immediately on single tap in reveal phase", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration").mockReturnValue();
    const actual = logic.startState("silly", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
      pendingTaps: 0,
    });

    render(<CarModeGame onHome={noop} lang="en" />);
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn); // Start screen tap

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 500); // Advance time past debounce
    fireEvent.click(tapBtn); // Action tap
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
  });

  it("renders completion screen with pack chooser and switches packs", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration").mockReturnValue();
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({ ...actual, phase: "done" });

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText("All done!")).toBeDefined();
    expect(screen.queryByTestId("carmode-tap")).toBeNull();

    // Verify all pack buttons are rendered with appropriate labels and styles
    for (const packId of PACK_ORDER) {
      const localizedName = t("en", `carmode.pack.${packId}` as UIKey);
      expect(screen.getByText(localizedName)).toBeDefined();
      
      const btn = screen.getByTestId(`carmode-pack-${packId}`);
      expect(btn).toBeDefined();
      expect(btn.getAttribute("role")).toBe("button");
      expect(btn.getAttribute("aria-label")).toBe(localizedName);
    }

    // Selecting a new pack switches packs and stops narration
    const rhymeBtn = screen.getByTestId("carmode-pack-rhyme");
    expect(rhymeBtn).toBeDefined();
    fireEvent.click(rhymeBtn);
    expect(stopNarrationSpy).toHaveBeenCalledOnce();
  });

  it.each(["ja", "cmn", "yue"] as const)(
    "renders localized completion screen pack buttons and accessibility labels in %s without hardcoded English",
    (lang) => {
      const actual = logic.startState("boops", 42);
      vi.spyOn(logic, "startState").mockReturnValue({
        ...actual,
        phase: "done",
      });

      const { unmount } = render(<CarModeGame onHome={noop} lang={lang} />);
      expect(screen.getByText(t(lang, "carmode.done"))).toBeDefined();

      for (const packId of PACK_ORDER) {
        const localizedName = t(lang, `carmode.pack.${packId}` as UIKey);
        const englishName = ALL_PACKS[packId].name;

        expect(screen.getByText(localizedName)).toBeDefined();
        if (englishName !== localizedName) {
            expect(screen.queryByText(englishName)).toBeNull();
        }

        const btn = screen.getByTestId(`carmode-pack-${packId}`);
        expect(btn).toBeDefined();
        expect(btn.getAttribute("role")).toBe("button");
        expect(btn.getAttribute("aria-label")).toBe(localizedName);
        expect(btn.getAttribute("aria-label")).not.toBe(englishName);
      }
      unmount();
    },
  );

  it("ignores taps when already complete", () => {
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const advanceSpy = vi.spyOn(logic, "advance");

    // Render with phase reveal to capture the tap button
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
    });
    render(<CarModeGame onHome={noop} lang="en" />);

    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn); // Start screen tap

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 500); // Advance time past debounce
    vi.spyOn(logic, "isComplete").mockReturnValue(true);
    fireEvent.click(tapBtn); // Action tap

    expect(sfxTapSpy).toHaveBeenCalledTimes(2);
    expect(advanceSpy).not.toHaveBeenCalled();
  });
});
