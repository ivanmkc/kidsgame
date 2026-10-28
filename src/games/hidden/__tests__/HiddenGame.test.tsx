// @vitest-environment happy-dom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../../i18n";
import { manifest } from "../../../manifest";
import * as sound from "../../../sound";
import { Animated } from "react-native";
import { sfx } from "../../../sound";
import { HiddenGame } from "../HiddenGame";

describe("HiddenGame localization", () => {
  const noop = () => {};

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders TurnBanner with Japanese text and accessibilityLabel in 2P mode", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    // Enter 2-player mode via mode picker
    fireEvent.click(screen.getByTestId("mp-choose-2p"));

    const banner = screen.getByTestId("hidden-turn-banner");
    expect(banner).toBeDefined();
    expect(banner.getAttribute("aria-label")).toBe("きつねの ばん！");
    expect(screen.getByText(/きつねの ばん！/)).toBeDefined();
    expect(screen.queryByText(/Foxy's turn/)).toBeNull();
  });

  it("renders TurnBanner with English text in en mode", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    fireEvent.click(screen.getByTestId("mp-choose-2p"));

    const banner = screen.getByTestId("hidden-turn-banner");
    expect(banner).toBeDefined();
    expect(banner.getAttribute("aria-label")).toBe("Foxy's turn!");
    expect(screen.getByText(/Foxy's turn!/)).toBeDefined();
  });

  it("renders TurnBanner in Chinese and Cantonese", () => {
    const { unmount: unmountCmn } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    fireEvent.click(screen.getByTestId("mp-choose-2p"));
    expect(screen.getByText(/轮到狐狸了！/)).toBeDefined();
    unmountCmn();
    cleanup();

    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    fireEvent.click(screen.getByTestId("mp-choose-2p"));
    expect(screen.getByText(/到狐狸喇！/)).toBeDefined();
  });

  it("speaks localized narration cues for solo play and 2P turn changes", () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    // In scene picker with Japanese
    const { unmount: unmountPicker } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: "どこで さがす？" }),
    );
    unmountPicker();
    cleanup();
    speakSpy.mockClear();

    // In solo scene with Japanese
    const { unmount: unmountSolo } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "かくれてる ものを ぜんぶ みつけよう！",
      }),
    );
    unmountSolo();
    cleanup();
    speakSpy.mockClear();

    // In 2P scene with Japanese
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    fireEvent.click(screen.getByTestId("mp-choose-2p"));
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: "きつねの ばん！" }),
    );
  });

  it("does not speak intro prompts when mode is null (ModePicker is visible)", () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    // In picker with 2P enabled (mode === null)
    const { unmount: unmountPicker } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(screen.getByTestId("mode-picker")).toBeDefined();
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "mp.title") }),
    );
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "picker.hidden") }),
    );

    // Choosing solo speaks the picker prompt
    speakSpy.mockClear();
    fireEvent.click(screen.getByTestId("mp-choose-1p"));
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "picker.hidden") }),
    );

    unmountPicker();
    cleanup();
    speakSpy.mockClear();

    // In active scene with 2P enabled (mode === null)
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(screen.getByTestId("mode-picker")).toBeDefined();
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "mp.title") }),
    );
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "hidden.prompt") }),
    );

    // Choosing solo speaks the game prompt
    speakSpy.mockClear();
    fireEvent.click(screen.getByTestId("mp-choose-1p"));
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "hidden.prompt") }),
    );
  });

  it("renders TapScene targets with localized accessibilityLabel in active scene", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const targets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("hidden-target-"),
      );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.getAttribute("aria-label")).toBe(t("ja", "a11y.target"));
    }
  });

  it("renders checklist chips with accessibilityRole image and localized accessibilityLabel", () => {
    const { unmount } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const checklist = screen.getByTestId("hidden-checklist");
    const chips = Array.from(
      checklist.querySelectorAll('[data-testid^="checklist-"]'),
    ).filter((el) => !el.getAttribute("data-testid")?.includes("-finder"));

    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.getAttribute("role")).toBe("img");
      expect(chip.getAttribute("aria-label")).toBe(t("ja", "a11y.target"));
    }

    const firstId = chips[0]
      .getAttribute("data-testid")!
      .replace("checklist-", "");
    fireEvent.click(screen.getByTestId(`hidden-target-${firstId}`));

    expect(chips[0].getAttribute("aria-label")).toBe(
      t("ja", "a11y.targetFound"),
    );

    unmount();
    cleanup();

    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const enChecklist = screen.getByTestId("hidden-checklist");
    const enChips = Array.from(
      enChecklist.querySelectorAll('[data-testid^="checklist-"]'),
    ).filter((el) => !el.getAttribute("data-testid")?.includes("-finder"));

    expect(enChips.length).toBeGreaterThan(0);
    expect(enChips[0].getAttribute("role")).toBe("img");
    expect(enChips[0].getAttribute("aria-label")).toBe("Target");

    const enFirstId = enChips[0]
      .getAttribute("data-testid")!
      .replace("checklist-", "");
    fireEvent.click(screen.getByTestId(`hidden-target-${enFirstId}`));

    expect(enChips[0].getAttribute("aria-label")).toBe("Target, found");
  });
});

