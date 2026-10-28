// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { Animated, StyleSheet, type TextStyle } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as motion from "../motion";
import { SparkleBurst, TwinkleField } from "./Sparkles";

describe("SparkleBurst", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("centers sparkles with size-proportional margins for size 26", () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as {
        render: (props: { style?: unknown }, ref: unknown) => unknown;
      },
      "render",
    );
    render(<SparkleBurst size={26} trigger={1} />);
    expect(spy).toHaveBeenCalled();
    const props = spy.mock.calls[0][0];
    const flat = StyleSheet.flatten<TextStyle>(props.style as TextStyle);
    expect(flat.marginLeft).toBe(-13);
    expect(flat.marginTop).toBe(-15.6);
  });

  it("centers sparkles with size-proportional margins for size 16", () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as {
        render: (props: { style?: unknown }, ref: unknown) => unknown;
      },
      "render",
    );
    render(<SparkleBurst size={16} trigger={1} />);
    expect(spy).toHaveBeenCalled();
    const props = spy.mock.calls[0][0];
    const flat = StyleSheet.flatten<TextStyle>(props.style as TextStyle);
    expect(flat.marginLeft).toBe(-8);
    expect(flat.marginTop).toBe(-9.6);
  });

  it("hides decorative burst pieces from accessibility tree", () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as {
        render: (
          props: {
            accessibilityElementsHidden?: boolean;
            importantForAccessibility?: string;
            "aria-hidden"?: boolean;
          },
          ref: unknown,
        ) => unknown;
      },
      "render",
    );
    const { container } = render(<SparkleBurst count={4} trigger={1} />);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(call[0].accessibilityElementsHidden).toBe(true);
      expect(call[0].importantForAccessibility).toBe("no");
      expect(call[0]["aria-hidden"]).toBe(true);
    }
    const nodes = container.querySelectorAll('[aria-hidden="true"]');
    expect(nodes.length).toBe(4);
  });
});

describe("TwinkleField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides decorative twinkle pieces from accessibility tree", () => {
    const spy = vi.spyOn(
      Animated.Text as unknown as {
        render: (
          props: {
            accessibilityElementsHidden?: boolean;
            importantForAccessibility?: string;
            "aria-hidden"?: boolean;
          },
          ref: unknown,
        ) => unknown;
      },
      "render",
    );
    const { container } = render(<TwinkleField count={3} />);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(call[0].accessibilityElementsHidden).toBe(true);
      expect(call[0].importantForAccessibility).toBe("no");
      expect(call[0]["aria-hidden"]).toBe(true);
    }
    const nodes = container.querySelectorAll('[aria-hidden="true"]');
    expect(nodes.length).toBe(3);
  });

  it("renders default count of 7 pieces", () => {
    const { container } = render(<TwinkleField />);
    const pieces = container.querySelectorAll('[aria-hidden="true"]');
    expect(pieces.length).toBe(7);
    for (const piece of pieces) {
      expect(piece.textContent).toBe("✨");
    }
  });

  it("positions twinkle pieces based on index", () => {
    const { container } = render(<TwinkleField count={2} />);
    const pieces = container.querySelectorAll<HTMLElement>(
      '[aria-hidden="true"]',
    );
    expect(pieces.length).toBe(2);
    expect(pieces[0].style.left).toBe("14%");
    expect(pieces[0].style.top).toBe("11%");
    expect(pieces[0].style.fontSize).toBe("13px");

    expect(pieces[1].style.left).toBe("59%");
    expect(pieces[1].style.top).toBe("50%");
    expect(pieces[1].style.fontSize).toBe("21px");
  });

  it("renders nothing when reduced motion is preferred", () => {
    vi.spyOn(motion, "prefersReducedMotion").mockReturnValue(true);
    const { container } = render(<TwinkleField />);
    expect(container.innerHTML).toBe("");
  });

  it("stops animation loop on unmount", () => {
    const loopSpy = vi.spyOn(Animated, "loop");
    const { unmount } = render(<TwinkleField count={2} />);
    expect(loopSpy).toHaveBeenCalledTimes(2);
    const firstLoop = loopSpy.mock.results[0].value;
    const stopSpy = vi.spyOn(firstLoop, "stop");
    unmount();
    expect(stopSpy).toHaveBeenCalled();
  });
});
