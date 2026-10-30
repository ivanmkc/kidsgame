// @vitest-environment happy-dom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import * as sound from "../../../sound";
import { t } from "../../../i18n";
import { SpotItGame } from "../SpotItGame";
import { SpotItDuel } from "../SpotItDuel";

function LangHarness({ initialLang = "en" }: { initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) =>
      l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
    );
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang={lang} />
    </LangContext.Provider>
  );
}

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
  window.dispatchEvent(new Event("resize"));
}

describe("SpotItGame language switch safety", () => {
  beforeEach(() => {
    setViewport(800, 600);
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound, "say").mockImplementation(() => {});
  });

  afterEach(() => {
    sound.stopNarration();
    cleanup();
    vi.useRealTimers();
  });

  it("safely switches language mid-round and updates UI instantly without corrupting the active round", () => {
    const saySpy = vi.spyOn(sound, "say");

    render(<LangHarness initialLang="en" />);
    fireEvent.pointerDown(document.body);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Initial English title
    expect(screen.getByText("Spot It!")).toBeDefined();
    expect(
      screen.getByText("Tap the picture that is on BOTH cards"),
    ).toBeDefined();
    expect(screen.getByTestId("spotit-score").textContent).toContain("0/10");

    // Extract symbols from top and bottom cards before language switch
    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );
    expect(topButtons.length).toBeGreaterThan(0);
    expect(bottomButtons.length).toBeGreaterThan(0);

    const topSymbols = topButtons.map((b) => b.getAttribute("data-testid"));
    const bottomSymbols = bottomButtons.map((b) =>
      b.getAttribute("data-testid"),
    );

    saySpy.mockClear();

    // Switch language via in-game header LangContext lang-cycle button
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Assert UI labels update instantly to Japanese
    expect(screen.getByText("いっしょさがし")).toBeDefined();
    expect(
      screen.getByText("りょうほうのカードに ある えを タップ"),
    ).toBeDefined();

    // Assert that no old-language speech or unexpected speech/timer fires after language switch (say is not called again for the sub prompt)
    expect(saySpy).not.toHaveBeenCalled();

    // Assert symbols are identical after language switch (round is not corrupted/shuffled)
    const newTopButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const newBottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );
    expect(newTopButtons.map((b) => b.getAttribute("data-testid"))).toEqual(
      topSymbols,
    );
    expect(newBottomButtons.map((b) => b.getAttribute("data-testid"))).toEqual(
      bottomSymbols,
    );

    // Find a matching symbol present on both top and bottom cards to play successfully
    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));
    expect(matchingId).toBeDefined();

    const matchingButton = screen.getByTestId(`top-symbol-${matchingId}`);

    const scoreTextBefore = screen.getByTestId("spotit-score").textContent;
    act(() => {
      fireEvent.click(matchingButton);
      vi.advanceTimersByTime(100);
    });

    expect(vi.mocked(sound.sfx.good)).toHaveBeenCalled();
    expect(screen.getByTestId("spotit-score").textContent).not.toBe(
      scoreTextBefore,
    );
  });

  it("ignores rapid double tap on the correct symbol without skipping a round", () => {
    const goodSpy = vi.spyOn(sound.sfx, "good");

    render(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} />);
    fireEvent.pointerDown(document.body);

    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );

    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));
    expect(matchingId).toBeDefined();

    const matchingButton = screen.getByTestId(`top-symbol-${matchingId}`);

    goodSpy.mockClear();

    act(() => {
      fireEvent.click(matchingButton);
      fireEvent.click(matchingButton);
    });

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("spotit-score").textContent).toContain("1/10");

    // The next round is now active and playable
    const nextTopButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const nextBottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );

    const nextTopSymbolIds = nextTopButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const nextBottomSymbolIds = nextBottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const nextMatchingId = nextTopSymbolIds.find((id) =>
      nextBottomSymbolIds.includes(id),
    );
    expect(nextMatchingId).toBeDefined();

    const nextMatchingButton = screen.getByTestId(
      `top-symbol-${nextMatchingId}`,
    );
    act(() => {
      fireEvent.click(nextMatchingButton);
    });

    expect(goodSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("spotit-score").textContent).toContain("2/10");
  });

  it("keeps TimerRing mounted across rounds in timed difficulty", () => {
    render(<SpotItGame onHome={() => {}} difficulty="medium" seed={42} />);
    fireEvent.pointerDown(document.body);

    const timerBefore = screen.getByTestId("spotit-timer");
    expect(timerBefore).toBeDefined();

    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );

    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));
    expect(matchingId).toBeDefined();

    const matchingButton = screen.getByTestId(`top-symbol-${matchingId}`);
    expect(timerBefore.contains(matchingButton)).toBe(true);

    act(() => {
      fireEvent.click(matchingButton);
    });

    const timerAfter = screen.getByTestId("spotit-timer");
    expect(timerAfter).toBe(timerBefore);
  });

  it("resets score and stays responsive when difficulty switches mid-game to one with fewer rounds", () => {
    const goodSpy = vi.spyOn(sound.sfx, "good");
    const saySpy = vi.spyOn(sound, "say");

    const { rerender } = render(
      <SpotItGame onHome={() => {}} difficulty="hard" seed={42} lang="en" />,
    );
    fireEvent.pointerDown(document.body);

    // Play 10 rounds on Hard (which has 14 rounds total)
    for (let roundNum = 0; roundNum < 10; roundNum++) {
      const topButtons = screen
        .getAllByRole("button")
        .filter((el) =>
          el.getAttribute("data-testid")?.startsWith("top-symbol-"),
        );
      const bottomButtons = screen
        .getAllByRole("button")
        .filter((el) =>
          el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
        );
      const topSymbolIds = topButtons.map((b) =>
        b.getAttribute("data-testid")!.replace("top-symbol-", ""),
      );
      const bottomSymbolIds = bottomButtons.map((b) =>
        b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
      );
      const matchingId = topSymbolIds.find((id) =>
        bottomSymbolIds.includes(id),
      );
      expect(matchingId).toBeDefined();

      const matchingButton = screen.getByTestId(`top-symbol-${matchingId}`);
      act(() => {
        fireEvent.click(matchingButton);
      });
    }

    expect(screen.getByTestId("spotit-score").textContent).toContain("10/14");

    saySpy.mockClear();
    goodSpy.mockClear();

    // Switch difficulty to Easy (where spotitRounds is 10)
    rerender(
      <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />,
    );

    // Score must be reset to 0/10 rather than soft-locking at 10/10
    expect(screen.getByTestId("spotit-score").textContent).toContain("⭐ 0/10");
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    expect(saySpy).not.toHaveBeenCalledWith(t("en", "win.spotit"));

    // Cards should remain fully interactive and accept taps
    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );
    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));
    expect(matchingId).toBeDefined();

    const matchingButton = screen.getByTestId(`top-symbol-${matchingId}`);
    act(() => {
      fireEvent.click(matchingButton);
    });

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("spotit-score").textContent).toContain("1/10");
  });

  it("reveals hint on matching symbols after inactivity delay in easy mode", () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} />);
    fireEvent.pointerDown(document.body);

    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );

    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id))!;
    const distractorId = topSymbolIds.find((id) => id !== matchingId)!;

    const matchingTopBtn = screen.getByTestId(`top-symbol-${matchingId}`);
    const matchingBottomBtn = screen.getByTestId(`bottom-symbol-${matchingId}`);
    const distractorBtn = screen.getByTestId(`top-symbol-${distractorId}`);

    // Initially no sparkles on matching buttons
    expect(matchingTopBtn.textContent).not.toContain("✨");
    expect(matchingBottomBtn.textContent).not.toContain("✨");

    // Advance 14 seconds (inactivity timer is 15s)
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(matchingTopBtn.textContent).not.toContain("✨");

    // Advance 1 more second (15s total)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Now matching symbols on both cards are hinted with sparkles
    expect(matchingTopBtn.textContent).toContain("✨");
    expect(matchingBottomBtn.textContent).toContain("✨");
    // Distractor is not hinted
    expect(distractorBtn.textContent).not.toContain("✨");

    // Tapping the hinted matching symbol completes the round and advances
    act(() => {
      fireEvent.click(matchingTopBtn);
    });

    expect(screen.getByTestId("spotit-score").textContent).toContain("1/10");

    // New round has started; hint is reset
    const nextTopButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    for (const btn of nextTopButtons) {
      expect(btn.textContent).not.toContain("✨");
    }
  });

  it("reveals hint immediately after two incorrect taps", () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} />);
    fireEvent.pointerDown(document.body);

    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );

    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id))!;
    const distractorId = topSymbolIds.find((id) => id !== matchingId)!;

    const matchingTopBtn = screen.getByTestId(`top-symbol-${matchingId}`);
    const distractorBtn = screen.getByTestId(`top-symbol-${distractorId}`);

    // First wrong tap
    act(() => {
      fireEvent.click(distractorBtn);
    });
    expect(matchingTopBtn.textContent).not.toContain("✨");

    // Advance 500ms to clear wrong flash timer
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(matchingTopBtn.textContent).not.toContain("✨");

    // Second wrong tap
    act(() => {
      fireEvent.click(distractorBtn);
    });

    // Hint should now be revealed immediately without waiting for 15s inactivity
    expect(matchingTopBtn.textContent).toContain("✨");
    expect(
      screen.getByTestId(`bottom-symbol-${matchingId}`).textContent,
    ).toContain("✨");
  });

  it("disables inactivity hint on hard difficulty but reveals hint on two wrong taps", () => {
    render(<SpotItGame onHome={() => {}} difficulty="hard" seed={42} />);
    fireEvent.pointerDown(document.body);

    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );

    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id))!;
    const distractorId = topSymbolIds.find((id) => id !== matchingId)!;

    const matchingTopBtn = screen.getByTestId(`top-symbol-${matchingId}`);
    const distractorBtn = screen.getByTestId(`top-symbol-${distractorId}`);

    // Advance 30s — hard mode has Infinity inactivity delay, so no hint should show
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(matchingTopBtn.textContent).not.toContain("✨");

    // Two wrong taps on hard mode should still guide the stuck player
    act(() => {
      fireEvent.click(distractorBtn);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      fireEvent.click(distractorBtn);
    });

    expect(matchingTopBtn.textContent).toContain("✨");
  });
});

