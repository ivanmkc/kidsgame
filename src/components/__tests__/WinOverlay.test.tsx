// @vitest-environment happy-dom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sfx } from "../../sound";
import { WinOverlay } from "../WinOverlay";

describe("WinOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("allows message to wrap up to 3 lines without capping at 2 lines", () => {
    const html = renderToString(
      <WinOverlay
        visible={true}
        message="Sharp eyes! You compared like a champ!"
        onNext={vi.fn()}
        onHome={vi.fn()}
      />,
    );
    expect(html).toContain("Sharp eyes! You compared like a champ!");
    expect(html).toContain("-webkit-line-clamp:3");
    expect(html).not.toContain("-webkit-line-clamp:2");
  });

  it("renders nothing when not visible", () => {
    const html = renderToString(
      <WinOverlay
        visible={false}
        message="Sharp eyes! You compared like a champ!"
        onNext={vi.fn()}
        onHome={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("renders action buttons with accessibility roles and testIDs", () => {
    const html = renderToString(
      <WinOverlay
        visible={true}
        message="Great job!"
        onNext={vi.fn()}
        onHome={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="play-again"');
    expect(html).toContain('data-testid="win-home"');
    expect(html).toContain('role="alert"');
  });

  it("suppresses button tap feedback and action until 600ms arming window passes", () => {
    const tapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const onNext = vi.fn();
    const onHome = vi.fn();
    render(
      <WinOverlay
        visible={true}
        message="Great job!"
        onNext={onNext}
        onHome={onHome}
      />,
    );

    const nextBtn = screen.getByTestId("play-again");
    const homeBtn = screen.getByTestId("win-home");

    // Before arming (0ms), clicking produces no false tap sound and does not trigger action
    fireEvent.click(nextBtn);
    expect(tapSpy).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(homeBtn);
    expect(tapSpy).not.toHaveBeenCalled();
    expect(onHome).not.toHaveBeenCalled();

    // Advance 600ms to arm the overlay
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // After arming, buttons play tap sound and execute callbacks
    fireEvent.click(nextBtn);
    expect(tapSpy).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(homeBtn);
    expect(tapSpy).toHaveBeenCalledTimes(2);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
