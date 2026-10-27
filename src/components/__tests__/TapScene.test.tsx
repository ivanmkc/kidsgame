import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, test, vi } from "vitest";
import { Animated } from "react-native";
import { Lang } from "../../lang";
import { t } from "../../i18n";
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

describe("TapScene minimum touch target size", () => {
  const mockSource = { uri: "stub.png" } as unknown as number;

  it("enforces 44px minimum touch target size on small screens and centers it", () => {
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
  });

  it("preserves larger hitboxes that exceed 44px", () => {
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
  });

  it("pads only the sub-44 dimension on asymmetric targets", () => {
    const html = renderToString(
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

    // rawW = (10 + 16) * 1 = 26px -> min 44px. cx = 15. left = 15 - 22 = -7px.
    // rawH = (50 + 16) * 1 = 66px -> unchanged 66px. cy = 35. top = 35 - 33 = 2px.
    expect(html).toContain("width:44px");
    expect(html).toContain("height:66px");
    expect(html).toContain("left:-7px");
    expect(html).toContain("top:2px");
  });

  it("guarantees at least 44px touch targets when scaled down on smaller screens", () => {
    const html = renderToString(
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

    // scale = 0.5. rawW = (40 + 16) * 0.5 = 28 -> min 44px.
    // rawH = (40 + 16) * 0.5 = 28 -> min 44px.
    // cx = (100 + 20) * 0.5 = 60. left = 60 - 22 = 38px.
    // cy = (100 + 20) * 0.5 = 60. top = 60 - 22 = 38px.
    expect(html).toContain("width:44px");
    expect(html).toContain("height:44px");
    expect(html).toContain("left:38px");
    expect(html).toContain("top:38px");
  });

  it("provides accessibilityRole button and localized accessibilityLabel across all supported languages", () => {
    const langs: Lang[] = ["en", "ja", "cmn", "yue"];
    for (const lang of langs) {
      const html = renderToString(
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
          lang={lang}
        />,
      );

      expect(html).toContain('role="button"');
      expect(html).toContain(`aria-label="${t(lang, "a11y.target")}"`);
    }
  });

  it("sizes the visual ring to raw dimensions rather than stretching to the enlarged touch target", () => {
    // rawW = (10 + 16) * 1 = 26px, rawH = (10 + 16) * 1 = 26px.
    // Touch target is enlarged to 44x44px.
    const html = renderToString(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={[{ id: "small", box: { x: 10, y: 10, w: 10, h: 10 } }]}
        foundIds={["small"]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="left"
      />,
    );

    // Touch target Pressable expands to minimum 44x44px
    expect(html).toContain("width:44px;height:44px");
    // Inner visual ring container retains exact raw dimensions (26x26px)
    expect(html).toContain("width:26px;height:26px");
  });

  it("sets aria-disabled on backdrop and targets when disabled is true", () => {
    const html = renderToString(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={[{ id: "target1", box: { x: 10, y: 10, w: 10, h: 10 } }]}
        foundIds={[]}
        onHit={() => {}}
        onMiss={() => {}}
        testIDPrefix="test"
        disabled={true}
      />,
    );

    expect(html).toContain('data-testid="test-backdrop"');
    expect(html).toContain('data-testid="test-target-target1"');
    expect(html).toContain('aria-disabled="true"');
  });
});
