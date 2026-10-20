// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { buildGameSections, WORD_CARDS } from "../../../menuCards";
import { ListenChooseGame } from "../ListenChooseGame";
import { LEVEL_1_WORDS, LEVEL_2_WORDS, LEVEL_3_WORDS, Word } from "../data";
import { PressableProps, ScrollViewProps, StyleSheet } from "react-native";
import { colors } from "../../../theme";

type FakePressableProps = Partial<PressableProps>;
const capturedPressableMap: Record<string, FakePressableProps[]> = {};
const capturedScrollViewProps: ScrollViewProps[] = [];

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable =
    actual.Pressable as React.ComponentType<FakePressableProps>;
  const ActualScrollView =
    actual.ScrollView as React.ComponentType<ScrollViewProps>;
  return {
    ...actual,
    Pressable: (props: FakePressableProps) => {
      if (typeof props.testID === "string") {
        if (!capturedPressableMap[props.testID])
          capturedPressableMap[props.testID] = [];
        capturedPressableMap[props.testID].push(props);
      }
      return React.createElement(ActualPressable, props);
    },
    ScrollView: (props: ScrollViewProps) => {
      capturedScrollViewProps.push(props);
      return React.createElement(ActualScrollView, props);
    },
  };
});

describe("ListenChooseGame", () => {
  it("starts with 4 choices when difficulty is hard", () => {
    const onHome = vi.fn();
    render(<ListenChooseGame onHome={onHome} difficulty="hard" />);
    fireEvent.click(screen.getByText("Play"));

    // Level 3 should have 4 choices
    const choicesContainer = screen.getByTestId("choice-0").parentElement!;
    expect(choicesContainer.children.length).toBe(4);
  });
  beforeEach(() => {
    for (const key in capturedPressableMap) {
      delete capturedPressableMap[key];
    }
    capturedScrollViewProps.length = 0;
    vi.restoreAllMocks();
    vi.spyOn(sound, "sayThen").mockImplementation((_text, cb) => {
      if (cb) cb();
    });
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  function getRoundChoices(): {
    targetBtn: HTMLElement;
    distractorBtn: HTMLElement;
    targetWord: Word;
    distractorWord: Word;
  } {
    const targetText = vi.mocked(sound.sayThen).mock.lastCall?.[0]?.[0];
    const allWords = [...LEVEL_1_WORDS, ...LEVEL_2_WORDS, ...LEVEL_3_WORDS];
    const targetWord = allWords.find((w) => w.en === targetText)!;
    const visibleWords = allWords.filter((w) =>
      screen.queryByTestId(`choice-${w.icon}`),
    );
    const distractorWord = visibleWords.find(
      (w) => w.icon !== targetWord.icon,
    )!;
    return {
      targetBtn: screen.getByTestId(`choice-${targetWord.icon}`),
      distractorBtn: screen.getByTestId(`choice-${distractorWord.icon}`),
      targetWord,
      distractorWord,
    };
  }

  it("appears in the Word Games section of the main menu catalogue", () => {
    const card = WORD_CARDS.find((c) => c.route === "listenchoose");
    expect(card).toBeDefined();
    expect(card?.key).toBe("listenchoose");

    const sections = buildGameSections("en");
    const wordSection = sections.find((s) => s.title === "Word Games");
    expect(wordSection).toBeDefined();
    const gameEntry = wordSection?.games.find((g) => g.id === "listenchoose");
    expect(gameEntry).toBeDefined();
    expect(gameEntry?.label).toBe("Listen and Choose");
  });

  it("renders start screen initially and starts round 1 on Play", () => {
    const onHome = vi.fn();
    render(<ListenChooseGame onHome={onHome} lang="en" />);

    // Start Screen with title and Play button
    expect(
      screen.getAllByText("Listen and Choose").length,
    ).toBeGreaterThanOrEqual(1);
    const playBtn = screen.getByTestId("play-button");
    expect(playBtn).toBeTruthy();
    expect(screen.getByText("Play")).toBeTruthy();

    // Round screen elements should not be visible yet
    expect(screen.queryByTestId("speaker-button")).toBeNull();

    // Tap Play button
    fireEvent.click(playBtn);

    // Audio triggers with the target word
    expect(sound.sayThen).toHaveBeenCalled();
    const targetText = vi.mocked(sound.sayThen).mock.calls[0][0][0];
    expect(typeof targetText).toBe("string");

    // Round screen elements are now visible
    expect(screen.getByTestId("speaker-button")).toBeTruthy();
    const { targetBtn, distractorBtn, targetWord, distractorWord } =
      getRoundChoices();
    expect(targetBtn).toBeTruthy();
    expect(distractorBtn).toBeTruthy();
    expect(screen.getAllByText(targetWord.en).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(distractorWord.en)).toBeTruthy();
  });

  it("replays target word when Big Speaker button is tapped", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const spokenTarget = vi.mocked(sound.sayThen).mock.lastCall?.[0]?.[0];
    vi.mocked(sound.sayThen).mockClear();

    const speakerBtn = screen.getByTestId("speaker-button");
    fireEvent.click(speakerBtn);

    expect(sound.sayThen).toHaveBeenCalledWith(
      [spokenTarget],
      expect.any(Function),
    );
  });

  it("handles wrong picks by wobbling, replaying without penalty, and highlighting after 2 misses", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetBtn, distractorBtn, targetWord } = getRoundChoices();
    vi.mocked(sound.sayThen).mockClear();

    // First wrong pick
    fireEvent.click(distractorBtn);

    expect(sfx.wrong).not.toHaveBeenCalled();
    expect(sound.sayThen).toHaveBeenCalledWith(
      [targetWord.en],
      expect.any(Function),
    );
    expect(screen.getByTestId("listenchoose-streak").textContent).toBe("⭐ 0");
    expect(targetBtn.getAttribute("aria-selected")).toBe("false");

    // Advance timer past wobble duration
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Second wrong pick
    fireEvent.click(distractorBtn);

    expect(sfx.wrong).not.toHaveBeenCalled();
    expect(targetBtn.getAttribute("aria-selected")).toBe("true");
  });

  it("maintains streak on wrong guess without playing wrong sound effect", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetBtn } = getRoundChoices();
    fireEvent.click(targetBtn);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByTestId("listenchoose-streak").textContent).toBe("⭐ 1");

    const nextChoices = getRoundChoices();
    fireEvent.click(nextChoices.distractorBtn);

    expect(sfx.wrong).not.toHaveBeenCalled();
    expect(screen.getByTestId("listenchoose-streak").textContent).toBe("⭐ 1");
  });

  it("handles correct pick by playing good sfx, celebrating, incrementing streak, and advancing", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetBtn, targetWord } = getRoundChoices();
    vi.mocked(sound.sayThen).mockClear();

    expect(screen.getByTestId("listenchoose-streak").textContent).toBe("⭐ 0");

    // Click correct answer
    fireEvent.click(targetBtn);

    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("celebration")).toBeTruthy();
    expect(sound.sayThen).not.toHaveBeenCalled();

    // Advance past celebration animation (800ms)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByTestId("listenchoose-streak").textContent).toBe("⭐ 1");

    // Next round loaded: sayThen is called with the next target word
    expect(sound.sayThen).toHaveBeenCalled();
    const newTarget = vi.mocked(sound.sayThen).mock.lastCall?.[0]?.[0];
    expect(newTarget).not.toBe(targetWord.en);
  });

  it("rapidly tapping the correct choice 3 times fires the correct logic and sound once", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetBtn } = getRoundChoices();
    vi.mocked(sound.sayThen).mockClear();

    // Fast repeated tapping in the same event turn before state update commits
    act(() => {
      fireEvent.click(targetBtn);
      fireEvent.click(targetBtn);
      fireEvent.click(targetBtn);
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);

    // Advance past celebration animation (800ms)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByTestId("listenchoose-streak").textContent).toBe("⭐ 1");
    // Exactly one round transition and speech happened
    expect(sound.sayThen).toHaveBeenCalledTimes(1);
  });

  it("rapidly tapping an incorrect choice triggers the wobble animation state change once", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { distractorBtn } = getRoundChoices();
    vi.mocked(sound.sayThen).mockClear();

    // Rapid tapping on wrong choice in the same event turn
    act(() => {
      fireEvent.click(distractorBtn);
      fireEvent.click(distractorBtn);
      fireEvent.click(distractorBtn);
    });

    expect(sound.sayThen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listenchoose-streak").textContent).toBe("⭐ 0");
  });

  it("ignores rapid repeat taps during celebration animation", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetBtn } = getRoundChoices();
    fireEvent.click(targetBtn);

    expect(sfx.good).toHaveBeenCalledTimes(1);

    // Rapid second tap while celebrate is true
    fireEvent.click(targetBtn);
    expect(sfx.good).toHaveBeenCalledTimes(1);
  });

  it("ignores rapid repeat taps during wobble animation", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { distractorBtn } = getRoundChoices();
    vi.mocked(sound.sayThen).mockClear();
    fireEvent.click(distractorBtn);

    expect(sound.sayThen).toHaveBeenCalledTimes(1);
    expect(sfx.wrong).not.toHaveBeenCalled();

    // Rapid second tap while wobble is active
    fireEvent.click(distractorBtn);
    expect(sound.sayThen).toHaveBeenCalledTimes(1);
    expect(sfx.wrong).not.toHaveBeenCalled();
  });

  it("ignores taps on choices while wrong choice is wobbling, and allows tapping after wobble completes", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetBtn, distractorBtn } = getRoundChoices();

    // Tap wrong choice
    fireEvent.click(distractorBtn);
    expect(sfx.wrong).not.toHaveBeenCalled();

    // Immediately tap correct choice while wrong is still wobbling: ignored by lockedRef
    fireEvent.click(targetBtn);
    expect(sfx.good).not.toHaveBeenCalled();
    expect(screen.queryByTestId("celebration")).toBeNull();

    // Advance timer past wobble duration (450ms)
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // Now tap correct choice: works
    fireEvent.click(targetBtn);
    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("celebration")).toBeTruthy();
  });
  it("cleans up celebration timer on unmount without speaking next word", () => {
    const { unmount } = render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetBtn } = getRoundChoices();
    vi.mocked(sound.sayThen).mockClear();

    fireEvent.click(targetBtn);
    expect(sfx.good).toHaveBeenCalledTimes(1);

    // Unmount while celebration timer is still pending
    unmount();

    // Advance timers past 800ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Next round audio should not be spoken after unmount
    expect(sound.sayThen).not.toHaveBeenCalled();
  });

  it("supports captions toggle, defaults to ON for sound-off play, and translates ON/OFF", () => {
    const { unmount } = render(<ListenChooseGame onHome={vi.fn()} lang="en" />);

    const captionsToggle = screen.getByTestId("captions-toggle");
    // Captions are ON by default for R3 sound-off accessibility
    expect(captionsToggle.textContent).toContain("ON");

    fireEvent.click(captionsToggle);
    expect(captionsToggle.textContent).toContain("OFF");

    fireEvent.click(screen.getByTestId("play-button"));
    expect(screen.queryByTestId("listenchoose-caption")).toBeNull();

    // Toggle back ON during gameplay
    const gameToggle = screen.getByTestId("captions-toggle");
    fireEvent.click(gameToggle);
    const spokenTarget = vi.mocked(sound.sayThen).mock.lastCall?.[0]?.[0];
    expect(screen.getByTestId("listenchoose-caption").textContent).toBe(
      spokenTarget,
    );
    unmount();

    // Verify non-English (Japanese) localization of toggle
    render(<ListenChooseGame onHome={vi.fn()} lang="ja" />);
    const jaToggle = screen.getByTestId("captions-toggle");
    expect(jaToggle.textContent).toContain("オン");
    fireEvent.click(jaToggle);
    expect(jaToggle.textContent).toContain("オフ");

    // Verify hitSlop is applied to the toggles
    const captures = capturedPressableMap["captions-toggle"];
    expect(captures).toBeDefined();
    captures.forEach((props) => {
      expect(props.hitSlop).toBe(12);
    });
  });

  it("filters out untranslated words in non-English play", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="ja" />);
    fireEvent.click(screen.getByTestId("play-button"));

    // Play 25 rounds to reach level 3
    for (let i = 0; i < 25; i++) {
      // Find the target text from the caption
      const caption = screen.getByTestId("listenchoose-caption");
      const targetText = caption.textContent;
      expect(targetText).toBeTruthy();

      // Check all choices on screen
      // choice elements have testID like 'choice-cat', 'choice-bat'
      // the label text is inside a Text component inside the ChoiceCard
      // So we can query for the Text component or check textContent of choice elements
      const choiceElements = screen.queryAllByTestId(/^choice-[^0-9]/);
      for (const el of choiceElements) {
        const label = el.textContent;
        if (label) {
          // The word must be a valid Japanese translation, not an English fallback (which would be [a-z]+)
          expect(label).not.toMatch(/^[a-z]+$/i);
        }
      }

      // Click the correct choice
      const correctBtn = screen.getByRole("button", { name: targetText! });
      fireEvent.click(correctBtn);

      // Advance past celebration animation (800ms)
      act(() => {
        vi.advanceTimersByTime(800);
      });
    }
  });

  it("wins the game and shows WinOverlay when streak reaches 30", () => {
    vi.useFakeTimers();
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    for (let i = 0; i < 30; i++) {
      const { targetBtn } = getRoundChoices();
      fireEvent.click(targetBtn);
      act(() => {
        vi.advanceTimersByTime(800);
      });
    }

    expect(screen.getByTestId("win-overlay")).toBeDefined();
  });

  it("resets and speaks next word in chosen language when Play Again is tapped", () => {
    vi.useFakeTimers();
    render(<ListenChooseGame onHome={vi.fn()} lang="ja" />);
    fireEvent.click(screen.getByTestId("play-button"));

    // Complete 30 rounds
    for (let i = 0; i < 30; i++) {
      const caption = screen.getByTestId("listenchoose-caption");
      const targetText = caption.textContent;
      const correctBtn = screen.getByRole("button", { name: targetText! });
      fireEvent.click(correctBtn);
      act(() => {
        vi.advanceTimersByTime(800);
      });
    }

    expect(screen.getByTestId("win-overlay")).toBeDefined();

    // Arm WinOverlay buttons (600ms)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    vi.mocked(sound.sayThen).mockClear();
    fireEvent.click(screen.getByTestId("play-again"));

    // Spoke new target word in Japanese
    expect(sound.sayThen).toHaveBeenCalledTimes(1);
    const spokenWord = vi.mocked(sound.sayThen).mock.lastCall?.[0]?.[0];
    expect(spokenWord).not.toMatch(/^[a-z]+$/i);
  });
  it("renders a ScrollView for the board to allow scrolling on compact viewports", () => {
    render(<ListenChooseGame onHome={vi.fn()} />);
    const props = capturedScrollViewProps.find(
      (p) => p.testID === "listenchoose-scrollview",
    );
    expect(props).toBeDefined();
    expect(props!.style).toEqual({ flex: 1 });
    expect(props!.contentContainerStyle).toHaveProperty("flexGrow", 1);
  });

  it("renders choice cards with high-contrast dark borders and 4px width", () => {
    render(<ListenChooseGame onHome={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByTestId("play-button"));

    const { targetWord, distractorWord } = getRoundChoices();
    for (const icon of [targetWord.icon, distractorWord.icon]) {
      const captures = capturedPressableMap[`choice-${icon}`];
      expect(captures).toBeDefined();
      const styleProp = captures[0]?.style;
      const rawStyle =
        typeof styleProp === "function"
          ? styleProp({ pressed: false })
          : styleProp;
      const resolved = StyleSheet.flatten(rawStyle);
      expect(resolved.borderColor).toBe(colors.ink);
      expect(resolved.borderWidth).toBe(4);
    }
  });
});
