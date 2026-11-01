// @vitest-environment happy-dom
import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { manifest } from "../../../manifest";
import { t } from "../../../i18n";
import { EscapeGame } from "../EscapeGame";

vi.mock("../../../assets/images", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    SCENE_IMAGES: new Proxy(
      {},
      { get: (_, prop) => ({ uri: `highres-${String(prop)}` }) },
    ),
    SCENE_THUMBS: new Proxy(
      {},
      { get: (_, prop) => ({ uri: `thumb-${String(prop)}` }) },
    ),
  };
});

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

describe("EscapeGame", () => {
  const noop = () => {};

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

  it("disables flavor hotspots behind win overlay when room is completed", () => {
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

    // Before winning, teddy flavor hotspot is active and pressable
    const teddyBefore = screen.getByTestId("escape-spot-teddy");
    expect(teddyBefore.getAttribute("aria-disabled")).not.toBe("true");
    expect(teddyBefore.getAttribute("role")).toBe("button");
    expect(teddyBefore.style.pointerEvents).toBe("auto");

    // Solve the toyroom chain to win:
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-pen"));

    // After winning, teddy flavor hotspot is disabled with role none and pointerEvents none
    const teddyAfter = screen.getByTestId("escape-spot-teddy");
    expect(teddyAfter.getAttribute("aria-disabled")).toBe("true");
    expect(teddyAfter.getAttribute("role")).not.toBe("button");
    expect(teddyAfter.style.pointerEvents).toBe("none");

    // Tapping teddy does nothing (no feedback burst or sound)
    vi.mocked(sound.say).mockClear();
    vi.mocked(sfx.tap).mockClear();
    fireEvent.click(teddyAfter);
    expect(sound.say).not.toHaveBeenCalled();
    expect(sfx.tap).not.toHaveBeenCalled();
    expect(screen.queryByTestId("escape-feedback-teddy")).toBeNull();
  });

  it("renders FilterCycleChip and cycles difficulty filter on press", () => {
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
    const cycleBtn = screen.getByTestId("difficulty-cycle");
    expect(cycleBtn).toBeTruthy();
    fireEvent.click(cycleBtn);
    expect(onFilter).toHaveBeenCalledWith("medium");
  });

  it("dims rooms that do not match the active difficulty filter", () => {
    const { unmount } = render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
        filter="easy"
      />,
    );
    const easyToy = screen.getByTestId("scene-pick-toyroom");
    const easyPirate = screen.getByTestId("scene-pick-piratecove");
    expect(window.getComputedStyle(easyToy).opacity).not.toBe("0.32");
    expect(window.getComputedStyle(easyPirate).opacity).toBe("0.32");

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
    const hardToy = screen.getByTestId("scene-pick-toyroom");
    const hardPirate = screen.getByTestId("scene-pick-piratecove");
    expect(window.getComputedStyle(hardToy).opacity).toBe("0.32");
    expect(window.getComputedStyle(hardPirate).opacity).toBe("0.32");
  });

  it("surprise button picks from rooms matching active filter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
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
    fireEvent.click(screen.getByTestId("scene-surprise"));
    expect(onPickScene).toHaveBeenCalledWith("dragoncave");
  });

  it("tapping Next on WinOverlay cycles to next room in the difficulty pool", () => {
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
    fireEvent.click(screen.getByTestId("escape-spot-haystack"));
    // 2. Tap haystack to collect egg
    fireEvent.click(screen.getByTestId("escape-spot-haystack"));
    // 3. Unlock stove with egg to cook pancake
    fireEvent.click(screen.getByTestId("escape-spot-stove"));
    // 4. Tap stove to collect pancake
    fireEvent.click(screen.getByTestId("escape-spot-stove"));
    // 5. Feed pancake to dragon -> triggers win state!
    fireEvent.click(screen.getByTestId("escape-spot-dragon"));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const nextBtn = screen.getByTestId("play-again");
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);

    // In easy pool (toyroom, dragoncave), Next wraps around to toyroom.
    // Unfiltered index progression would have stepped to piratecove.
    expect(onPickScene).toHaveBeenCalledWith("toyroom");
  });

  it("idle hint delay uses filter over global difficulty (easy 8s vs hard 18s)", () => {
    const { unmount } = render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId="toyroom"
        difficulty="hard" // global difficulty is hard
        filter="easy" // but filter is easy
        lang="en"
      />,
    );

    const pillow = screen.getByTestId("escape-spot-pillow");
    expect(pillow.children.length).toBe(0);

    // After 7s, hint has not triggered
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(pillow.children.length).toBe(0);

    // After 8.5s total, hint has triggered because filter is easy
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

    const medPillow = screen.getByTestId("escape-spot-pillow");
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

  it("speaks item label when item in inventory tray is tapped", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];
    const keyItem = room.items.find((i) => i.id === "key")!;

    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="en"
      />,
    );

    // Reveal and collect key
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));

    const trayKey = screen.getByTestId("escape-item-key");
    expect(trayKey).toBeTruthy();

    vi.mocked(sound.say).mockClear();
    vi.mocked(sfx.tap).mockClear();

    fireEvent.click(trayKey);
    expect(sfx.tap).toHaveBeenCalledOnce();
    expect(sound.say).toHaveBeenCalledWith(keyItem.label);
  });

  it("speaks localized item label when item in inventory tray is tapped in non-English language", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];
    const keyItem = room.items.find((i) => i.id === "key")!;
    const jaLabel = keyItem.t?.ja ?? keyItem.label;

    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="ja"
      />,
    );

    // Reveal and collect key
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));

    const trayKey = screen.getByTestId("escape-item-key");
    expect(trayKey).toBeTruthy();

    vi.mocked(sound.say).mockClear();
    vi.mocked(sfx.tap).mockClear();

    fireEvent.click(trayKey);
    expect(sfx.tap).toHaveBeenCalledOnce();
    expect(sound.say).toHaveBeenCalledWith(jaLabel);
  });

  it("speaks sayFound on container reveal and announces item label on collection", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];
    const pillow = room.hotspots.find((h) => h.id === "pillow")!;
    const chest = room.hotspots.find((h) => h.id === "chest")!;
    const keyItem = room.items.find((i) => i.id === "key")!;
    const boneItem = room.items.find((i) => i.id === "bone")!;

    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="en"
      />,
    );

    // Initial mount speaks room intro
    expect(sound.say).toHaveBeenCalledWith(room.intro);
    vi.mocked(sound.say).mockClear();

    // 1. Search pillow to reveal key: should speak pillow's sayFound
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    expect(sound.say).toHaveBeenCalledWith(pillow.sayFound);

    vi.mocked(sound.say).mockClear();

    // 2. Tap pillow to collect key: should announce key item's label
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    expect(sound.say).toHaveBeenCalledWith(keyItem.label);

    vi.mocked(sound.say).mockClear();

    // 3. Unlock chest with key: reveals bone and speaks chest's sayFound
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    expect(sound.say).toHaveBeenCalledWith(chest.sayFound);

    vi.mocked(sound.say).mockClear();

    // 4. Tap chest to collect bone: should announce bone item's label
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    expect(sound.say).toHaveBeenCalledWith(boneItem.label);
  });

  it("speaks localized sayFound on container reveal and localized item label on collection", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];
    const pillow = room.hotspots.find((h) => h.id === "pillow")!;
    const keyItem = room.items.find((i) => i.id === "key")!;
    const jaFound = pillow.t?.ja?.sayFound ?? pillow.sayFound;
    const jaLabel = keyItem.t?.ja ?? keyItem.label;

    render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="ja"
      />,
    );

    vi.mocked(sound.say).mockClear();

    // Reveal key
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    expect(sound.say).toHaveBeenCalledWith(jaFound);

    vi.mocked(sound.say).mockClear();

    // Collect key
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    expect(sound.say).toHaveBeenCalledWith(jaLabel);
  });

  it("stops playing narration when language is switched via header button mid-game", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    render(<LangHarness initialLang="en" sceneId={room.id} />);

    expect(sound.say).toHaveBeenCalledWith(room.intro);
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    // Switch language to ja via header chip
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // Old language speech must be halted
    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);

    // UI text translates to the new language
    expect(screen.getByText(room.nameT?.ja ?? room.name)).toBeDefined();
    expect(screen.getByText(t("ja", "shell.escape.subPlay"))).toBeDefined();

    // Replay button is labeled in the new language and replays the new intro
    vi.mocked(sound.say).mockClear();
    const replayBtn = screen.getByTestId("escape-replay");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("ja", "spell.hearAgain"),
    );
    fireEvent.click(replayBtn);
    expect(sound.say).toHaveBeenCalledWith(room.t?.ja?.intro ?? room.intro);
  });

  it("halts win narration when language is switched during win overlay", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    render(<LangHarness initialLang="en" sceneId={room.id} />);

    stopNarrationSpy.mockClear();

    // Complete the room to win
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-pillow"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-chest"));
    fireEvent.click(screen.getByTestId("escape-spot-pen"));

    // Switch language while win overlay is active
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    expect(stopNarrationSpy).toHaveBeenCalled();
    const jaWin = room.t?.ja?.winText ?? room.winText;
    expect(screen.getByText(jaWin)).toBeDefined();
  });

  it("renders high-resolution scene image as background instead of thumbnail", () => {
    const rooms = manifest.escape ?? [];
    const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

    const { container } = render(
      <EscapeGame
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        sceneId={room.id}
        lang="en"
      />,
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(`highres-${room.image}`);
    expect(img?.getAttribute("src")).not.toContain("thumb");
  });

  it("clamps displayWidth to minimum 256px when window width dips below 24px", () => {
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    try {
      setViewport(20, 600);
      const rooms = manifest.escape ?? [];
      const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

      const { container } = render(
        <EscapeGame
          onHome={noop}
          onPickScene={noop}
          onBackToPicker={noop}
          sceneId={room.id}
          lang="en"
        />,
      );

      const img = container.querySelector("img");
      expect(img).toBeDefined();
      expect((img?.parentElement as HTMLElement)?.style.width).toBe("256px");
      expect((img?.parentElement as HTMLElement)?.style.height).toBe("144px");
    } finally {
      setViewport(origW, origH);
    }
  });

  it("renders 256px frame on a 280px narrow viewport without overflowing", () => {
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    try {
      setViewport(280, 600);
      const rooms = manifest.escape ?? [];
      const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

      const { container } = render(
        <EscapeGame
          onHome={noop}
          onPickScene={noop}
          onBackToPicker={noop}
          sceneId={room.id}
          lang="en"
        />,
      );

      const img = container.querySelector("img");
      expect(img).toBeDefined();
      expect((img?.parentElement as HTMLElement)?.style.width).toBe("256px");
      expect((img?.parentElement as HTMLElement)?.style.height).toBe("144px");
    } finally {
      setViewport(origW, origH);
    }
  });

  it("restricts scene frame size in mobile landscape so inventory tray fits on screen", () => {
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    try {
      setViewport(667, 375);
      const rooms = manifest.escape ?? [];
      const room = rooms.find((r) => r.id === "toyroom") ?? rooms[0];

      const { container } = render(
        <EscapeGame
          onHome={noop}
          onPickScene={noop}
          onBackToPicker={noop}
          sceneId={room.id}
          lang="en"
        />,
      );

      const img = container.querySelector("img");
      expect(img).toBeDefined();
      expect((img?.parentElement as HTMLElement)?.style.width).toBe("346px");
      expect((img?.parentElement as HTMLElement)?.style.height).toBe("194.625px");
      expect(screen.getByTestId("escape-tray")).toBeDefined();
    } finally {
      setViewport(origW, origH);
    }
  });
});

