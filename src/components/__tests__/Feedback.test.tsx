// @vitest-environment happy-dom
import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { FeedbackChip } from "../Feedback";
import * as analytics from "../../analytics";
import * as nav from "../../nav";
import { t } from "../../i18n";

vi.mock("../../sound", () => ({
  sfx: { tap: vi.fn(), good: vi.fn() },
}));

describe("FeedbackChip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(analytics, "track").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders open button and opens modal", () => {
    render(<FeedbackChip lang="en" />);
    const openBtn = screen.getByRole("button", {
      name: t("en", "feedback.chip"),
    });
    expect(openBtn).toBeDefined();

    fireEvent.click(openBtn);
    expect(
      screen.getByRole("button", { name: t("en", "feedback.broken") }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: t("en", "feedback.idea") }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: t("en", "feedback.cancel") }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: t("en", "feedback.send") }),
    ).toBeDefined();
  });

  it("exposes selection through accessibilityState on kind buttons", () => {
    render(<FeedbackChip lang="en" />);
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );

    const brokenBtn = screen.getByRole("button", {
      name: t("en", "feedback.broken"),
    });
    const ideaBtn = screen.getByRole("button", {
      name: t("en", "feedback.idea"),
    });

    expect(brokenBtn.getAttribute("aria-selected")).toBe("false");
    expect(ideaBtn.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(brokenBtn);
    expect(brokenBtn.getAttribute("aria-selected")).toBe("true");
    expect(ideaBtn.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(ideaBtn);
    expect(brokenBtn.getAttribute("aria-selected")).toBe("false");
    expect(ideaBtn.getAttribute("aria-selected")).toBe("true");
  });

  it("ensures Send and Cancel buttons have at least 44pt touch height and center alignment", () => {
    render(<FeedbackChip lang="en" />);
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );

    const sendBtn = screen.getByRole("button", {
      name: t("en", "feedback.send"),
    });
    const cancelBtn = screen.getByRole("button", {
      name: t("en", "feedback.cancel"),
    });

    expect(window.getComputedStyle(sendBtn).minHeight).toBe("44px");
    expect(window.getComputedStyle(sendBtn).justifyContent).toBe("center");
    expect(window.getComputedStyle(cancelBtn).minHeight).toBe("44px");
    expect(window.getComputedStyle(cancelBtn).justifyContent).toBe("center");
  });

  it("translates modal button accessibility labels in another language", () => {
    render(<FeedbackChip lang="ja" />);
    fireEvent.click(
      screen.getByRole("button", { name: t("ja", "feedback.chip") }),
    );

    expect(
      screen.getByRole("button", { name: t("ja", "feedback.broken") }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: t("ja", "feedback.idea") }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: t("ja", "feedback.cancel") }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: t("ja", "feedback.send") }),
    ).toBeDefined();
  });

  it("sends extended feedback payload when track is called", () => {
    vi.spyOn(nav, "readHash").mockReturnValue("story/dog");

    render(<FeedbackChip lang="en" />);

    // Open modal
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );

    // Select 'idea'
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.idea") }),
    );

    // Enter text
    const input = screen.getByPlaceholderText(t("en", "feedback.placeholder"));
    fireEvent.change(input, { target: { value: "Awesome app!" } });

    // Send
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.send") }),
    );

    expect(analytics.track).toHaveBeenCalledWith(
      "feedback",
      expect.objectContaining({
        kind: "idea",
        text: "Awesome app!",
        gameId: "story",
        sceneId: "dog",
        screen: "story/dog",
        lang: "en",
        viewport: "0x0",
      }),
    );

    const calls = vi.mocked(analytics.track).mock.calls;
    expect(calls[0][1]?.uuid).toBeDefined();
  });

  it("clears the reset timer on dismissal so reopening is not prematurely closed", () => {
    render(<FeedbackChip lang="en" />);

    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.broken") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.send") }),
    );
    expect(screen.getByText(t("en", "feedback.thanks"))).toBeDefined();

    vi.advanceTimersByTime(500);
    expect(vi.getTimerCount()).toBe(1);
    const animDiv = document.querySelector('[class*="animationDuration"]');
    if (animDiv) fireEvent.animationEnd(animDiv);
    fireEvent.keyUp(document, { key: "Escape" });
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );
    const input = screen.getByPlaceholderText(
      t("en", "feedback.placeholder"),
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Typing new feedback" } });
    expect(input.value).toBe("Typing new feedback");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(input.value).toBe("Typing new feedback");
  });

  it("clears the reset timer on unmount", () => {
    const { unmount } = render(<FeedbackChip lang="en" />);

    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.broken") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.send") }),
    );

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("automatically resets and clears timer after 1400ms on send", () => {
    render(<FeedbackChip lang="en" />);

    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.broken") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.send") }),
    );

    expect(screen.getByText(t("en", "feedback.thanks"))).toBeDefined();
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(
      screen.getByRole("button", { name: t("en", "feedback.chip") }),
    );
    expect(
      screen.getByRole("button", { name: t("en", "feedback.send") }),
    ).toBeDefined();
  });
});