describe("HiddenGame gentle auto-hint", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it("triggers a visual hint on an unfound target after 15 seconds of inactivity in solo mode", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("hidden-target-"),
      );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(14999);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    const hinted = targets.filter((t) => t.children.length > 0);
    expect(hinted.length).toBe(1);
  });

  it("clears the hint after its 2.5-second duration", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("hidden-target-"),
      );

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(targets.filter((t) => t.children.length > 0).length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);
  });

  it("resets the 15-second inactivity timer when a target is found", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("hidden-target-"),
      );
    expect(targets.length).toBeGreaterThan(1);

    // Wait 10 seconds (no hint yet)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    // Find the first checklist target
    const firstChecklistId = screen
      .getAllByTestId(/^checklist-/)
      .map((el) =>
        el.getAttribute("data-testid")!.replace("checklist-", ""),
      )[0];
    const targetToFind = screen.getByTestId(
      `hidden-target-${firstChecklistId}`,
    );
    fireEvent.click(targetToFind);

    // Target is now found (has FoundRing)
    expect(targetToFind.children.length).toBeGreaterThan(0);

    const remaining = targets.filter((t) => t !== targetToFind);

    // Advance 10 more seconds (20 seconds since game start, but 10 seconds since hit)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(remaining.every((t) => t.children.length === 0)).toBe(true);

    // Advance 5 more seconds (15 seconds since hit) -> hint appears on one of the remaining targets
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(remaining.filter((t) => t.children.length > 0).length).toBe(1);
  });

  it("does not trigger visual hints on hard difficulty after 15 seconds of inactivity", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="hard"
        filter="hard"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("hidden-target-"),
      );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);
  });
});

describe("HiddenGame difficulty settings", () => {
  const noop = () => {};

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("applies easy settings and hides timer when easy filter is selected even if parent difficulty is hard", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="hard"
        filter="easy"
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    expect(screen.queryByTestId("hidden-timer")).toBeNull();
    expect(screen.getByTestId("hidden-score").textContent).toContain("0/5");
  });
});

