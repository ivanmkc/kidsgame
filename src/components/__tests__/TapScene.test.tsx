import * as React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { Animated, type PressableProps } from "react-native";
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

type FakePressableProps = Partial<PressableProps>;
const capturedPressableMap: Record<string, FakePressableProps> = {};

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable =
    actual.Pressable as React.ComponentType<FakePressableProps>;
  return {
    ...actual,
    Pressable: (props: FakePressableProps) => {
      if (typeof props.testID === "string") {
        capturedPressableMap[props.testID] = props;
      }
      return React.createElement(ActualPressable, props);
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

describe("TapScene hitSlop minimum touch size", () => {
  beforeEach(() => {
    for (const k in capturedPressableMap) {
      delete capturedPressableMap[k];
    }
  });

  const mockSource = { uri: "stub.png" } as unknown as number;

  it("applies computed hitSlop to small target Pressable so touch area is at least 44x44px", () => {
    renderToString(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={[{ id: "small", box: { x: 10, y: 10, w: 10, h: 10 } }]}
        foundIds={[]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="left"
      />,
    );

    const target = capturedPressableMap["left-target-small"];
    expect(target).toBeDefined();
    // PAD = 8. At scale 1, w = 26, h = 26.
    expect(target.hitSlop).toEqual({ top: 9, bottom: 9, left: 9, right: 9 });
  });

  it("applies 0 hitSlop for target Pressable already larger than 44px", () => {
    renderToString(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={[{ id: "large", box: { x: 10, y: 10, w: 50, h: 50 } }]}
        foundIds={[]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="right"
      />,
    );

    const target = capturedPressableMap["right-target-large"];
    expect(target).toBeDefined();
    expect(target.hitSlop).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("pads only the sub-44 dimension on asymmetric targets", () => {
    renderToString(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={[{ id: "asym", box: { x: 10, y: 10, w: 10, h: 50 } }]}
        foundIds={[]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="diff"
      />,
    );

    const target = capturedPressableMap["diff-target-asym"];
    expect(target).toBeDefined();
    // w = 26 (needs 9+9), h = 66 (needs 0)
    expect(target.hitSlop).toEqual({ top: 0, bottom: 0, left: 9, right: 9 });
  });

  it("guarantees at least 44px touch targets when scaled down on smaller screens", () => {
    renderToString(
      <TapScene
        source={mockSource}
        sceneW={800}
        sceneH={600}
        displayWidth={400}
        boxes={[{ id: "scaled", box: { x: 100, y: 100, w: 40, h: 40 } }]}
        foundIds={[]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="hidden"
      />,
    );

    const target = capturedPressableMap["hidden-target-scaled"];
    expect(target).toBeDefined();
    // scale = 0.5. w = (40 + 16) * 0.5 = 28. (44 - 28) / 2 = 8.
    expect(target.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });
});

describe("TapScene accessibilityLabel localization", () => {
  beforeEach(() => {
    for (const k in capturedPressableMap) {
      delete capturedPressableMap[k];
    }
  });

  const mockSource = { uri: "stub.png" } as unknown as number;

  it("defaults backdrop accessibilityLabel to English 'scene'", () => {
    renderToString(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={[]}
        foundIds={[]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="test"
      />,
    );
    expect(capturedPressableMap["test-backdrop"]?.accessibilityLabel).toBe("scene");
  });

  it("localizes backdrop accessibilityLabel with Japanese 'ばめん'", () => {
    renderToString(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={[]}
        foundIds={[]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="test"
        lang="ja"
      />,
    );
    expect(capturedPressableMap["test-backdrop"]?.accessibilityLabel).toBe("ばめん");
  });
});
