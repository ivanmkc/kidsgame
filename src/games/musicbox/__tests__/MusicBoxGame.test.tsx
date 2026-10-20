// @vitest-environment happy-dom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    const stageBtn = screen.getByRole("button", { name: "ステージ" });
    expect(stageBtn).toBeDefined();

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
});