describe('SpotIt audio cleanup on unmount', () => {
  beforeEach(() => {
    setViewport(800, 600);
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound, 'say').mockImplementation(() => {});
  });

  afterEach(() => {
    sound.stopNarration();
    cleanup();
    vi.useRealTimers();
  });

  it('calls stopNarration on unmount of SpotItDuel to prevent leaking audio', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const { unmount } = render(
      <SpotItDuel onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    unmount();

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });

  it('calls stopNarration on unmount of SpotItGame in solo mode', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const { unmount } = render(
      <SpotItGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    unmount();

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });

  it('stops narration when navigating away via home button from SpotItGame', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    function App() {
      const [screen, setScreen] = useState<'game' | 'menu'>('game');
      return screen === 'game' ? (
        <SpotItGame onHome={() => setScreen('menu')} difficulty="easy" lang="en" />
      ) : null;
    }
    render(<App />);
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByTestId('back-button'));
    });

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });

  it('stops narration when navigating away via home button from SpotItDuel', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    function App() {
      const [screen, setScreen] = useState<'game' | 'menu'>('game');
      return screen === 'game' ? (
        <SpotItDuel onHome={() => setScreen('menu')} difficulty="easy" lang="en" />
      ) : null;
    }
    render(<App />);
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByTestId('back-button'));
    });

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });
});
