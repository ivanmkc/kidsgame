// @vitest-environment happy-dom
import React from "react";
import { renderToString } from "react-dom/server";
import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Animated, GestureResponderEvent, PressableProps } from "react-native";
import type { GameShell } from "../../../components/GameShell";
import type { ScenePicker } from "../../../components/ScenePicker";
import { manifest, Story, StoryNode } from "../../../manifest";
import { t } from "../../../i18n";
import { VOICE } from "../../../assets/voice";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { colors } from "../../../theme";
import { StoryGame } from "../StoryGame";

type FakeScenePickerProps = Partial<React.ComponentProps<typeof ScenePicker>>;
type FakeGameShellProps = Partial<React.ComponentProps<typeof GameShell>>;
type FakePressableProps = Partial<Omit<PressableProps, "onPress">> & {
  onPress?: (event?: Partial<GestureResponderEvent>) => void;
};
type AnimationCallback = Parameters<Animated.CompositeAnimation["start"]>[0];

// Intercept ScenePicker to capture props and simulate onPick / onSurprise
let capturedPickerProps: FakeScenePickerProps | null = null;

vi.mock("../../../components/ScenePicker", () => ({
  ScenePicker: (props: FakeScenePickerProps) => {
    capturedPickerProps = props;
    return <div data-testid="mock-scene-picker">{props.title}</div>;
  },
}));

let capturedGameShellProps: FakeGameShellProps | null = null;

vi.mock("../../../components/GameShell", () => ({
  GameShell: (props: FakeGameShellProps) => {
    capturedGameShellProps = props;
    return (
      <div data-testid="mock-game-shell">
        <div>{props.title}</div>
        <div>{props.subtitle}</div>
        {props.right}
        {props.children}
      </div>
    );
  },
}));

