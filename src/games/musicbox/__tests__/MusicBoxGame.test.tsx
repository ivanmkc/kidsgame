// @vitest-environment happy-dom
import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import * as music from "../../../music";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import { MusicBoxGame } from "../MusicBoxGame";

vi.mock("../../assets/images", () => {
  const p = new Proxy({}, { get: () => ({ uri: "stub.png" }) });
  return {
    MUSICBOX_IMAGES: p,
    SPOTIT_ICONS: p,
    SPOTIT_SHADOWS: p,
    SCENE_IMAGES: p,
    SCENE_THUMBS: p,
    UI_IMAGES: p,
    DRESSUP_ICONS: p,
    RHYME_SPRITES: {},
  };
});

describe("MusicBoxGame rendering", () => {
  afterEach(() => {
    vi.useRealTimers();
    sound.stopNarration();
    cleanup();
    vi.restoreAllMocks();
  });

  it("passes lang down to JourneyScene when a scene is selected", () => {
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="ja"
      />,
    );

    // If JourneyScene receives `lang="ja"`, the stage's aria-label will be 'ステージ'
    const stage = screen.getByLabelText("ステージ");
    expect(stage).toBeDefined();

    unmount();
  });

  it("renders instructional subtitle in scene play mode", () => {
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    expect(
      screen.getByText("Tap anywhere to play the next note!"),
    ).toBeDefined();

    unmount();
  });

  it("renders song picker inside a ScrollView allowing all songs to be reached", () => {
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    const scrollView = screen.getByTestId("musicbox-picker-scroll");
    expect(scrollView).toBeDefined();

    // Verify the scrollable container enables scrolling for overflow content
    expect(window.getComputedStyle(scrollView).overflowY).toBe("auto");

    const jingleCard = screen.getByTestId("scene-pick-jingle");
    expect(jingleCard).toBeDefined();
    expect(scrollView.contains(jingleCard)).toBe(true);

    fireEvent.click(jingleCard);
    expect(onPickScene).toHaveBeenCalledWith("jingle");

    unmount();
  });

  it("speaks picker prompt on mount when on song picker screen", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Pick a song to play!");
    unmount();
  });

  it("speaks localized picker prompt for selected language", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="ja"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("うたを えらんでね！");
    unmount();
  });

  it("speaks scene intro prompt when a scene is selected", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith(
      "Tap, tap, tap anywhere to play the song!",
    );
    unmount();
  });

  it("speaks picker prompt when navigating back from a scene to picker", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { rerender, unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenLastCalledWith(
      "Tap, tap, tap anywhere to play the song!",
    );

    rerender(
      <MusicBoxGame
        onHome={onHome}
        sceneId={undefined}
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenLastCalledWith("Pick a song to play!");
    unmount();
  });

  it("speaks free-play intro and renders magic keys subtitle on easy difficulty", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        difficulty="easy"
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith(
      "Magic keys! Every tap makes a pretty note!",
    );
    expect(
      screen.getByText("Magic keys! Every tap makes a pretty note!"),
    ).toBeDefined();

    unmount();
  });

  it("speaks localized free-play intro on easy difficulty in ja", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        difficulty="easy"
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="ja"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith(
      "まほうの けんばん！ タップすると きれいなおとが なるよ！",
    );
    unmount();
  });

  it("re-speaks intro prompt when language is switched mid-session", () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, "say");
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    function TestHarness() {
      const [lang, setLang] = useState<Lang>("en");
      return (
        <LangContext.Provider
          value={{
            lang,
            onCycle: () => setLang((l) => (l === "en" ? "ja" : "en")),
          }}
        >
          <MusicBoxGame
            onHome={onHome}
            difficulty="easy"
            sceneId="twinkle"
            onPickScene={onPickScene}
            onBackToPicker={onBackToPicker}
            lang={lang}
          />
        </LangContext.Provider>
      );
    }

    const { unmount } = render(<TestHarness />);

    expect(saySpy).toHaveBeenLastCalledWith(
      "Magic keys! Every tap makes a pretty note!",
    );
    expect(
      screen.getByText("Magic keys! Every tap makes a pretty note!"),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("lang-cycle"));

    expect(saySpy).toHaveBeenLastCalledWith(
      "まほうの けんばん！ タップすると きれいなおとが なるよ！",
    );
    expect(
      screen.getByText(
        "まほうの けんばん！ タップすると きれいなおとが なるよ！",
      ),
    ).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(saySpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenLastCalledWith(
      "まほうの けんばん！ タップすると きれいなおとが なるよ！",
    );
    unmount();
  });

  it("re-speaks picker prompt when language is switched on song picker screen", () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, "say");
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    function TestHarness() {
      const [lang, setLang] = useState<Lang>("en");
      return (
        <LangContext.Provider
          value={{
            lang,
            onCycle: () => setLang((l) => (l === "en" ? "ja" : "en")),
          }}
        >
          <MusicBoxGame
            onHome={onHome}
            onPickScene={onPickScene}
            onBackToPicker={onBackToPicker}
            lang={lang}
          />
        </LangContext.Provider>
      );
    }

    const { unmount } = render(<TestHarness />);

    expect(saySpy).toHaveBeenLastCalledWith("Pick a song to play!");
    expect(screen.getByText("Pick a song to play!")).toBeTruthy();

    fireEvent.click(screen.getByTestId("lang-cycle"));

    expect(saySpy).toHaveBeenLastCalledWith("うたを えらんでね！");
    expect(screen.getByText("うたを えらんでね！")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(saySpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenLastCalledWith("うたを えらんでね！");
    unmount();
  });

  it("plays pentatonic free-play notes on stage tap when difficulty is easy", () => {
    const playNoteSpy = vi.spyOn(music, "playNote");
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        difficulty="easy"
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    const stage = screen.getByLabelText("Stage");
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    expect(playNoteSpy).toHaveBeenCalledTimes(2);
    expect(playNoteSpy).toHaveBeenNthCalledWith(1, 72, 1);
    // Second note in free play is 81 (pentatonic 69 + 12), whereas standard Twinkle note 2 is 72 (60 + 12)
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 81, 1);

    unmount();
  });

  it("plays rich chord dyad on single stage tap when difficulty is hard", () => {
    const playNoteSpy = vi.spyOn(music, "playNote");
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        difficulty="hard"
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    const stage = screen.getByLabelText("Stage");
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    // Single-finger tap on hard difficulty sounds root (72) and harmony third (76) at 0.7 velocity
    expect(playNoteSpy).toHaveBeenCalledTimes(2);
    expect(playNoteSpy).toHaveBeenNthCalledWith(1, 72, 0.7);
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 76, 0.7);

    unmount();
  });

  it("plays standard melody solo note on stage tap when difficulty is medium", () => {
    const playNoteSpy = vi.spyOn(music, "playNote");
    const onHome = vi.fn();
    const onPickScene = vi.fn();
    const onBackToPicker = vi.fn();

    const { unmount } = render(
      <MusicBoxGame
        onHome={onHome}
        difficulty="medium"
        sceneId="twinkle"
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        lang="en"
      />,
    );

    const stage = screen.getByLabelText("Stage");
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    expect(playNoteSpy).toHaveBeenCalledTimes(2);
    // Twinkle melody: both first and second notes are C (72) played as solo notes (volume 1)
    expect(playNoteSpy).toHaveBeenNthCalledWith(1, 72, 1);
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 72, 1);

    unmount();
  });
});
