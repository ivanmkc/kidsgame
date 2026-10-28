// @vitest-environment happy-dom
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Animated } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCENES } from "../scenes";
import { JourneyScene } from "../JourneyScene";
import { ScrollingWorld } from "../ScrollingWorld";
import { SpawnedObject, SpawnEntry } from "../SpawnedObject";
import * as music from "../../../music";

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

describe("JourneyScene accessibility", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders stage as a container with accessibility label and not a button", () => {
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    expect(stage).toBeDefined();
    expect(screen.queryByRole("button", { name: "Stage" })).toBeNull();
    unmount();
  });

  it("spawns an object on tap, which receives the lang prop", () => {
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="ja" />);

    const stage = screen.getByLabelText("ステージ");
    fireEvent.pointerDown(stage, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    const note = screen.getByRole("button", { name: "おんぷ" });
    expect(note).toBeDefined();

    unmount();
  });

  it("handles multi-touch without premature scroll penalty and registers second touch while holding", () => {
    const playNoteSpy = vi.spyOn(music, "playNote");
    const springSpy = vi.spyOn(Animated, "spring");

    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    // Initial single-finger touch down: should get full scroll (48) with 1 note played at full velocity (1)
    fireEvent.pointerDown(stage, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    expect(springSpy).toHaveBeenCalled();
    const firstScrollConfig = springSpy.mock.calls[0][1];
    expect(firstScrollConfig.toValue).toBe(48);
    expect(playNoteSpy).toHaveBeenCalledTimes(1);
    expect(playNoteSpy).toHaveBeenLastCalledWith(expect.any(Number), 1);

    expect(screen.getAllByRole("button", { name: "Music note" })).toHaveLength(
      1,
    );

    // Second finger touches while first finger is held: fires onPointerDown with active pointers = 2
    fireEvent.pointerDown(stage, {
      pointerId: 2,
      clientX: 200,
      clientY: 100,
    });

    const scrollSpringCalls = springSpy.mock.calls.filter(
      (c) => c[1].friction === 14 && c[1].tension === 50,
    );
    expect(scrollSpringCalls).toHaveLength(2);
    expect(scrollSpringCalls[0][1].toValue).toBe(48);
    expect(scrollSpringCalls[1][1].toValue).toBeCloseTo(62.4);

    // Initial tap played 1 note at velocity 1; second tap with 2 fingers played 2 notes (harmony chord) at velocity 0.7
    expect(playNoteSpy).toHaveBeenCalledTimes(3);
    expect(playNoteSpy).toHaveBeenNthCalledWith(1, expect.any(Number), 1);
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, expect.any(Number), 0.7);
    expect(playNoteSpy).toHaveBeenNthCalledWith(3, expect.any(Number), 0.7);

    // Second object successfully spawned while first finger was held
    expect(screen.getAllByRole("button", { name: "Music note" })).toHaveLength(
      2,
    );

    unmount();
  });

  it("registers mouse click on stage in web build, playing a note and spawning an object", () => {
    const playNoteSpy = vi.spyOn(music, "playNote");
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    fireEvent.pointerDown(stage, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    expect(playNoteSpy).toHaveBeenCalledTimes(1);
    expect(playNoteSpy).toHaveBeenCalledWith(expect.any(Number), 1);
    expect(screen.getAllByRole("button", { name: "Music note" })).toHaveLength(
      1,
    );

    unmount();
  });

  it("tapping a spawned note does not advance song index, scroll, or spawn new objects", () => {
    // SCENES[1] is 'row': notes are [60, 60, 60, 62, 64, ...]
    const rowScene = SCENES[1];
    const playNoteSpy = vi.spyOn(music, "playNote");
    const springSpy = vi.spyOn(Animated, "spring");

    const { unmount } = render(<JourneyScene scene={rowScene} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    // Three stage taps: play notes 0, 1, 2 (all 60) and spawn 3 objects; next note is 62
    fireEvent.pointerDown(stage, { pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerDown(stage, { pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerDown(stage, { pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    expect(playNoteSpy).toHaveBeenCalledTimes(3);
    expect(playNoteSpy).toHaveBeenNthCalledWith(1, 72, 1);
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 72, 1);
    expect(playNoteSpy).toHaveBeenNthCalledWith(3, 72, 1);
    expect(screen.getAllByRole("button", { name: "Music note" })).toHaveLength(
      3,
    );

    const scrollCallsBefore = springSpy.mock.calls.filter(
      (c) => c[1].friction === 14 && c[1].tension === 50,
    ).length;
    expect(scrollCallsBefore).toBe(3);

    // Tap one of the spawned notes with pointer and click
    const notes = screen.getAllByRole("button", { name: "Music note" });
    fireEvent.pointerDown(notes[0], { pointerId: 2 });
    fireEvent.click(notes[0]);

    // Spawned note tap plays the note sounded when it was spawned (72) rather than previewing next unplayed note (62)
    expect(playNoteSpy).toHaveBeenLastCalledWith(72, 0.5);

    // Spawn count should still be 3 (no new objects spawned)
    expect(screen.getAllByRole("button", { name: "Music note" })).toHaveLength(
      3,
    );

    // Scroll spring calls count should stay the same (no scroll occurred)
    const scrollCallsAfter = springSpy.mock.calls.filter(
      (c) => c[1].friction === 14 && c[1].tension === 50,
    ).length;
    expect(scrollCallsAfter).toBe(scrollCallsBefore);

    // Next stage tap: plays note 3 (62 + 12 = 74) at full velocity, verifying song index was not advanced by note tap
    fireEvent.pointerDown(stage, { pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    expect(playNoteSpy).toHaveBeenLastCalledWith(74, 1);
    expect(screen.getAllByRole("button", { name: "Music note" })).toHaveLength(
      4,
    );

    unmount();
  });

  it("tapping a spawned object replays its spawn note instead of previewing the unplayed song note", () => {
    // Twinkle notes: note 0 is C (60), note 1 is C (60), note 2 is G (67)
    const twinkleScene = SCENES[0];
    const playNoteSpy = vi.spyOn(music, "playNote");

    const { unmount } = render(<JourneyScene scene={twinkleScene} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    // Tap stage twice: plays notes 0 and 1 (both 60 + 12 = 72 at top default yFrac)
    fireEvent.pointerDown(stage, { pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerDown(stage, { pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    expect(playNoteSpy).toHaveBeenNthCalledWith(1, 72, 1);
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 72, 1);

    const notes = screen.getAllByRole("button", { name: "Music note" });
    expect(notes).toHaveLength(2);

    // Tap first spawned object (spawned on note 0). Plays note 0 (72) at 0.5 volume, NOT unplayed note 2 (67 or 79)
    fireEvent.click(notes[0]);
    expect(playNoteSpy).toHaveBeenLastCalledWith(72, 0.5);

    // Tapping stage now plays note 2 (67 + 12 = 79) at full volume without melodic repetition
    fireEvent.pointerDown(stage, { pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    expect(playNoteSpy).toHaveBeenLastCalledWith(79, 1);

    unmount();
  });

  it("renders spawned object with button role and accessibility label", () => {
    const onTapSpawn = vi.fn();
    const entry: SpawnEntry = {
      id: 1,
      x: 50,
      y: 50,
      scrollAtSpawn: 0,
      spriteKey: "obj_sky_star",
      sceneId: "twinkle",
      big: false,
      zone: "sky",
      midi: 60,
    };
    const scrollX = new Animated.Value(0);

    const { unmount } = render(
      <SpawnedObject
        entry={entry}
        scrollX={scrollX}
        onTapSpawn={onTapSpawn}
        lang="en"
      />,
    );

    const button = screen.getByRole("button", { name: "Music note" });
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-label")).toBe("Music note");

    fireEvent.click(button);
    expect(onTapSpawn).toHaveBeenCalledWith(entry);

    unmount();
  });

  it("spawns objects directly at touch coordinate without offset initially and during in-flight scrolling", () => {
    let capturedScrollX: Animated.Value | null = null;
    vi.spyOn(Animated, "spring").mockImplementation((value, config) => {
      if (config.friction === 14 && config.tension === 50) {
        capturedScrollX = value as Animated.Value;
      }
      return {
        start: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn(),
      } as unknown as Animated.CompositeAnimation;
    });

    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    const getVisualCenterX = (button: HTMLElement) => {
      const parent = button.parentElement as HTMLElement;
      const left = parseFloat(parent.style.left);
      const width = parseFloat(parent.style.width);
      const match = parent.style.transform.match(
        /translateX\((-?\d+(?:\.\d+)?)px\)/,
      );
      const translateX = match ? parseFloat(match[1]) : 0;
      return left + width / 2 + translateX;
    };

    // Tap 1: initial tap at x=200 while scrollX is 0
    fireEvent.pointerDown(stage, {
      pointerId: 1,
      offsetX: 200,
      offsetY: 150,
    });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    const notes1 = screen.getAllByRole("button", { name: "Music note" });
    expect(notes1).toHaveLength(1);
    expect(getVisualCenterX(notes1[0])).toBe(200);

    // Simulate scrollX animating in-flight to 16px before Tap 2
    expect(capturedScrollX).not.toBeNull();
    capturedScrollX!.setValue(16);

    // Tap 2 at x=200 while scrollX is in-flight at 16px
    fireEvent.pointerDown(stage, {
      pointerId: 2,
      offsetX: 200,
      offsetY: 150,
    });
    fireEvent.pointerUp(stage, { pointerId: 2 });

    const notes2 = screen.getAllByRole("button", { name: "Music note" });
    expect(notes2).toHaveLength(2);
    expect(getVisualCenterX(notes2[1])).toBe(200);
    expect(getVisualCenterX(notes2[0])).toBe(184);

    // Simulate scrollX animating in-flight to 32px before Tap 3
    capturedScrollX!.setValue(32);

    // Tap 3 at x=200 while scrollX is in-flight at 32px
    fireEvent.pointerDown(stage, {
      pointerId: 3,
      offsetX: 200,
      offsetY: 150,
    });
    fireEvent.pointerUp(stage, { pointerId: 3 });

    const notes3 = screen.getAllByRole("button", { name: "Music note" });
    expect(notes3).toHaveLength(3);
    expect(getVisualCenterX(notes3[2])).toBe(200);
    expect(getVisualCenterX(notes3[1])).toBe(184);
    expect(getVisualCenterX(notes3[0])).toBe(168);

    unmount();
  });

  it("wraps parallax layers modulo 1280 during extended play so scenery never scrolls off-screen", () => {
    // At scrollX = 3840 (80 taps * 48px), without modulo the foreground would scroll to
    // translateX(-3840px), completely past the 2560px container into an empty void.
    const scrollX = new Animated.Value(3840);
    const { container, unmount } = render(
      <ScrollingWorld scrollX={scrollX} scene={SCENES[0]} />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root).toBeDefined();

    // Three parallax layers: bg, mid, fg
    const layers = Array.from(root.children) as HTMLElement[];
    expect(layers).toHaveLength(3);

    // bg: (3840 * 0.2) % 1280 = 768 -> translateX(-768px)
    expect(layers[0].style.transform).toBe("translateX(-768px)");
    // mid: (3840 * 0.5) % 1280 = 640 -> translateX(-640px)
    expect(layers[1].style.transform).toBe("translateX(-640px)");
    // fg: 3840 % 1280 = 0 -> translateX(-0px) or translateX(0px)
    expect(layers[2].style.transform).toMatch(/^translateX\(-?0px\)$/);

    unmount();

    // After 300 taps (scrollX = 14400), background sky would be at -2880px without modulo
    // and scrolled completely off the 2560px container into an empty void.
    const extendedScrollX = new Animated.Value(14400);
    const { container: extContainer, unmount: extUnmount } = render(
      <ScrollingWorld scrollX={extendedScrollX} scene={SCENES[0]} />,
    );
    const extLayers = Array.from(
      (extContainer.firstChild as HTMLElement).children,
    ) as HTMLElement[];
    // bg: (14400 * 0.2) % 1280 = 2880 % 1280 = 320 -> translateX(-320px)
    expect(extLayers[0].style.transform).toBe("translateX(-320px)");
    // mid: (14400 * 0.5) % 1280 = 7200 % 1280 = 800 -> translateX(-800px)
    expect(extLayers[1].style.transform).toBe("translateX(-800px)");
    // fg: 14400 % 1280 = 320 -> translateX(-320px)
    expect(extLayers[2].style.transform).toBe("translateX(-320px)");

    extUnmount();
  });

  it("plays diatonic harmony on multi-touch without chromatic sharps", () => {
    // Twinkle notes: 0: C(60), 1: C(60), 2: G(67), 3: G(67), 4: A(69), 5: A(69)
    const playNoteSpy = vi.spyOn(music, "playNote");
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    // Advance 4 notes (0..3) with single taps
    for (let i = 1; i <= 4; i++) {
      fireEvent.pointerDown(stage, {
        pointerId: i,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerUp(stage, { pointerId: i });
    }

    playNoteSpy.mockClear();

    // 2-finger tap: hold finger 10, then touch finger 11 (active count = 2 on note 5: A)
    fireEvent.pointerDown(stage, {
      pointerId: 10,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerDown(stage, {
      pointerId: 11,
      clientX: 200,
      clientY: 100,
    });

    // Note 5 is A (69 + 12 = 81 in top third). Diatonic minor third above A is C (84), not C# (85).
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 81, 0.7);
    expect(playNoteSpy).toHaveBeenNthCalledWith(3, 84, 0.7);

    unmount();
  });

  it("plays diatonic harmony on multi-touch without chromatic sharps", () => {
    // Twinkle notes: 0: C(60), 1: C(60), 2: G(67), 3: G(67), 4: A(69), 5: A(69)
    const playNoteSpy = vi.spyOn(music, "playNote");
    const { unmount } = render(<JourneyScene scene={SCENES[0]} lang="en" />);
    const stage = screen.getByLabelText("Stage");

    // Advance 4 notes (0..3) with single taps
    for (let i = 1; i <= 4; i++) {
      fireEvent.pointerDown(stage, {
        pointerId: i,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerUp(stage, { pointerId: i });
    }

    playNoteSpy.mockClear();

    // 2-finger tap: hold finger 10, then touch finger 11 (active count = 2 on note 5: A)
    fireEvent.pointerDown(stage, {
      pointerId: 10,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerDown(stage, {
      pointerId: 11,
      clientX: 200,
      clientY: 100,
    });

    // Note 5 is A (69 + 12 = 81 in top third). Diatonic minor third above A is C (84), not C# (85).
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 81, 0.7);
    expect(playNoteSpy).toHaveBeenNthCalledWith(3, 84, 0.7);

    unmount();
  });

  it("freePlay mode plays pentatonic scale without song melody constraints", () => {
    const playNoteSpy = vi.spyOn(music, "playNote");
    const { unmount } = render(
      <JourneyScene scene={SCENES[0]} freePlay={true} lang="en" />,
    );
    const stage = screen.getByLabelText("Stage");

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1 });

    expect(playNoteSpy).toHaveBeenCalledTimes(2);
    // Tap 1: pentatonic 60 + 12 = 72
    expect(playNoteSpy).toHaveBeenNthCalledWith(1, 72, 1);
    // Tap 2: free play plays PENTATONIC[3] (67 + 12 = 79), differing from Twinkle's note 1 (72)
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 79, 1);

    unmount();
  });

  it("richChords mode sounds harmonic chord on single-finger tap", () => {
    const playNoteSpy = vi.spyOn(music, "playNote");
    const { unmount } = render(
      <JourneyScene scene={SCENES[0]} richChords={true} lang="en" />,
    );
    const stage = screen.getByLabelText("Stage");

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(playNoteSpy).toHaveBeenCalledTimes(2);
    expect(playNoteSpy).toHaveBeenNthCalledWith(1, 72, 0.7);
    expect(playNoteSpy).toHaveBeenNthCalledWith(2, 76, 0.7);

    unmount();
  });
});
