// @vitest-environment happy-dom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import { manifest } from "../../../manifest";
import { t } from "../../../i18n";
import { DiffGame } from "../DiffGame";

describe("DiffGame spoken prompt across scenes", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("re-announces instruction prompt when advancing to subsequent scenes", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const scene1 = manifest.diff[0].id;
    const scene2 = manifest.diff[1].id;

    const { rerender } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Find all the sneaky changes!");
    saySpy.mockClear();

    // Advance to scene 2
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene2}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Find all the sneaky changes!");
  });

  it("speaks prompt across picker, scene transitions, and back to picker", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const scene1 = manifest.diff[0].id;
    const scene2 = manifest.diff[1].id;

    const { rerender } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Where do you want to play?");
    saySpy.mockClear();

    // Pick first scene
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Find all the sneaky changes!");
    saySpy.mockClear();

    // Advance to second scene
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene2}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Find all the sneaky changes!");
    saySpy.mockClear();

    // Return to picker
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Where do you want to play?");
  });

  it("updates spoken prompt when language changes", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const scene1 = manifest.diff[0].id;

    const { rerender } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Find all the sneaky changes!");
    saySpy.mockClear();

    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith(
      "こっそり ちがうところを ぜんぶ みつけよう！",
    );
  });

  it("does not replay play prompt when language changes after winning", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const scene1 = manifest.diff[0].id;
    const scene2 = manifest.diff[1].id;

    const { rerender } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(saySpy).toHaveBeenCalledWith("Find all the sneaky changes!");
    saySpy.mockClear();

    // Tap every target difference to win the round
    const targets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("left-target-"),
      );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      fireEvent.click(target);
    }

    expect(screen.getByTestId("win-overlay")).toBeDefined();
    expect(saySpy).toHaveBeenCalledWith(t("en", "win.diff"));
    saySpy.mockClear();

    // Switch language on the win screen
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene1}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    // Play prompt in new language must NOT be spoken on win screen
    expect(saySpy).not.toHaveBeenCalledWith(
      "こっそり ちがうところを ぜんぶ みつけよう！",
    );
    expect(saySpy).not.toHaveBeenCalled();

    // Advancing to the next scene speaks the prompt in the active language
    rerender(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene2}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(saySpy).toHaveBeenCalledWith(
      "こっそり ちがうところを ぜんぶ みつけよう！",
    );
  });
});
