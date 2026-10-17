import * as React from "react";
import { renderToString } from "react-dom/server";
import { test, expect, vi } from "vitest";
import { Animated } from "react-native";
import { TapScene } from "../TapScene";

const effects: React.EffectCallback[] = [];
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  const mockEffect = (cb: React.EffectCallback) => effects.push(cb);
  return {
    ...actual,
    useEffect: mockEffect,
    default: {
      ...actual,
      useEffect: mockEffect,
    },
  };
});

test("TapScene hint loop stops on unmount", () => {
  const stopSpy = vi.fn();
  const startSpy = vi.fn();
  const mockAnimation: Animated.CompositeAnimation = {
    start: startSpy,
    stop: stopSpy,
    reset: vi.fn(),
  };
  vi.spyOn(Animated, "loop").mockReturnValue(mockAnimation);

  const mockSource = { uri: "stub.png" } as unknown as number;

  renderToString(
    <TapScene
      source={mockSource}
      sceneW={100}
      sceneH={100}
      displayWidth={100}
      boxes={[{ id: "a", box: { x: 0, y: 0, w: 10, h: 10 } }]}
      foundIds={[]}
      hintId="a"
      onHit={() => {}}
      onMiss={() => {}}
      testIDPrefix="test"
    />,
  );

  const cleanups = effects
    .map((cb) => cb())
    .filter((res) => typeof res === "function") as Array<() => void>;

  expect(startSpy).toHaveBeenCalled();

  cleanups.forEach((cleanup) => cleanup());
  expect(stopSpy).toHaveBeenCalled();
});

test("enforces 44px minimum touch target size on small screens and centers it", () => {
  const mockSource = { uri: "stub.png" } as unknown as number;

  // Farm white duck: w=99, h=88 in 1280x720 scene.
  // On mobile portrait with displayWidth=366 (scale = 366 / 1280 = 0.2859375),
  // raw size with PAD=8 was (99 + 16) * scale = 32.88px by (88 + 16) * scale = 29.74px (< 44px).
  const html = renderToString(
    <TapScene
      source={mockSource}
      sceneW={1280}
      sceneH={720}
      displayWidth={366}
      boxes={[
        {
          id: "duck",
          box: { x: 1105, y: 388, w: 99, h: 88 },
        },
      ]}
      foundIds={[]}
      onHit={() => {}}
      onMiss={() => {}}
      testIDPrefix="test"
    />,
  );

  expect(html).toContain('data-testid="test-target-duck"');
  expect(html).toContain("width:44px");
  expect(html).toContain("height:44px");
  expect(html).toContain("left:308.11");
  expect(html).toContain("top:101.525px");
  expect(html).toContain('role="button"');
  expect(html).toContain('aria-label="Target"');
});

test("preserves larger hitboxes that exceed 44px", () => {
  const mockSource = { uri: "stub.png" } as unknown as number;

  const html = renderToString(
    <TapScene
      source={mockSource}
      sceneW={1000}
      sceneH={1000}
      displayWidth={1000}
      boxes={[{ id: "barn", box: { x: 100, y: 100, w: 400, h: 300 } }]}
      foundIds={[]}
      onHit={() => {}}
      onMiss={() => {}}
      testIDPrefix="test"
    />,
  );

  expect(html).toContain('data-testid="test-target-barn"');
  // (400 + 2 * 8) * 1 = 416px, (300 + 2 * 8) * 1 = 316px
  expect(html).toContain("width:416px");
  expect(html).toContain("height:316px");
  expect(html).toContain("left:92px");
  expect(html).toContain("top:92px");
  expect(html).toContain('role="button"');
  expect(html).toContain('aria-label="Target"');
});
