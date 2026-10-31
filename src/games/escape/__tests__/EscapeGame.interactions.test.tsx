// @vitest-environment happy-dom
import React, { useState } from "react";
import { Lang } from "../../../lang";
import { LangContext } from "../../../components/GameShell";
import { manifest } from "../../../manifest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { SpriteCanvas } from "../SpriteCanvas";
import { manifest } from "../../../manifest";


const noop = () => {};

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: height,
    configurable: true,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("EscapeGame revealed item hit target", () => {
  function LangHarness({
    initialLang = "en",
    sceneId = "toyroom",
  }: {
    initialLang?: Lang;
    sceneId?: string;
  }) {
    const [lang, setLang] = useState<Lang>(initialLang);
    const cycleLang = () => {
      setLang((l) =>
        l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
      );
    };
    return (
      <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
        <EscapeGame
          onHome={noop}
          onPickScene={noop}
          onBackToPicker={noop}
          sceneId={sceneId}
          lang={lang}
        />
      </LangContext.Provider>
    );
  }

  beforeEach(() => {
    setViewport(800, 600);
  });

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

  it("draws sprite sheet for hotspot without a rest layer when revealed or opened", () => {
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
      const dummyRoom = {
        id: "dummy",
        name: "dummy",
        image: "dummy.png",
        intro: "",
        winText: "",
        items: [],
        hotspots: [
          {
            id: "h1",
            kind: "search" as const,
            box: { x: 0, y: 0, w: 10, h: 10 },
            sprite: {
              sheet: "h1_sheet.png",
              cols: 2,
              frameCount: 2,
              fps: 10,
              bbox: { x: 0, y: 0, w: 10, h: 10 },
            },
          },
        ],
      };

      const dummyState = {
        used: [],
        revealed: ["h1"],
        inventory: [],
        selected: null,
        done: false,
      };

      render(
        <SpriteCanvas
          room={dummyRoom}
          state={dummyState}
          anims={[]}
          setAnims={noop}
          scale={1}
        />,
      );

      act(() => {
        for (const img of images) {
          img.onload?.();
        }
      });

      expect(drawnImages.some((src) => src.includes("h1_sheet"))).toBe(true);
    } finally {
      getContextSpy.mockRestore();
      window.Image = origImage;
    }
  });

  it("switches language mid-round and replays intro in new language", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration").mockImplementation(() => {});
    
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    render(<LangHarness initialLang="en" sceneId={room.id} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Initial mount speaks the room intro
    expect(sound.say).toHaveBeenCalledWith(room.intro);
    vi.mocked(sound.say).mockClear();

    // Switch language to ja via header chip
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Old language speech must be halted
    expect(stopNarrationSpy).toHaveBeenCalled();

    // Should speak the new language intro
    expect(sound.say).toHaveBeenCalledWith(room.t?.ja?.intro ?? room.intro);
    
    cleanup();
    vi.useRealTimers();
  });

  it("does not re-trigger room intro speech when language is switched during win overlay", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb && cb());
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "win").mockImplementation(() => {});

    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    render(<LangHarness initialLang="en" sceneId={room.id} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Solve toyroom to reach win overlay:
    // 1. Pillow twice (reveal and collect key)
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    // 2. Chest twice (unlock with key and collect bone)
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    // 3. Pen to free puppy and win
    fireEvent.click(screen.getByTestId("escape-spot-pen"));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    vi.mocked(sound.say).mockClear();

    // Switch language to Japanese via header language button while win overlay is active
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // The intro problem prompt (puppy trapped crying for help) must NOT be spoken
    const jaIntro = room.t?.ja?.intro ?? room.intro;
    expect(sound.say).not.toHaveBeenCalledWith(jaIntro);
    expect(sound.say).not.toHaveBeenCalled();

    cleanup();
    vi.useRealTimers();
  });

  it("speaks the new room intro when advancing to next room after winning", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb && cb());
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "win").mockImplementation(() => {});

    function FlowHarness() {
      const [sceneId, setSceneId] = useState<string>("toyroom");
      return (
        <LangContext.Provider value={{ lang: "en", onCycle: noop }}>
          <EscapeGame
            onHome={noop}
            onPickScene={(id) => setSceneId(id)}
            onBackToPicker={noop}
            sceneId={sceneId}
            lang="en"
          />
        </LangContext.Provider>
      );
    }

    render(<FlowHarness />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Solve toyroom to win
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-pen"));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    vi.mocked(sound.say).mockClear();

    // Tap Next button on WinOverlay
    const nextBtn = screen.getByTestId("play-again");
    fireEvent.click(nextBtn);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Next room's intro must be spoken
    const rooms = manifest.escape ?? [];
    const nextRoom = rooms.find((r) => r.id !== "toyroom")!;
    expect(sound.say).toHaveBeenCalledWith(nextRoom.intro);

    cleanup();
    vi.useRealTimers();
  });

  it("handles language switch safely mid-round after interacting with a hotspot", () => {
    vi.spyOn(sound, "say").mockImplementation(() => {});
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");

    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];
    const pillow = room.hotspots.find((h) => h.id === "pillow")!;
    const keyItem = room.items.find((i) => i.id === "key")!;
    const jaLabel = keyItem.t?.ja ?? keyItem.label;


    const { rerender } = render(
      <EscapeGame
        onHome={noop}
        sceneId={room.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    // Interact with a hotspot (pillow) to reveal key
    const pillowSpot = screen.getByTestId("escape-spot-pillow");
    fireEvent.click(pillowSpot);

    // Should play English sayFound
    expect(sound.say).toHaveBeenCalledWith(pillow.sayFound);

    // Switch language prop mid-round to 'ja'
    rerender(
      <EscapeGame
        onHome={noop}
        sceneId={room.id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    // Old speech should be stopped safely
    expect(stopNarrationSpy).toHaveBeenCalled();

    // Tap revealed item spot again to collect it
    vi.mocked(sound.say).mockClear();
    fireEvent.click(pillowSpot);

    // Should speak Japanese item label, not old-language speech
    expect(sound.say).toHaveBeenCalledWith(jaLabel);
  });
});


