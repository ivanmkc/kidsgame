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

  it('renders FilterCycleChip and cycles difficulty filter on press', () => {
    const onFilter = vi.fn();
    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
        filter="easy"
        onFilter={onFilter}
      />,
    );
    const cycleBtn = screen.getByTestId('difficulty-cycle');
    expect(cycleBtn).toBeTruthy();
    fireEvent.click(cycleBtn);
    expect(onFilter).toHaveBeenCalledWith('medium');
  });

  it('dims rooms that do not match the active difficulty filter', () => {
    const { unmount } = render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
        filter="easy"
      />,
    );
    const easyToy = screen.getByTestId('scene-pick-toyroom');
    const easyPirate = screen.getByTestId('scene-pick-piratecove');
    expect(window.getComputedStyle(easyToy).opacity).not.toBe('0.32');
    expect(window.getComputedStyle(easyPirate).opacity).toBe('0.32');

    unmount();
    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
        filter="hard"
      />,
    );
    const hardToy = screen.getByTestId('scene-pick-toyroom');
    const hardPirate = screen.getByTestId('scene-pick-piratecove');
    expect(window.getComputedStyle(hardToy).opacity).toBe('0.32');
    expect(window.getComputedStyle(hardPirate).opacity).toBe('0.32');
  });

  it('surprise button picks from rooms matching active filter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const onPickScene = vi.fn();
    render(
      <EscapeGame
        onHome={noop}
        onPickScene={onPickScene}
        onBackToPicker={noop}
        lang="en"
        filter="easy"
      />,
    );
    fireEvent.click(screen.getByTestId('scene-surprise'));
    expect(onPickScene).toHaveBeenCalledWith('dragoncave');
  });

  it('tapping Next on WinOverlay cycles to next room in the difficulty pool', () => {
    const onPickScene = vi.fn();
    render(
      <EscapeGame
        onHome={noop}
        onPickScene={onPickScene}
        onBackToPicker={noop}
        sceneId="dragoncave"
        filter="easy"
        lang="en"
      />,
    );

    // Solve dragoncave:
    // 1. Search haystack to reveal egg
    fireEvent.click(screen.getByTestId('escape-spot-haystack'));
    // 2. Tap haystack to collect egg
    fireEvent.click(screen.getByTestId('escape-spot-haystack'));
    // 3. Unlock stove with egg to cook pancake
    fireEvent.click(screen.getByTestId('escape-spot-stove'));
    // 4. Tap stove to collect pancake
    fireEvent.click(screen.getByTestId('escape-spot-stove'));
    // 5. Feed pancake to dragon -> triggers win state!
    fireEvent.click(screen.getByTestId('escape-spot-dragon'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const nextBtn = screen.getByTestId('play-again');
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);

    // In easy pool (toyroom, dragoncave), Next wraps around to toyroom.
    // Unfiltered index progression would have stepped to piratecove.
    expect(onPickScene).toHaveBeenCalledWith('toyroom');
  });

  it('idle hint delay scales with difficulty (easy 8s vs medium 12s)', () => {
    const { unmount } = render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId="toyroom"
        difficulty="easy"
        filter="easy"
        lang="en"
      />,
    );

    const pillow = screen.getByTestId('escape-spot-pillow');
    expect(pillow.children.length).toBe(0);

    // After 7s, hint has not triggered
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(pillow.children.length).toBe(0);

    // After 8.5s total, hint has triggered on easy
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(pillow.children.length).toBeGreaterThan(0);

    unmount();

    // Medium mode: does not trigger at 8.5s, triggers at 12.5s
    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId="toyroom"
        difficulty="medium"
        filter="medium"
        lang="en"
      />,
    );

    const medPillow = screen.getByTestId('escape-spot-pillow');
    expect(medPillow.children.length).toBe(0);

    act(() => {
      vi.advanceTimersByTime(8500);
    });
    expect(medPillow.children.length).toBe(0);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(medPillow.children.length).toBeGreaterThan(0);
  });
});