describe("HiddenGame scene target hitboxes and omitted target guidance", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it("registers hitboxes for all targets present in scene artwork including those omitted from checklist", () => {
    const jungleScene = manifest.hidden.find((h) => h.id === "jungle")!;
    expect(jungleScene.targets.length).toBe(6);

    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId={jungleScene.id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    // Easy mode draws 5 checklist items
    const checklistItems = jungleScene.targets.filter(
      (t) => screen.queryByTestId(`checklist-${t.id}`) !== null,
    );
    expect(checklistItems.length).toBe(5);

    // 1 target is omitted from the checklist
    const omittedTargets = jungleScene.targets.filter(
      (t) => screen.queryByTestId(`checklist-${t.id}`) === null,
    );
    expect(omittedTargets.length).toBe(1);

    // Hitboxes exist for all 6 targets in the artwork, including the omitted one
    for (const target of jungleScene.targets) {
      const button = screen.getByTestId(`hidden-target-${target.id}`);
      expect(button).toBeDefined();
      expect(button.getAttribute("role")).toBe("button");
    }
  });

  it("acknowledges omitted targets with sfx.tap and instructional guidance without advancing finds", () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    const goodSpy = vi.spyOn(sfx, "good");
    const tapSpy = vi.spyOn(sfx, "tap");
    const saySpy = vi.spyOn(sound, "say");

    const jungleScene = manifest.hidden.find((h) => h.id === "jungle")!;

    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        twoPlayerEnabled={false}
        sceneId={jungleScene.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const omittedTarget = jungleScene.targets.find(
      (t) => screen.queryByTestId(`checklist-${t.id}`) === null,
    )!;
    const drawnTarget = jungleScene.targets.find(
      (t) => screen.queryByTestId(`checklist-${t.id}`) !== null,
    )!;

    expect(screen.getByTestId("hidden-score").textContent).toContain("0/5");

    goodSpy.mockClear();
    tapSpy.mockClear();
    saySpy.mockClear();

    // Tap the omitted target
    const omittedBtn = screen.getByTestId(`hidden-target-${omittedTarget.id}`);
    fireEvent.click(omittedBtn);

    // It plays tap and speaks guidance
    expect(tapSpy).toHaveBeenCalled();
    expect(goodSpy).not.toHaveBeenCalled();
    expect(saySpy).toHaveBeenCalledWith(t("ja", "hidden.prompt"));

    // Omitted target flashes a visual hint ring for players with sound off
    expect(screen.getByTestId("hidden-score").textContent).toContain("0/5");
    expect(omittedBtn.children.length).toBeGreaterThan(0);

    // The visual flash clears after 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(omittedBtn.children.length).toBe(0);

    // Now tap an active checklist target
    const drawnBtn = screen.getByTestId(`hidden-target-${drawnTarget.id}`);
    fireEvent.click(drawnBtn);

    // It plays good and updates score
    expect(goodSpy).toHaveBeenCalled();
    expect(screen.getByTestId("hidden-score").textContent).toContain("1/5");
    expect(drawnBtn.children.length).toBeGreaterThan(0);
  });

  it("in 2P co-op mode, tapping an omitted target does not advance player turn", () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    const goodSpy = vi.spyOn(sfx, "good");
    const tapSpy = vi.spyOn(sfx, "tap");
    const saySpy = vi.spyOn(sound, "say");

    // dinonest has 7 targets; in 2P easy, coopDrawCount(5, 7) draws 6 targets, leaving 1 omitted
    const dinoScene = manifest.hidden.find((h) => h.id === "dinonest")!;
    expect(dinoScene.targets.length).toBe(7);

    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        twoPlayerEnabled={true}
        sceneId={dinoScene.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    fireEvent.click(screen.getByTestId("mp-choose-2p"));

    const omittedTarget = dinoScene.targets.find(
      (t) => screen.queryByTestId(`checklist-${t.id}`) === null,
    )!;
    expect(omittedTarget).toBeDefined();

    const drawnTarget = dinoScene.targets.find(
      (t) => screen.queryByTestId(`checklist-${t.id}`) !== null,
    )!;

    // Turn starts on player 0 (Foxy)
    expect(
      screen.getByTestId("hidden-turn-banner").getAttribute("aria-label"),
    ).toBe("きつねの ばん！");
    expect(screen.getByTestId("hidden-score").textContent).toContain("0/6");

    goodSpy.mockClear();
    tapSpy.mockClear();
    saySpy.mockClear();

    // Tap omitted target
    const omittedBtn = screen.getByTestId(`hidden-target-${omittedTarget.id}`);
    fireEvent.click(omittedBtn);

    expect(tapSpy).toHaveBeenCalled();
    expect(goodSpy).not.toHaveBeenCalled();
    expect(saySpy).toHaveBeenCalledWith(t("ja", "hidden.prompt"));
    expect(screen.getByTestId("hidden-score").textContent).toContain("0/6");
    expect(
      screen.getByTestId("hidden-turn-banner").getAttribute("aria-label"),
    ).toBe("きつねの ばん！");

    // Tap active checklist target
    const drawnBtn = screen.getByTestId(`hidden-target-${drawnTarget.id}`);
    fireEvent.click(drawnBtn);

    expect(goodSpy).toHaveBeenCalled();
    expect(screen.getByTestId("hidden-score").textContent).toContain("1/6");
    expect(
      screen.getByTestId("hidden-turn-banner").getAttribute("aria-label"),
    ).toBe("うさぎの ばん！");
  });

  it("clears hint ring immediately if a valid checklist target is tapped before omitted flash timer expires", () => {
    const toyboxScene = manifest.hidden.find((h) => h.id === "toybox")!;
    expect(toyboxScene.targets.length).toBe(7);

    // Hard 2P mode has auto-hints disabled (hiddenHintSecs: Infinity)
    // and draws coopDrawCount(8, 7) = 6 targets, leaving 1 omitted target.
    render(
      <HiddenGame
        onHome={noop}
        difficulty="hard"
        filter="hard"
        twoPlayerEnabled={true}
        sceneId={toyboxScene.id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    fireEvent.click(screen.getByTestId("mp-choose-2p"));

    const omittedTarget = toyboxScene.targets.find(
      (t) => screen.queryByTestId(`checklist-${t.id}`) === null,
    )!;
    const drawnTarget = toyboxScene.targets.find(
      (t) => screen.queryByTestId(`checklist-${t.id}`) !== null,
    )!;

    const omittedBtn = screen.getByTestId(`hidden-target-${omittedTarget.id}`);
    const drawnBtn = screen.getByTestId(`hidden-target-${drawnTarget.id}`);

    // Tap omitted target -> visual HintRing flashes
    fireEvent.click(omittedBtn);
    expect(omittedBtn.children.length).toBeGreaterThan(0);

    // Before 1500ms timer elapses, tap a real checklist target
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.click(drawnBtn);

    // Omitted target hint ring must be cleared immediately, not stuck permanently
    expect(omittedBtn.children.length).toBe(0);

    // Advance time past the original 1500ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(omittedBtn.children.length).toBe(0);
  });
});

describe("HiddenGame mode picker on active scene", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it("does not run timer or auto-hint while ModePicker is open on an active scene", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        filter="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    // ModePicker modal is displayed
    expect(screen.getByTestId("mode-picker")).toBeDefined();

    // Timer ring is NOT displayed while awaiting player mode selection
    expect(screen.queryByTestId("hidden-timer")).toBeNull();

    // Advance time by 15 seconds (inactivity auto-hint delay and timer advance)
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // Timer remains not displayed and did not run
    expect(screen.queryByTestId("hidden-timer")).toBeNull();

    // Auto-hint did not trigger in the background
    const targets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("hidden-target-"),
      );
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    // Choosing solo starts the timer at 0:00 and begins auto-hint inactivity timer
    act(() => {
      fireEvent.click(screen.getByTestId("mp-choose-1p"));
    });

    const timer = screen.getByTestId("hidden-timer");
    expect(timer.textContent).toBe("0:00");

    // Advance by 3 seconds; timer advances to 0:03
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timer.textContent).toBe("0:03");

    // Advance by 12 more seconds (total 15s since solo picked); auto-hint triggers
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(targets.filter((t) => t.children.length > 0).length).toBe(1);
  });

  it("does not display timer when 2P mode is selected from ModePicker", () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        filter="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    expect(screen.getByTestId("mode-picker")).toBeDefined();
    expect(screen.queryByTestId("hidden-timer")).toBeNull();

    act(() => {
      fireEvent.click(screen.getByTestId("mp-choose-2p"));
    });

    // 2P coop mode does not show timer
    expect(screen.queryByTestId("hidden-timer")).toBeNull();
  });

  it("locks TapScene input and ignores backdrop taps when won", () => {
    const scene = manifest.hidden[0];
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene.id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const sequenceSpy = vi.spyOn(Animated, "sequence");

    // Before winning, backdrop tap triggers shake sequence
    fireEvent.click(screen.getByTestId("hidden-backdrop"));
    expect(sequenceSpy).toHaveBeenCalledTimes(1);
    sequenceSpy.mockClear();

    // Find all checklist targets to win
    const checklist = screen.getByTestId("hidden-checklist");
    const targets = Array.from(
      checklist.querySelectorAll('[data-testid^="checklist-"]'),
    )
      .map((el) => el.getAttribute("data-testid")!.replace("checklist-", ""))
      .filter((id) => !id.includes("-finder"));

    for (const id of targets) {
      fireEvent.click(screen.getByTestId(`hidden-target-${id}`));
    }

    expect(screen.getByTestId("win-overlay")).toBeDefined();

    // After winning, backdrop taps must not trigger shake
    fireEvent.click(screen.getByTestId("hidden-backdrop"));
    expect(sequenceSpy).not.toHaveBeenCalled();
  });

  it("displays localized scene names in ScenePicker cards and subtitle for non-English languages", () => {
    // Japanese
    const { unmount: unmountJa } = render(
      <HiddenGame
        onHome={noop}
        lang="ja"
        difficulty="medium"
        filter="all"
        twoPlayerEnabled={false}
        sceneId={undefined}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByText("ジャングル")).toBeDefined();
    unmountJa();

    // In-game subtitle in Japanese
    const { unmount: unmountSubJa } = render(
      <HiddenGame
        onHome={noop}
        lang="ja"
        difficulty="medium"
        filter="all"
        twoPlayerEnabled={false}
        sceneId="jungle"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByText(/ジャングル/)).toBeDefined();
    unmountSubJa();

    // In-game subtitle in Mandarin
    const { unmount: unmountSubCmn } = render(
      <HiddenGame
        onHome={noop}
        lang="cmn"
        difficulty="medium"
        filter="all"
        twoPlayerEnabled={false}
        sceneId="jungle"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByText(/丛林/)).toBeDefined();
    unmountSubCmn();

    // In-game subtitle in Cantonese
    const { unmount: unmountSubYue } = render(
      <HiddenGame
        onHome={noop}
        lang="yue"
        difficulty="medium"
        filter="all"
        twoPlayerEnabled={false}
        sceneId="jungle"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByText(/森林/)).toBeDefined();
    unmountSubYue();
  });

  it("provides valid nameT translations in ja, cmn, and yue for all hidden scenes", () => {
    expect(manifest.hidden.length).toBe(38);
    for (const scene of manifest.hidden) {
      expect(scene.nameT).toBeDefined();
      expect(scene.nameT?.ja).toBeTruthy();
      expect(scene.nameT?.cmn).toBeTruthy();
      expect(scene.nameT?.yue).toBeTruthy();
    }
  });
});

