// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { EscapeGame } from "../EscapeGame";

const noop = () => {};

describe("EscapeGame revealed item hit target", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves hit target to revealed item position and allows collection", () => {
    render(
      <EscapeGame
        onHome={noop}
        sceneId="toyroom"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const pillowSpot = screen.getByTestId("escape-spot-pillow");
    expect(pillowSpot).toBeDefined();

    // Initial position before revealing
    const initialLeft = pillowSpot.style.left;

    // Tap pillow to reveal the key
    fireEvent.click(pillowSpot);

    // After reveal, hit target position should have moved to the key's itemBox
    const revealedLeft = pillowSpot.style.left;
    expect(revealedLeft).not.toBe(initialLeft);

    // Tap the revealed item hit target to collect it
    fireEvent.click(pillowSpot);

    // Key is now collected into the inventory tray
    expect(screen.getByTestId("escape-item-key")).toBeDefined();
  });

  it("does not draw rest layer for covered hotspot until prerequisite lock is unlocked", async () => {
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});

    const drawnImages: string[] = [];
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn((img: { src?: string }) => {
          if (img?.src) drawnImages.push(img.src);
        }),
      } as unknown as CanvasRenderingContext2D);

    const origImage = window.Image;
    const images: MockImage[] = [];
    class MockImage {
      private _src = "";
      naturalWidth = 100;
      naturalHeight = 100;
      onload: (() => void) | null = null;
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        images.push(this);
      }
    }
    window.Image = MockImage as unknown as typeof Image;

    try {
      render(
        <EscapeGame
          onHome={noop}
          sceneId="rocketpad"
          onPickScene={noop}
          onBackToPicker={noop}
          lang="en"
        />,
      );

      // Trigger image onload so SpriteCanvas draws static layers
      act(() => {
        for (const img of images) {
          img.onload?.();
        }
      });

      // Panel rest layer is drawn, but covered slot rest layer must not be drawn yet
      expect(drawnImages.some((src) => src.includes("panel_rest"))).toBe(true);
      expect(drawnImages.some((src) => src.includes("slot_rest"))).toBe(false);

      // Search toolbox and collect wrench, then unlock panel
      fireEvent.click(screen.getByTestId("escape-spot-toolbox"));
      fireEvent.click(screen.getByTestId("escape-spot-toolbox"));
      fireEvent.click(screen.getByTestId("escape-spot-panel"));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Once panel is unlocked, slot is uncovered and its rest layer is drawn
      expect(drawnImages.some((src) => src.includes("slot_rest"))).toBe(true);
    } finally {
      getContextSpy.mockRestore();
      window.Image = origImage;
      vi.restoreAllMocks();
    }
  });

  it("shows visual feedback when tapping a locked hotspot without needed item", () => {
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sfx, "boing").mockImplementation(() => {});

    render(
      <EscapeGame
        onHome={noop}
        sceneId="toyroom"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const chestSpot = screen.getByTestId("escape-spot-chest");
    expect(screen.queryByTestId("escape-feedback-chest")).toBeNull();

    fireEvent.click(chestSpot);

    const feedback = screen.getByTestId("escape-feedback-chest");
    expect(feedback).toBeDefined();
    expect(feedback.textContent).toContain("❌");
  });

  it("shows visual feedback when tapping an empty flavor search spot", () => {
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sfx, "tap").mockImplementation(() => {});

    render(
      <EscapeGame
        onHome={noop}
        sceneId="toyroom"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const teddySpot = screen.getByTestId("escape-spot-teddy");
    expect(screen.queryByTestId("escape-feedback-teddy")).toBeNull();

    fireEvent.click(teddySpot);

    const feedback = screen.getByTestId("escape-feedback-teddy");
    expect(feedback).toBeDefined();
    expect(feedback.textContent).toContain("🔍");
  });
});
