import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChunkyButton } from "../ChunkyButton";

describe("ChunkyButton", () => {
  it('renders with accessibilityRole="button" and accessibilityLabel', () => {
    const html = renderToString(
      <ChunkyButton
        label="Next"
        color="#0f0"
        darkColor="#060"
        onPress={vi.fn()}
        testID="play-again"
      />,
    );
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Next"');
    expect(html).toContain('data-testid="play-again"');
  });

  it("forwards disabled prop to Pressable", () => {
    const html = renderToString(
      <ChunkyButton
        label="Next"
        color="#0f0"
        darkColor="#060"
        onPress={vi.fn()}
        disabled={true}
      />,
    );
    expect(html).toContain('aria-disabled="true"');
  });
});
