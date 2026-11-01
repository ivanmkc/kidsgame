// @vitest-environment happy-dom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Text, View } from "react-native";
import { FlipCard, MemoryBoard } from "../MemoryBoard";

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
  if (window.visualViewport) {
    Object.defineProperty(window.visualViewport, "width", {
      value: width,
      configurable: true,
    });
    Object.defineProperty(window.visualViewport, "height", {
      value: height,
      configurable: true,
    });
  }
  window.dispatchEvent(new Event("resize"));
}

describe("FlipCard", () => {
  it("renders face-down card with accessibility label and triggers onFlip on press", () => {
    const onFlip = vi.fn();
    render(
      <FlipCard
        size={100}
        up={false}
        onFlip={onFlip}
        testID="card-1"
        accessibilityLabel="face-down card"
        renderCardFace={(size) => (
          <Text testID="face-text">{`Face ${size}`}</Text>
        )}
      />,
    );

    const card = screen.getByTestId("card-1");
    expect(card).toBeDefined();
    expect(card.getAttribute("aria-label")).toBe("face-down card");
    expect(screen.getByText("❓")).toBeDefined();

    fireEvent.click(card);
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it("renders card face using generic render prop when face up", () => {
    render(
      <FlipCard
        size={120}
        up={true}
        onFlip={vi.fn()}
        testID="card-up"
        accessibilityLabel="cat icon"
        renderCardFace={(size) => (
          <Text testID="face-content">{`Custom face ${size}`}</Text>
        )}
      />,
    );

    expect(screen.getByTestId("card-up").getAttribute("aria-label")).toBe(
      "cat icon",
    );
    expect(screen.getByTestId("face-content")).toBeDefined();
    expect(screen.getByText("Custom face 120")).toBeDefined();
  });

  it("renders matched state with sparkles and owner color tint", () => {
    const { container } = render(
      <FlipCard
        size={100}
        up={true}
        matched={true}
        ownerColor="#ff0000"
        sparkleTrigger="cat"
        onFlip={vi.fn()}
        testID="card-matched"
        accessibilityLabel="matched card"
        renderCardFace={() => <Text>Matched Face</Text>}
      />,
    );

    expect(screen.getByText("Matched Face")).toBeDefined();
    expect(screen.getByTestId("card-matched")).toBeDefined();
    expect(container.innerHTML).toContain("rgba(255, 0, 0, 0.12)");
  });

  it("disables Pressable when card is up or matched to prevent screen readers from reading as interactive", () => {
    const { rerender } = render(
      <FlipCard
        size={100}
        up={false}
        matched={false}
        onFlip={vi.fn()}
        testID="card-interactive"
        accessibilityLabel="card"
        renderCardFace={() => <Text>Face</Text>}
      />,
    );
    expect(
      screen.getByTestId("card-interactive").hasAttribute("disabled"),
    ).toBe(false);

    rerender(
      <FlipCard
        size={100}
        up={true}
        matched={false}
        onFlip={vi.fn()}
        testID="card-interactive"
        accessibilityLabel="card"
        renderCardFace={() => <Text>Face</Text>}
      />,
    );
    expect(
      screen.getByTestId("card-interactive").hasAttribute("disabled"),
    ).toBe(true);

    rerender(
      <FlipCard
        size={100}
        up={false}
        matched={true}
        onFlip={vi.fn()}
        testID="card-interactive"
        accessibilityLabel="card"
        renderCardFace={() => <Text>Face</Text>}
      />,
    );
    expect(
      screen.getByTestId("card-interactive").hasAttribute("disabled"),
    ).toBe(true);
  });
});

describe("MemoryBoard", () => {
  beforeEach(() => {
    setViewport(800, 600);
  });

  it("calculates card size and renders children in responsive grid", () => {
    let receivedSize = 0;
    render(
      <MemoryBoard cardCount={8} testID="test-board">
        {(cardSize) => {
          receivedSize = cardSize;
          return (
            <View testID="board-child">
              <Text>{`Card size: ${cardSize}`}</Text>
            </View>
          );
        }}
      </MemoryBoard>,
    );

    expect(screen.getByTestId("test-board")).toBeDefined();
    expect(screen.getByTestId("board-child")).toBeDefined();
    expect(receivedSize).toBeGreaterThan(0);
    expect(receivedSize).toBeLessThanOrEqual(150);
  });

  it("adjusts available space with extraPaddingW and extraPaddingH", () => {
    let soloSize = 0;
    let duelSize = 0;

    render(
      <MemoryBoard cardCount={12} extraPaddingW={0} extraPaddingH={64}>
        {(cardSize) => {
          soloSize = cardSize;
          return null;
        }}
      </MemoryBoard>,
    );

    render(
      <MemoryBoard cardCount={12} extraPaddingW={26} extraPaddingH={92}>
        {(cardSize) => {
          duelSize = cardSize;
          return null;
        }}
      </MemoryBoard>,
    );

    expect(soloSize).toBeGreaterThan(0);
    expect(duelSize).toBeGreaterThan(0);
    expect(duelSize).toBeLessThanOrEqual(soloSize);
  });
});