describe("HiddenGame scene picker surprise", () => {
  const noop = () => {};

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("picks a scene from visible pool when filter matches scenes", () => {
    const onPickScene = vi.fn();
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        filter="easy"
        twoPlayerEnabled={false}
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("scene-surprise"));
    expect(onPickScene).toHaveBeenCalledTimes(1);
    const pickedId = onPickScene.mock.calls[0][0];
    const pickedScene = manifest.hidden.find((h) => h.id === pickedId);
    expect(pickedScene?.level).toBe("easy");
  });

  it("falls back to manifest.hidden when filter matches no scenes", () => {
    const onPickScene = vi.fn();
    const originalHidden = manifest.hidden;
    manifest.hidden = [
      {
        ...originalHidden[0],
        level: "easy",
      },
    ];
    try {
      render(
        <HiddenGame
          onHome={noop}
          difficulty="medium"
          filter="hard"
          twoPlayerEnabled={false}
          onPickScene={onPickScene}
          onBackToPicker={noop}
        />,
      );
      fireEvent.click(screen.getByTestId("scene-surprise"));
      expect(onPickScene).toHaveBeenCalledWith(originalHidden[0].id);
    } finally {
      manifest.hidden = originalHidden;
    }
  });

  it("does not crash or pick when manifest.hidden is empty", () => {
    const onPickScene = vi.fn();
    const originalHidden = manifest.hidden;
    manifest.hidden = [];
    try {
      render(
        <HiddenGame
          onHome={noop}
          difficulty="medium"
          filter="hard"
          twoPlayerEnabled={false}
          onPickScene={onPickScene}
          onBackToPicker={noop}
        />,
      );
      expect(() => {
        fireEvent.click(screen.getByTestId("scene-surprise"));
      }).not.toThrow();
      expect(onPickScene).not.toHaveBeenCalled();
    } finally {
      manifest.hidden = originalHidden;
    }
  });

  it("does not pick on surprise when mode is null in 2P mode", () => {
    const onPickScene = vi.fn();
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("scene-surprise"));
    expect(onPickScene).not.toHaveBeenCalled();
  });
});

