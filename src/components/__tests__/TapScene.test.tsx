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
