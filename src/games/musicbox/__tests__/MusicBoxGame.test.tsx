// @vitest-environment happy-dom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
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
});
