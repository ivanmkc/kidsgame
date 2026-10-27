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
import { afterEach, describe, expect, it, vi } from "vitest";
import { manifest } from "../../../manifest";
import { sfx } from "../../../sound";
import { t } from "../../../i18n";
import { Animated } from "react-native";
import { DiffGame } from "../DiffGame";
import { DiffHintButton } from "../DiffHintButton";

let lastDiffWrapProps: import("react-native").ViewProps | null = null;
let lastHintSlotProps: import("react-native").ViewProps | null = null;

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    View: (props: import("react-native").ViewProps) => {
      if (props.testID === "diff-wrap") {
        lastDiffWrapProps = props;
      }
      if (props.testID === "diff-hint-slot") {
        lastHintSlotProps = props;
      }
      return <actual.View {...props} />;
    },
  };
});

describe("DiffGame", () => {
  const noop = () => {};

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
    lastDiffWrapProps = null;
    lastHintSlotProps = null;
  });

  it("renders the scene picker when no scene is selected", () => {
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByTestId("scene-surprise")).toBeDefined();
  });

  it("plays sfx.good when a difference is found", () => {
    const sfxSpy = vi.spyOn(sfx, "good").mockReturnValue();
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    fireEvent.click(screen.getByTestId("left-target-0"));
    expect(sfxSpy).toHaveBeenCalledOnce();
  });

  it("renders hint button with localized accessibilityLabel following lang", () => {
    const htmlJa = renderToString(<DiffHintButton lang="ja" onPress={noop} />);
    expect(htmlJa).toContain('data-testid="diff-hint"');
    expect(htmlJa).toContain('role="button"');
    expect(htmlJa).toContain('aria-label="💡 ヒント"');
    expect(htmlJa).not.toContain('aria-label="Show a hint"');

    const htmlEn = renderToString(<DiffHintButton lang="en" onPress={noop} />);
    expect(htmlEn).toContain('data-testid="diff-hint"');
    expect(htmlEn).toContain('aria-label="💡 Hint"');
  });
  it("disables touch events on the invisible scene while loading", () => {
    lastDiffWrapProps = null;
    render(
      <DiffGame
        onHome={() => {}}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={() => {}}
        onBackToPicker={() => {}}
      />,
    );
    expect(lastDiffWrapProps).not.toBeNull();
    expect(lastDiffWrapProps!.pointerEvents).toBe("none");
  });

  it("renders TapScene targets with localized accessibilityLabel for both pictures", () => {
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const leftTargets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("left-target-"),
      );
    expect(leftTargets.length).toBeGreaterThan(0);
    for (const target of leftTargets) {
      expect(target.getAttribute("aria-label")).toBe(t("ja", "a11y.target"));
    }

    const rightTargets = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("right-target-"),
      );
    expect(rightTargets.length).toBeGreaterThan(0);
    for (const target of rightTargets) {
      expect(target.getAttribute("aria-label")).toBe(t("ja", "a11y.target"));
    }
  });

  it("reserves fixed-height hint slot in easy mode before hint appears", () => {
    lastHintSlotProps = null;
    render(
      <DiffGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const slot = screen.getByTestId("diff-hint-slot");
    expect(slot).toBeDefined();
    expect(lastHintSlotProps).not.toBeNull();
    expect(lastHintSlotProps!.style).toMatchObject({
      height: 44,
      marginTop: 10,
    });
    expect(screen.queryByTestId("diff-hint")).toBeNull();
  });

  it("shows hint button inside hint slot after 20 seconds of inactivity", () => {
    vi.useFakeTimers();
    render(
      <DiffGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    expect(screen.queryByTestId("diff-hint")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    const hintBtn = screen.getByTestId("diff-hint");
    expect(hintBtn).toBeDefined();
    expect(screen.getByTestId("diff-hint-slot").contains(hintBtn)).toBe(true);
  });

  it("unmounts hint button on tap while keeping hint slot mounted", () => {
    vi.useFakeTimers();
    render(
      <DiffGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    const hintBtn = screen.getByTestId("diff-hint");
    fireEvent.click(hintBtn);

    expect(screen.queryByTestId("diff-hint")).toBeNull();
    expect(screen.getByTestId("diff-hint-slot")).toBeDefined();
    expect(lastHintSlotProps).not.toBeNull();
    expect(lastHintSlotProps!.style).toMatchObject({
      height: 44,
      marginTop: 10,
    });
  });

  it("does not render hint slot or hint button in medium mode", () => {
    vi.useFakeTimers();
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        filter="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    expect(screen.queryByTestId("diff-hint-slot")).toBeNull();
    expect(screen.queryByTestId("diff-hint")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(25000);
    });

    expect(screen.queryByTestId("diff-hint-slot")).toBeNull();
    expect(screen.queryByTestId("diff-hint")).toBeNull();
  });

  it("cancels hintTimer when scene changes or component unmounts", () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { rerender, unmount } = render(
      <DiffGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    const hintBtn = screen.getByTestId("diff-hint");
    fireEvent.click(hintBtn);

    const hintTimerCall = setTimeoutSpy.mock.results.find(
      (_, idx) => setTimeoutSpy.mock.calls[idx][1] === 3200,
    );
    expect(hintTimerCall).toBeDefined();
    const hintTimerId = hintTimerCall!.value;

    clearTimeoutSpy.mockClear();

    rerender(
      <DiffGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId={manifest.diff[1].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    expect(clearTimeoutSpy).toHaveBeenCalledWith(hintTimerId);

    // Also verify unmount cleanup
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    const nextHintBtn = screen.getByTestId("diff-hint");
    fireEvent.click(nextHintBtn);

    const nextHintTimerCall = [...setTimeoutSpy.mock.results]
      .reverse()
      .find((_, revIdx) => {
        const idx = setTimeoutSpy.mock.results.length - 1 - revIdx;
        return setTimeoutSpy.mock.calls[idx][1] === 3200;
      });
    expect(nextHintTimerCall).toBeDefined();
    const nextHintTimerId = nextHintTimerCall!.value;

    clearTimeoutSpy.mockClear();
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(nextHintTimerId);
  });

  it("locks TapScene input and ignores backdrop taps when won", () => {
    const scene = manifest.diff[0];
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene.id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const sequenceSpy = vi.spyOn(Animated, "sequence");

    // Before winning, backdrop tap triggers shake sequence
    fireEvent.click(screen.getByTestId("left-backdrop"));
    expect(sequenceSpy).toHaveBeenCalledTimes(1);
    sequenceSpy.mockClear();

    // Find all differences to win
    const total = scene.diffs?.length ?? 4;
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByTestId(`left-target-${i}`));
    }

    expect(screen.getByTestId("win-overlay")).toBeDefined();

    // After winning, backdrop taps must not trigger shake
    fireEvent.click(screen.getByTestId("left-backdrop"));
    fireEvent.click(screen.getByTestId("right-backdrop"));
    expect(sequenceSpy).not.toHaveBeenCalled();
  });
});