describe("HiddenGame scene picker and filter navigation", () => {
  const noop = () => {};

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("picks a scene when a scene card is pressed in solo mode", () => {
    const onPickScene = vi.fn();
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId(`scene-pick-${manifest.hidden[0].id}`));
    expect(onPickScene).toHaveBeenCalledWith(manifest.hidden[0].id);
  });

  it("does not pick a scene card when mode is null in 2P mode", () => {
    const onPickScene = vi.fn();
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId(`scene-pick-${manifest.hidden[0].id}`));
    expect(onPickScene).not.toHaveBeenCalled();
  });

  it("cycles difficulty filter when FilterCycleChip is pressed", () => {
    const onFilter = vi.fn();
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        filter="easy"
        onFilter={onFilter}
        twoPlayerEnabled={false}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("difficulty-cycle"));
    expect(onFilter).toHaveBeenCalledWith("medium");
  });

  it("navigates home when header back button is pressed on scene picker", () => {
    const onHome = vi.fn();
    render(
      <HiddenGame
        onHome={onHome}
        difficulty="medium"
        twoPlayerEnabled={false}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("back-button"));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("navigates back to picker when header back button is pressed during a scene", () => {
    const onBackToPicker = vi.fn();
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={onBackToPicker}
      />,
    );
    fireEvent.click(screen.getByTestId("back-button"));
    expect(onBackToPicker).toHaveBeenCalledTimes(1);
  });
});

