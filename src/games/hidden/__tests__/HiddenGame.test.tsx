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
    expect(banner.getAttribute("aria-label")).toBe("Foxyの ばん！");
    expect(screen.getByText(/Foxyの ばん！/)).toBeDefined();
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
    expect(screen.getByText(/轮到Foxy了！/)).toBeDefined();
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
    expect(screen.getByText(/到Foxy喇！/)).toBeDefined();
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
      expect.objectContaining({ text: "Foxyの ばん！" }),
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
    ).toBe("Foxyの ばん！");
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
    ).toBe("Foxyの ばん！");

    // Tap active checklist target
    const drawnBtn = screen.getByTestId(`hidden-target-${drawnTarget.id}`);
    fireEvent.click(drawnBtn);

    expect(goodSpy).toHaveBeenCalled();
    expect(screen.getByTestId("hidden-score").textContent).toContain("1/6");
    expect(
      screen.getByTestId("hidden-turn-banner").getAttribute("aria-label"),
    ).toBe("Bunnyの ばん！");
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
