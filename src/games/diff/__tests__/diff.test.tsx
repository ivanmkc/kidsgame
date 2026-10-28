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
    useWindowDimensions: () => ({ width: window.innerWidth || 800, height: window.innerHeight || 1000 }),
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

  it("renders localized scene names in Japanese, Mandarin, and Cantonese", () => {
    // Scene picker card in Japanese
    const { unmount: unmountPickerJa } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(screen.getByText("ぼくじょう")).toBeDefined();
    unmountPickerJa();

    // In-game subtitle in Japanese
    const { unmount: unmountSubJa } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId="farm"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(screen.getByText(/ぼくじょう/)).toBeDefined();
    unmountSubJa();

    // In-game subtitle in Mandarin
    const { unmount: unmountSubCmn } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId="farm"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    expect(screen.getByText(/农场/)).toBeDefined();
    unmountSubCmn();

    // In-game subtitle in Cantonese
    const { unmount: unmountSubYue } = render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId="farm"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    expect(screen.getByText(/農場/)).toBeDefined();
    unmountSubYue();
  });

  it("provides valid nameT translations in ja, cmn, and yue for all diff scenes", () => {
    expect(manifest.diff.length).toBe(21);
    for (const scene of manifest.diff) {
      expect(scene.nameT).toBeDefined();
      expect(scene.nameT?.ja).toBeTruthy();
      expect(scene.nameT?.cmn).toBeTruthy();
      expect(scene.nameT?.yue).toBeTruthy();
    }
  });

  it("picks a random scene when surprise button is clicked", () => {
    const onPickScene = vi.fn();
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("scene-surprise"));
    expect(onPickScene).toHaveBeenCalled();
  });

  it("calls onFilter when filter chip is clicked", () => {
    const onFilter = vi.fn();
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        onFilter={onFilter}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("difficulty-cycle"));
    expect(onFilter).toHaveBeenCalled();
  });

  it("renders in landscape mode correctly", () => {
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 500, configurable: true });
    
    try {
      render(
        <DiffGame
          onHome={noop}
          difficulty="medium"
          sceneId={manifest.diff[0].id}
          onPickScene={noop}
          onBackToPicker={noop}
        />,
      );
      expect(lastDiffWrapProps?.style).toBeDefined();
    } finally {
      Object.defineProperty(window, "innerWidth", { value: origW, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: origH, configurable: true });
    }
  });

  it("bypasses image loading check on non-DOM platforms", () => {
    vi.useFakeTimers();
    const originalQuerySelectorAll = Element.prototype.querySelectorAll;
    Object.defineProperty(Element.prototype, "querySelectorAll", { value: undefined, configurable: true });
    
    try {
      render(
        <DiffGame
          onHome={noop}
          difficulty="medium"
          sceneId={manifest.diff[0].id}
          onPickScene={noop}
          onBackToPicker={noop}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });
    } finally {
      Object.defineProperty(Element.prototype, "querySelectorAll", { value: originalQuerySelectorAll, configurable: true });
    }
    expect(screen.queryByTestId("diff-loading")).toBeNull();
  });

  it("becomes ready when all images are loaded", () => {
    vi.useFakeTimers();
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    expect(screen.getByTestId("diff-loading")).toBeDefined();

    const imgs = document.querySelectorAll("img");
    imgs.forEach(img => {
      Object.defineProperty(img, "complete", { value: true, configurable: true });
      Object.defineProperty(img, "naturalWidth", { value: 100, configurable: true });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.queryByTestId("diff-loading")).toBeNull();
  });

  it("advances to next scene when next button is clicked on win overlay", () => {
    vi.useFakeTimers();
    const onPickScene = vi.fn();
    const scene = manifest.diff[0];
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={scene.id}
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );

    const total = scene.pool ? 4 : (scene.diffs?.length ?? 4);
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByTestId(`left-target-${i}`));
    }
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    const nextBtn = screen.getByTestId("play-again");
    fireEvent.click(nextBtn);
    expect(onPickScene).toHaveBeenCalled();
  });

  it("renders a legacy scene without pool", () => {
    const legacyScene: typeof manifest.diff[0] = {
      id: "legacy",
      name: "Legacy",
      w: 800,
      h: 600,
      diffs: [{ x: 0, y: 0, w: 10, h: 10, what: "test" }]
    };
    manifest.diff.push(legacyScene);
    try {
      render(
        <DiffGame
          onHome={noop}
          difficulty="medium"
          sceneId="legacy"
          onPickScene={noop}
          onBackToPicker={noop}
        />,
      );
      expect(screen.getByTestId("left-target-0")).toBeDefined();
    } finally {
      manifest.diff.pop();
    }
  });
});
describe("DiffGame scene picker surprise fallback", () => {
  const noop = () => {};
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("falls back to manifest.diff when filter matches no scenes", () => {
    const onPickScene = vi.fn();
    const originalDiff = manifest.diff;
    manifest.diff = [{ ...originalDiff[0], level: "easy" }];
    try {
      render(
        <DiffGame
          onHome={noop}
          difficulty="medium"
          filter="hard"
          onPickScene={onPickScene}
          onBackToPicker={noop}
        />,
      );
      fireEvent.click(screen.getByTestId("scene-surprise"));
      expect(onPickScene).toHaveBeenCalledTimes(1);
    } finally {
      manifest.diff = originalDiff;
    }
  });
});