describe("HiddenGame win overlay and progression", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it("advances to next scene when play-again is pressed on WinOverlay", () => {
    const onPickScene = vi.fn();
    const scene = manifest.hidden[0];
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene.id}
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );

    const checklist = screen.getByTestId("hidden-checklist");
    const targets = Array.from(
      checklist.querySelectorAll('[data-testid^="checklist-"]'),
    )
      .map((el) => el.getAttribute("data-testid")!.replace("checklist-", ""))
      .filter((id) => !id.includes("-finder"));

    for (const id of targets) {
      fireEvent.click(screen.getByTestId(`hidden-target-${id}`));
    }

    expect(screen.getByTestId("win-overlay")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByTestId("play-again"));
    expect(onPickScene).toHaveBeenCalledTimes(1);
  });

  it("navigates home when win-home is pressed on WinOverlay", () => {
    const onHome = vi.fn();
    const scene = manifest.hidden[0];
    render(
      <HiddenGame
        onHome={onHome}
        difficulty="medium"
        sceneId={scene.id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const checklist = screen.getByTestId("hidden-checklist");
    const targets = Array.from(
      checklist.querySelectorAll('[data-testid^="checklist-"]'),
    )
      .map((el) => el.getAttribute("data-testid")!.replace("checklist-", ""))
      .filter((id) => !id.includes("-finder"));

    for (const id of targets) {
      fireEvent.click(screen.getByTestId(`hidden-target-${id}`));
    }

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.click(screen.getByTestId("win-home"));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("speaks win.hiddenCoop, displays co-op win message, and alternates starting turn on next scene in 2P mode", () => {
    const saySpy = vi.spyOn(sound, "say");
    const scene = manifest.hidden[0];
    const { rerender } = render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={true}
        sceneId={scene.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    fireEvent.click(screen.getByTestId("mp-choose-2p"));

    const banner = screen.getByTestId("hidden-turn-banner");
    expect(banner.getAttribute("aria-label")).toBe("Foxy's turn!");

    const checklist = screen.getByTestId("hidden-checklist");
    const targets = Array.from(
      checklist.querySelectorAll('[data-testid^="checklist-"]'),
    )
      .map((el) => el.getAttribute("data-testid")!.replace("checklist-", ""))
      .filter((id) => !id.includes("-finder"));

    fireEvent.click(screen.getByTestId(`hidden-target-${targets[0]}`));
    const finder0 = screen.getByTestId(`checklist-${targets[0]}-finder`);
    expect(finder0).toBeDefined();

    for (let i = 1; i < targets.length; i++) {
      fireEvent.click(screen.getByTestId(`hidden-target-${targets[i]}`));
    }

    expect(saySpy).toHaveBeenCalledWith(t("en", "win.hiddenCoop"));
    expect(screen.getByText(t("en", "win.hiddenCoop"))).toBeDefined();

    const nextScene = manifest.hidden[1];
    rerender(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={true}
        sceneId={nextScene.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(
      screen.getByTestId("hidden-turn-banner").getAttribute("aria-label"),
    ).toBe("Bunny's turn!");
  });
});


