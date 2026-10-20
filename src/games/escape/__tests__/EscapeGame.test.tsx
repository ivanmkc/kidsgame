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
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { manifest } from "../../../manifest";
import { t } from "../../../i18n";
import { EscapeGame } from "../EscapeGame";

describe("EscapeGame", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb && cb());
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sfx, "win").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "wrong").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it("renders the scene picker when no scene is selected", () => {
    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getByTestId("scene-surprise")).toBeTruthy();
  });

  it("tapping All Games on WinOverlay navigates home", () => {
    const onHome = vi.fn();
    const onBackToPicker = vi.fn();
    const onPickScene = vi.fn();
    const rooms = manifest.escape ?? [];
    const sceneId = rooms[0]?.id ?? "toyroom";

    render(
      <EscapeGame
        onHome={onHome}
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        sceneId={sceneId}
        lang="en"
      />,
    );

    // Solve the toyroom chain:
    // 1. Search pillow to reveal key
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    // 2. Tap pillow to collect key
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    // 3. Unlock chest with key to reveal bone
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    // 4. Tap chest to collect bone
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    // 5. Open pen with bone to free puppy -> triggers win state!
    fireEvent.click(screen.getByTestId("escape-spot-pen"));

    // WinOverlay entrance animation: arm buttons after 600ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const homeBtn = screen.getByTestId("win-home");
    expect(homeBtn).toBeTruthy();

    fireEvent.click(homeBtn);
    expect(onHome).toHaveBeenCalledOnce();
    expect(onBackToPicker).not.toHaveBeenCalled();
  });

  it("replays room mission intro when replay button is tapped", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="en"
      />,
    );

    // Initial mount speaks the room intro
    expect(sound.say).toHaveBeenCalledWith(room.intro);
    vi.mocked(sound.say).mockClear();
    vi.mocked(sfx.tap).mockClear();

    const replayBtn = screen.getByTestId("escape-replay");
    expect(replayBtn.getAttribute("role")).toBe("button");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );
    expect(replayBtn.textContent).toBe("🔊");

    fireEvent.click(replayBtn);
    expect(sfx.tap).toHaveBeenCalledOnce();
    expect(sound.say).toHaveBeenCalledWith(room.intro);
  });

  it("replays mission intro in the active language and updates on language switch", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    const { rerender } = render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="en"
      />,
    );

    vi.mocked(sound.say).mockClear();
    vi.mocked(sfx.tap).mockClear();

    // Switch language to ja
    rerender(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="ja"
      />,
    );

    const jaIntro = room.t?.ja?.intro ?? room.intro;
    const replayBtn = screen.getByTestId("escape-replay");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("ja", "spell.hearAgain"),
    );

    fireEvent.click(replayBtn);
    expect(sfx.tap).toHaveBeenCalledOnce();
    expect(sound.say).toHaveBeenCalledWith(jaIntro);
  });

  it("disables replay button and does not replay intro when game is won", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="en"
      />,
    );

    // Solve the toyroom chain to win:
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-pen"));

    vi.mocked(sound.say).mockClear();
    vi.mocked(sfx.tap).mockClear();

    const replayBtn = screen.getByTestId("escape-replay");
    expect(replayBtn.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(replayBtn);
    expect(sound.say).not.toHaveBeenCalled();
    expect(sfx.tap).not.toHaveBeenCalled();
  });
});