const capturedPressables: FakePressableProps[] = [];
const capturedPressableMap: Record<string, FakePressableProps> = {};
vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable =
    actual.Pressable as React.ComponentType<FakePressableProps>;
  return {
    ...actual,
    Pressable: (
      props: Partial<React.ComponentProps<typeof ActualPressable>>,
    ) => {
      capturedPressables.push(props);
      if (typeof props.testID === "string") {
        capturedPressableMap[props.testID] = props;
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

describe("StoryGame", () => {
  const initialStoryCount = manifest.stories?.length ?? 0;

  beforeEach(() => {
    capturedPickerProps = null;
    capturedGameShellProps = null;
    capturedPressables.length = 0;
    for (const key of Object.keys(capturedPressableMap)) {
      delete capturedPressableMap[key];
    }
    vi.restoreAllMocks();

    vi.spyOn(Animated, "timing").mockImplementation((value, config) => {
      const timingVal = value as Partial<Animated.Value>;
      return {
        start: (cb?: AnimationCallback) => {
          if (
            typeof config.toValue === "number" &&
            typeof timingVal.setValue === "function"
          ) {
            timingVal.setValue(config.toValue);
          }
          cb?.({ finished: true });
        },
        stop: () => {},
        reset: () => {},
      };
    });

    vi.spyOn(Animated, "spring").mockImplementation((value, config) => {
      const springVal = value as Partial<Animated.Value>;
      return {
        start: (cb?: AnimationCallback) => {
          if (
            typeof config.toValue === "number" &&
            typeof springVal.setValue === "function"
          ) {
            springVal.setValue(config.toValue);
          }
          cb?.({ finished: true });
        },
        stop: () => {},
        reset: () => {},
      };
    });
  });

  afterEach(() => {
    cleanup();
    if (manifest.stories && manifest.stories.length > initialStoryCount) {
      manifest.stories.splice(initialStoryCount);
    }
  });

  const noop = () => {};

  it("renders ScenePicker when sceneId is omitted", () => {
    const onHomeSpy = vi.fn();
    const onPickSpy = vi.fn();

    const html = renderToString(
      <StoryGame
        onHome={onHomeSpy}
        onPickScene={onPickSpy}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(html).toContain("Story Path");
    expect(html).toContain("Pick a story");
    expect(capturedPickerProps).not.toBeNull();
    expect(capturedGameShellProps?.title).toBe("Story Path");
    expect(capturedGameShellProps?.subtitle).toBe("Pick a story");

    // Test onBack in GameShell calls onHome
    capturedGameShellProps?.onBack?.();
    expect(onHomeSpy).toHaveBeenCalledOnce();

    // Verify onPick handler
    capturedPickerProps?.onPick?.("luna");
    expect(onPickSpy).toHaveBeenCalledWith("luna");

    // Verify onSurprise handler
    capturedPickerProps?.onSurprise?.();
    expect(onPickSpy).toHaveBeenCalledTimes(2);
  });

  it("handles onSurprise when stories array is empty", () => {
    const onPickSpy = vi.fn();
    const originalStories = manifest.stories;
    manifest.stories = [];

    try {
      renderToString(
        <StoryGame
          onHome={noop}
          onPickScene={onPickSpy}
          onBackToPicker={noop}
          lang="en"
        />,
      );
      capturedPickerProps?.onSurprise?.();
      expect(onPickSpy).not.toHaveBeenCalled();
    } finally {
      manifest.stories = originalStories;
    }
  });

  it("handles manifest.stories being undefined and default lang", () => {
    const originalStories = manifest.stories;
    manifest.stories = undefined;

    try {
      const html = renderToString(
        <StoryGame onHome={noop} onPickScene={noop} onBackToPicker={noop} />,
      );
      expect(html).toContain("Story Path");
      expect(capturedPickerProps?.options).toEqual([]);
    } finally {
      manifest.stories = originalStories;
    }
  });

  it("renders ending node where choices property is undefined", () => {
    const endStoryNoChoices: Story = {
      id: "test-no-choices",
      title: "No Choices Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "The end.",
        },
      },
    };
    manifest.stories?.push(endStoryNoChoices);

    const html = renderToString(
      <StoryGame
        sceneId="test-no-choices"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(html).toContain("The end.");
    expect(html).toContain("The End! Read again 📖");
  });

  it("falls back to ScenePicker when sceneId does not match any known story", () => {
    const html = renderToString(
      <StoryGame
        sceneId="unknown-story"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    expect(html).toContain("えほんタイム");
    expect(html).toContain("おはなしを えらぼう");
    expect(capturedPickerProps).not.toBeNull();
  });

  it("renders correctly in other supported languages", () => {
    const htmlCmn = renderToString(
      <StoryGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    expect(htmlCmn).toContain("故事之路");

    const htmlYue = renderToString(
      <StoryGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    expect(htmlYue).toContain("故事之路");
  });

  it("returns null if the story node is missing", () => {
    const emptyStory: Story = {
      id: "test-empty-nodes",
      title: "Empty Story",
      nodes: {} as Record<string, StoryNode>,
    };
    manifest.stories?.push(emptyStory);

    const html = renderToString(
      <StoryGame
        sceneId="test-empty-nodes"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(html).toBe("");
  });

  it("renders story with hotspot choices and handles tap-to-dive", () => {
    const onBackToPickerSpy = vi.fn();
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();

    const html = renderToString(
      <StoryGame
        sceneId="luna"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={onBackToPickerSpy}
        lang="en"
      />,
    );

    expect(capturedGameShellProps?.subtitle).toBe("Luna's Big Day");
    expect(html).toContain('data-testid="story-text-start"');
    expect(capturedGameShellProps?.backKind).toBe("picker");

    // Test onBack navigates back to picker
    capturedGameShellProps?.onBack?.();
    expect(onBackToPickerSpy).toHaveBeenCalledOnce();

    // Luna start node has hotspot choices a and b
    const choiceA = capturedPressableMap["story-choice-a"];
    expect(choiceA).toBeDefined();
    expect(choiceA?.accessibilityRole).toBe("button");
    expect(choiceA?.accessibilityLabel).toBe("Trot to the forest! 🌲");

    // Tapping choice with video calls sfx.tap and say, sets clip
    choiceA?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Trot to the forest! 🌲");

    // Tapping again while animating returns early
    choiceA?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();
  });

  it("handles hotspot choices without video via Animated.timing zoom and advance", () => {
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();

    const storyWithoutVideo: Story = {
      id: "test-hot-no-video",
      title: "No Video Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "Where to jump?",
          choices: [
            {
              label: "Jump left",
              next: "left",
              hot: { x: 50, y: 50, w: 100, h: 100 },
            },
          ],
        },
      },
    };
    manifest.stories?.push(storyWithoutVideo);

    renderToString(
      <StoryGame
        sceneId="test-hot-no-video"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const choiceBtn = capturedPressableMap["story-choice-left"];
    expect(choiceBtn).toBeDefined();

    choiceBtn?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Jump left");
  });

  it("renders story with icon choices and tests tile styles and onPress", () => {
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();

    const storyWithIcons: Story = {
      id: "test-icon-story",
      title: "Icon Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "Choose an item",
          choices: [
            {
              label: "Pick apple",
              next: "apple",
              icon: "story/luna_start_c0.png",
            },
            {
              label: "Pick berry",
              next: "berry",
              icon: "story/luna_start_c1.png",
            },
          ],
        },
      },
    };
    manifest.stories?.push(storyWithIcons);

    const html = renderToString(
      <StoryGame
        sceneId="test-icon-story"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(html).toContain("Choose an item");
    expect(html).toContain("Pick apple");
    expect(html).toContain("Pick berry");

    const appleChoice = capturedPressableMap["story-choice-apple"];
    const berryChoice = capturedPressableMap["story-choice-berry"];
    expect(appleChoice).toBeDefined();
    expect(berryChoice).toBeDefined();

    // Verify style function with teal border for i === 0 and gold for i === 1
    type PressableStyleFn = Extract<
      PressableProps["style"],
      (...args: never[]) => unknown
    >;
    const appleStyleFn = appleChoice?.style as PressableStyleFn | undefined;
    const berryStyleFn = berryChoice?.style as PressableStyleFn | undefined;

    const appleUnpressed = appleStyleFn?.({ pressed: false }) as Array<
      Record<string, unknown>
    >;
    const applePressed = appleStyleFn?.({ pressed: true }) as Array<
      Record<string, unknown>
    >;
    expect(appleUnpressed).toContainEqual({ borderColor: colors.teal });
    expect(applePressed).toContainEqual({ transform: [{ scale: 0.95 }] });

    const berryUnpressed = berryStyleFn?.({ pressed: false }) as Array<
      Record<string, unknown>
    >;
    expect(berryUnpressed).toContainEqual({ borderColor: colors.gold });

    // Test onPress triggers sfx and say
    appleChoice?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Pick apple");
  });

  it("renders story with text button choices (ChunkyButton) and tests onPress", () => {
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();

    const storyWithButtons: Story = {
      id: "test-btn-story",
      title: "Button Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "What next?",
          choices: [
            {
              label: "First option",
              next: "opt1",
            },
            {
              label: "Second option",
              next: "opt2",
            },
          ],
        },
      },
    };
    manifest.stories?.push(storyWithButtons);

    const html = renderToString(
      <StoryGame
        sceneId="test-btn-story"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(html).toContain("First option");
    expect(html).toContain("Second option");

    const opt1Btn = capturedPressableMap["story-choice-opt1"];
    const opt2Btn = capturedPressableMap["story-choice-opt2"];
    expect(opt1Btn).toBeDefined();
    expect(opt2Btn).toBeDefined();

    opt1Btn?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalled();
    expect(saySpy).toHaveBeenCalledWith("First option");
  });

  it("renders happy ending node with ambient video, Confetti, and end buttons", () => {
    const onBackToPickerSpy = vi.fn();
    const sfxWinSpy = vi.spyOn(sfx, "win").mockReturnValue();

    const happyEndStory: Story = {
      id: "test-happy-end",
      title: "Happy Ending Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "They lived happily ever after!",
          choices: [],
          bad: false,
          video: "story-video/happy.mp4",
        },
      },
    };
    manifest.stories?.push(happyEndStory);

    const { container, getByTestId } = render(
      <StoryGame
        sceneId="test-happy-end"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={onBackToPickerSpy}
        lang="en"
      />,
    );

    const html = container.innerHTML;

    expect(html).toContain("They lived happily ever after!");
    expect(html).toContain('data-testid="story-end-clip"');
    expect(html).toContain("The End! Read again 📖");
    expect(html).toContain("All Stories 🏠");

    const frame = getByTestId("story-frame");
    expect(frame.textContent).not.toContain("🎉");
    expect(container.textContent).toContain("🎉");

    const restartBtn = capturedPressableMap["story-restart"];
    const homeBtn = capturedPressableMap["story-home"];
    expect(restartBtn).toBeDefined();
    expect(homeBtn).toBeDefined();

    // Restart on good ending calls sfx.win
    restartBtn?.onPress?.();
    expect(sfxWinSpy).toHaveBeenCalledOnce();

    homeBtn?.onPress?.();
    expect(onBackToPickerSpy).toHaveBeenCalledOnce();
  });

  it("renders bad ending node (oopsie) with Try Again and Start Over buttons", () => {
    const sfxWinSpy = vi.spyOn(sfx, "win").mockReturnValue();

    const badEndStory: Story = {
      id: "test-bad-end",
      title: "Bad Ending Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "Oops! That path was blocked.",
          choices: [],
          bad: true,
        },
      },
    };
    manifest.stories?.push(badEndStory);

    const html = renderToString(
      <StoryGame
        sceneId="test-bad-end"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(html).toContain("Oops! That path was blocked.");
    expect(html).toContain("Oops! Try another way ↩️");
    expect(html).toContain("Start over 📖");

    const tryAgainBtn = capturedPressableMap["story-try-again"];
    const restartBtn = capturedPressableMap["story-restart"];
    expect(tryAgainBtn).toBeDefined();
    expect(restartBtn).toBeDefined();

    tryAgainBtn?.onPress?.();

    // Restart on bad ending should NOT call sfx.win
    restartBtn?.onPress?.();
    expect(sfxWinSpy).not.toHaveBeenCalled();
  });

  it("normalizes oopsie ending node without bad flag to hide Confetti, suppress sfx.win, and provide Try Another Way and Start Over buttons", () => {
    const sfxWinSpy = vi.spyOn(sfx, "win").mockReturnValue();
    const sfxBoingSpy = vi.spyOn(sfx, "boing").mockReturnValue();

    const oopsieNoBadStory: Story = {
      id: "test-oopsie-no-bad-flag",
      title: "Oopsie No Bad Flag Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "Milo dives straight into the soy barrel. Salty whiskers, no melon. Oopsie ending!",
          choices: [],
          // bad flag is omitted (undefined), matching the 110 unflagged oopsie branches
        },
      },
    };
    manifest.stories?.push(oopsieNoBadStory);

    const { container } = render(
      <StoryGame
        sceneId="test-oopsie-no-bad-flag"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    // Boing sound effect should play for bad ending
    expect(sfxBoingSpy).toHaveBeenCalled();

    // Confetti is suppressed on oopsie endings
    expect(container.textContent).not.toContain("🎉");

    // Both Try another way and Start over buttons are rendered
    const tryAgainBtn = capturedPressableMap["story-try-again"];
    const restartBtn = capturedPressableMap["story-restart"];
    expect(tryAgainBtn).toBeDefined();
    expect(restartBtn).toBeDefined();
    expect(container.textContent).toContain("Oops! Try another way ↩️");
    expect(container.textContent).toContain("Start over 📖");
    expect(container.textContent).not.toContain("The End! Read again 📖");

    // Restart on oopsie ending should NOT play celebratory win sound
    restartBtn?.onPress?.();
    expect(sfxWinSpy).not.toHaveBeenCalled();
  });

  it("renders and triggers ScareSpot surprise", () => {
    vi.useFakeTimers();
    const sfxThunderSpy = vi.spyOn(sfx, "thunder").mockReturnValue();
    const sfxBoingSpy = vi.spyOn(sfx, "boing").mockReturnValue();
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();

    const scareStoryThunder: Story = {
      id: "test-scare-thunder",
      title: "Scare Story Thunder",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "Look closely...",
          scare: {
            x: 10,
            y: 20,
            w: 80,
            h: 90,
            pop: "story/luna_start_c0.png",
            sting: "thunder",
            reveal: "It is a friendly ghost!",
            delay: 300,
          },
        },
      },
    };
    manifest.stories?.push(scareStoryThunder);

    renderToString(
      <StoryGame
        sceneId="test-scare-thunder"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const scareBtnThunder = capturedPressableMap["story-scare"];
    expect(scareBtnThunder).toBeDefined();
    expect(scareBtnThunder?.accessibilityLabel).toBe(
      "Something is hiding here",
    );
    expect(scareBtnThunder?.accessibilityRole).toBe("button");

    scareBtnThunder?.onPress?.();
    expect(sfxThunderSpy).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(300);
    expect(saySpy).toHaveBeenCalledWith("It is a friendly ghost!");

    // Test boing sting variant
    const scareStoryBoing: Story = {
      id: "test-scare-boing",
      title: "Scare Story Boing",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "What is that?",
          scare: {
            x: 0,
            y: 0,
            w: 50,
            h: 50,
            pop: "story/luna_start_c1.png",
            sting: "boing",
            reveal: "Surprise rabbit!",
            delay: 100,
          },
        },
      },
    };
    manifest.stories?.push(scareStoryBoing);

    renderToString(
      <StoryGame
        sceneId="test-scare-boing"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const scareBtnBoing = capturedPressableMap["story-scare"];
    scareBtnBoing?.onPress?.();
    expect(sfxBoingSpy).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it("renders and triggers FxSpot interactive surprises with different stings and spoken lines", () => {
    const sfxFlipSpy = vi.spyOn(sfx, "flip").mockReturnValue();
    const sfxTapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const sfxBoingSpy = vi.spyOn(sfx, "boing").mockReturnValue();
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();

    const fxStory: Story = {
      id: "test-fx-story",
      title: "Fx Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "Touch the magical spots!",
          fx: [
            { sting: "flip", line: "Sparkle!", x: 10, y: 10, w: 40, h: 40 },
            { sting: "tap", x: 60, y: 60, w: 40, h: 40 },
            { sting: "boing", x: 110, y: 110, w: 40, h: 40 },
          ],
        },
      },
    };
    manifest.stories?.push(fxStory);

    renderToString(
      <StoryGame
        sceneId="test-fx-story"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const fxPressables = capturedPressables.filter(
      (p) => p.testID === "story-fx",
    );
    expect(fxPressables).toHaveLength(3);

    expect(fxPressables[0]?.accessibilityLabel).toBe("Something fun is here");
    expect(fxPressables[0]?.accessibilityRole).toBe("button");

    // Trigger flip fx with line
    fxPressables[0]?.onPress?.();
    expect(sfxFlipSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Sparkle!");

    // Trigger tap fx
    fxPressables[1]?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();

    // Trigger boing fx
    fxPressables[2]?.onPress?.();
    expect(sfxBoingSpy).toHaveBeenCalledOnce();
  });

  it("speaks localized picker prompt for ja, cmn, yue, and en", () => {
    let lastPlayedSrc = "";
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(function (this: HTMLMediaElement) {
        lastPlayedSrc = this.src;
        return Promise.resolve();
      });

    const speakSpy = vi.fn();
    class FakeUtterance {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    }
    const origSpeechSynthesis = window.speechSynthesis;
    const origUtterance = window.SpeechSynthesisUtterance;
    window.speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    window.SpeechSynthesisUtterance =
      FakeUtterance as unknown as typeof SpeechSynthesisUtterance;

    try {
      const langs = ["en", "ja", "cmn", "yue"] as const;
      for (const l of langs) {
        sound.setSpeechLang(l);
        lastPlayedSrc = "";
        speakSpy.mockClear();

        const { unmount } = render(
          <StoryGame
            onHome={noop}
            onPickScene={noop}
            onBackToPicker={noop}
            lang={l}
          />,
        );

        const expectedText = t(l, "picker.story");
        const clipKey = l === "en" ? expectedText : `${l}|${expectedText}`;
        if (VOICE[clipKey]) {
          expect(lastPlayedSrc).toContain(`voice/${VOICE[clipKey]}`);
        } else {
          expect(speakSpy).toHaveBeenCalledWith(
            expect.objectContaining({ text: expectedText }),
          );
        }
        if (l !== "en") {
          expect(lastPlayedSrc).not.toContain(
            VOICE["Which story shall we read?"],
          );
        }
        unmount();
      }
    } finally {
      sound.setSpeechLang("en");
      playSpy.mockRestore();
      window.speechSynthesis = origSpeechSynthesis;
      window.SpeechSynthesisUtterance = origUtterance;
    }
  });

  it("speaks localized hotspot lead prompt before choices in each language", () => {
    const saySeqSpy = vi.spyOn(sound, "saySequence").mockReturnValue();

    const expectedHotLeads: Record<string, string> = {
      en: "Tap where you want to go!",
      ja: "いきたい ほうを タップ！",
      cmn: "想去哪就点哪！",
      yue: "想去邊就撳邊！",
    };

    for (const [l, expectedLead] of Object.entries(expectedHotLeads)) {
      saySeqSpy.mockClear();
      const { unmount } = render(
        <StoryGame
          sceneId="luna"
          onHome={noop}
          onPickScene={noop}
          onBackToPicker={noop}
          lang={l as "en" | "ja" | "cmn" | "yue"}
        />,
      );
      expect(saySeqSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expectedLead]),
      );
      unmount();
    }
  });

  it("speaks localized non-hotspot lead prompt before choices in each language", () => {
    const saySeqSpy = vi.spyOn(sound, "saySequence").mockReturnValue();

    const buttonStory: Story = {
      id: "test-leads-btn-story",
      title: "Button Story",
      nodes: {
        start: {
          image: "story/luna_start.jpg",
          text: "What next?",
          choices: [
            { label: "Option A", next: "a" },
            { label: "Option B", next: "b" },
          ],
        },
      },
    };
    manifest.stories?.push(buttonStory);

    const expectedNextLeads: Record<string, string> = {
      en: "What should happen next?",
      ja: "つぎは どうなる？",
      cmn: "接下来会怎样？",
      yue: "跟住會點樣呢？",
    };

    for (const [l, expectedLead] of Object.entries(expectedNextLeads)) {
      saySeqSpy.mockClear();
      const { unmount } = render(
        <StoryGame
          sceneId="test-leads-btn-story"
          onHome={noop}
          onPickScene={noop}
          onBackToPicker={noop}
          lang={l as "en" | "ja" | "cmn" | "yue"}
        />,
      );
      expect(saySeqSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expectedLead]),
      );
      unmount();
    }
  });

  it("updates spoken transition lead when lang prop changes", () => {
    const saySeqSpy = vi.spyOn(sound, "saySequence").mockReturnValue();

    const { rerender } = render(
      <StoryGame
        sceneId="luna"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(saySeqSpy).toHaveBeenLastCalledWith(
      expect.arrayContaining(["Tap where you want to go!"]),
    );

    saySeqSpy.mockClear();
    rerender(
      <StoryGame
        sceneId="luna"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(saySeqSpy).toHaveBeenLastCalledWith(
      expect.arrayContaining(["いきたい ほうを タップ！"]),
    );
  });

  it('does not collapse story illustration frame to negative or tiny dimensions on compact landscape viewports', () => {
    const origInnerWidth = window.innerWidth;
    const origInnerHeight = window.innerHeight;
    const origClientWidth = document.documentElement.clientWidth;
    const origClientHeight = document.documentElement.clientHeight;
    const origVvWidth = window.visualViewport?.width;
    const origVvHeight = window.visualViewport?.height;

    const setViewport = (width: number, height: number) => {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
      Object.defineProperty(document.documentElement, 'clientWidth', { value: width, configurable: true });
      Object.defineProperty(document.documentElement, 'clientHeight', { value: height, configurable: true });
      if (window.visualViewport) {
        Object.defineProperty(window.visualViewport, 'width', { value: width, configurable: true });
        Object.defineProperty(window.visualViewport, 'height', { value: height, configurable: true });
        window.visualViewport.dispatchEvent(new Event('resize'));
      }
      window.dispatchEvent(new Event('resize'));
    };

    try {
      setViewport(640, 320);
      const { getByTestId } = render(
        <StoryGame
          sceneId="luna"
          onHome={noop}
          onPickScene={noop}
          onBackToPicker={noop}
          lang="en"
        />
      );

      const frame = getByTestId('story-frame');
      expect(frame).toBeDefined();
      const inner = frame.firstElementChild as HTMLElement;
      expect(inner).toBeDefined();
      expect(Number.parseFloat(inner.style.width)).toBeGreaterThanOrEqual(260);
      expect(Number.parseFloat(inner.style.height)).toBeGreaterThanOrEqual(140);
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: origInnerHeight, configurable: true });
      Object.defineProperty(document.documentElement, 'clientWidth', { value: origClientWidth, configurable: true });
      Object.defineProperty(document.documentElement, 'clientHeight', { value: origClientHeight, configurable: true });
      if (window.visualViewport && origVvWidth !== undefined && origVvHeight !== undefined) {
        Object.defineProperty(window.visualViewport, 'width', { value: origVvWidth, configurable: true });
        Object.defineProperty(window.visualViewport, 'height', { value: origVvHeight, configurable: true });
        window.visualViewport.dispatchEvent(new Event('resize'));
      }
      window.dispatchEvent(new Event('resize'));
    }
  });
});
