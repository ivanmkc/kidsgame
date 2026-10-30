// @vitest-environment happy-dom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sfx } from "../../sound";
import { routeParts, useRoute } from "../../nav";
import { useLockdown } from "../../lockdown";
import { WinOverlay } from "../WinOverlay";

function RouteHost() {
  const [route] = useRoute();
  const { screen: currentScreen } = routeParts(route);
  return (
    <div>
      <div data-testid="active-screen">{currentScreen}</div>
      {currentScreen === "letters" && (
        <WinOverlay
          visible={true}
          message="Great job!"
          onNext={vi.fn()}
          onHome={vi.fn()}
        />
      )}
      {currentScreen === "spell" && (
        <div data-testid="spell-screen">Word Builder Screen</div>
      )}
    </div>
  );
}

describe("WinOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.location.hash = "";
    window.localStorage.clear();
    delete (document.documentElement as unknown as { clientWidth?: number })
      .clientWidth;
    delete (document.documentElement as unknown as { clientHeight?: number })
      .clientHeight;
    window.dispatchEvent(new Event("resize"));
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

  it("enables flex wrapping in landscape layout to prevent overflow on compact screens", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 568,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 320,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));

    render(
      <WinOverlay
        visible={true}
        message="Great job!"
        onNext={vi.fn()}
        onHome={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    const content = alert.firstElementChild as HTMLElement;
    expect(window.getComputedStyle(content).flexWrap).toBe("wrap");
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

  it("renders next-game button when window.location.hash matches a mapped path key", () => {
    window.location.hash = "#/letters";
    render(
      <WinOverlay
        visible={true}
        message="Great job!"
        onNext={vi.fn()}
        onHome={vi.fn()}
      />,
    );

    const nextGameBtn = screen.getByTestId("next-game");
    expect(nextGameBtn).toBeTruthy();
    expect(nextGameBtn.textContent).toContain("▶️ Word Builder");

    // Clicking before arming does not navigate
    fireEvent.click(nextGameBtn);
    expect(window.location.hash).toBe("#/letters");

    // Advance past 600ms arming window
    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(nextGameBtn);
    expect(window.location.hash).toBe("#/spell");
  });

  it("navigates and switches screen in host when next-game button is tapped", () => {
    window.location.hash = "#/letters";
    render(<RouteHost />);

    expect(screen.getByTestId("active-screen").textContent).toBe("letters");
    const nextGameBtn = screen.getByTestId("next-game");
    expect(nextGameBtn).toBeTruthy();
    expect(nextGameBtn.textContent).toContain("▶️ Word Builder");

    // Advance past 600ms arming window
    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(nextGameBtn);

    // Host useRoute updates and renders the next game screen
    expect(screen.getByTestId("active-screen").textContent).toBe("spell");
    expect(screen.getByTestId("spell-screen")).toBeTruthy();
    expect(screen.queryByTestId("next-game")).toBeNull();
    expect(window.location.hash).toBe("#/spell");
  });

  it("suppresses next-game button when target game is hidden in parental lockdown storage", () => {
    const { result } = renderHook(() => useLockdown());
    act(() => {
      result.current.setHiddenGames(["spell"]);
    });

    window.location.hash = "#/letters";
    render(
      <WinOverlay
        visible={true}
        message="Great job!"
        onNext={vi.fn()}
        onHome={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("next-game")).toBeNull();

    act(() => {
      result.current.setHiddenGames([]);
    });
  });

  it("does not render next-game button when route has no curriculum progression", () => {
    window.location.hash = "#/sums";
    render(
      <WinOverlay
        visible={true}
        message="Great job!"
        onNext={vi.fn()}
        onHome={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("next-game")).toBeNull();
  });

  it("localizes next-game button title based on lang prop", () => {
    window.location.hash = "#/letters";
    render(
      <WinOverlay
        visible={true}
        message="よくできました！"
        onNext={vi.fn()}
        onHome={vi.fn()}
        lang="ja"
      />,
    );

    const nextGameBtn = screen.getByTestId("next-game");
    expect(nextGameBtn).toBeTruthy();
    expect(nextGameBtn.textContent).toContain("▶️ ことばづくり");
  });

  it("keeps buttons disarmed on the first frame when transitioning back to visible", () => {
    const onNext = vi.fn();
    let initialAriaDisabled: string | null = null;

    function LayoutProbe() {
      React.useLayoutEffect(() => {
        const btn = screen.queryByTestId("play-again");
        if (btn && initialAriaDisabled === null) {
          initialAriaDisabled = btn.getAttribute("aria-disabled");
        }
      });
      return null;
    }

    const { rerender } = render(
      <WinOverlay
        visible={true}
        message="Round 1"
        onNext={onNext}
        onHome={vi.fn()}
      />,
    );

    // Round 1 arms after 600ms
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Tap play again for round 1
    fireEvent.click(screen.getByTestId("play-again"));
    expect(onNext).toHaveBeenCalledTimes(1);

    // Round 2 starts: overlay hidden
    rerender(
      <WinOverlay
        visible={false}
        message="Round 1"
        onNext={onNext}
        onHome={vi.fn()}
      />,
    );

    // Round 2 won: overlay becomes visible again
    rerender(
      <WinOverlay
        visible={true}
        message="Round 2"
        stats={<LayoutProbe />}
        onNext={onNext}
        onHome={vi.fn()}
      />,
    );

    // On the initial frame (before useEffect runs), the button must already be disabled
    expect(initialAriaDisabled).toBe("true");

    // After 600ms arming window passes on round 2, button is enabled
    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(screen.getByTestId("play-again"));
    expect(onNext).toHaveBeenCalledTimes(2);
  });
});
