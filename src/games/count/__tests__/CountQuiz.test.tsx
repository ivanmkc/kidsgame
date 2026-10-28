// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as sound from "../../../sound";
import { t } from "../../../i18n";
import { CountGame } from "../CountGame";
import { PROMPTS } from "../logic";

describe("CountGame quiz phase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears previous timeouts on double tap of wrong answer so audio does not stutter", () => {
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      if (cb) cb();
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const wrongChoice = choices.find(
      (c) => !c.getAttribute("data-testid")?.includes("-answer"),
    );
    expect(wrongChoice).toBeDefined();

    saySpy.mockClear();

    fireEvent.click(wrongChoice!);
    fireEvent.click(wrongChoice!);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).toHaveBeenCalledTimes(1);
  });

  it("clears pending wrong-answer timeout when correct answer is tapped immediately", () => {
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();
    const sayThenSpy = vi
      .spyOn(sound, "sayThen")
      .mockImplementation((_, cb) => {
        if (cb) cb();
      });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const wrongChoice = choices.find(
      (c) => !c.getAttribute("data-testid")?.includes("-answer"),
    );
    const correctChoice = choices.find((c) =>
      c.getAttribute("data-testid")?.includes("-answer"),
    );
    expect(wrongChoice).toBeDefined();
    expect(correctChoice).toBeDefined();

    saySpy.mockClear();
    sayThenSpy.mockImplementation(() => {
      // Keep celebration active without running completion callback
    });

    fireEvent.click(wrongChoice!);
    fireEvent.click(correctChoice!);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).not.toHaveBeenCalled();
  });

  it("clears pending wrong-answer timeouts on unmount", () => {
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      if (cb) cb();
    });

    const { unmount } = render(
      <CountGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const wrongChoice = choices.find(
      (c) => !c.getAttribute("data-testid")?.includes("-answer"),
    );
    expect(wrongChoice).toBeDefined();

    saySpy.mockClear();

    fireEvent.click(wrongChoice!);
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).not.toHaveBeenCalled();
  });

  it("provides a tappable prompt card to replay audio and displays hear again hint", () => {
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      if (cb) cb();
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    expect(saySpy).toHaveBeenCalledWith(PROMPTS.en);
    saySpy.mockClear();

    const promptBtn = screen.getByTestId("count-prompt");
    expect(promptBtn.getAttribute("role")).toBe("button");
    expect(promptBtn.getAttribute("aria-label")).toBe(
      t("en", "shell.count.sub"),
    );
    expect(
      within(promptBtn).getByText(t("en", "shell.count.sub")),
    ).toBeDefined();
    expect(screen.getByText(t("en", "spell.hearAgain"))).toBeDefined();

    fireEvent.click(promptBtn);
    expect(saySpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledWith(PROMPTS.en);
  });

  it("does not replay prompt audio when locked during transition", () => {
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();
    let queuedCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((lines, cb) => {
      if (!queuedCb && lines.length === 1) {
        cb?.();
      } else {
        queuedCb = cb;
      }
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    saySpy.mockClear();
    const promptBtn = screen.getByTestId("count-prompt");

    const choices = screen.queryAllByTestId(/count-choice-/);
    const correctChoice = choices.find((c) =>
      c.getAttribute("data-testid")?.includes("-answer"),
    );
    expect(correctChoice).toBeDefined();
    fireEvent.click(correctChoice!);

    fireEvent.click(promptBtn);
    expect(saySpy).not.toHaveBeenCalled();

    act(() => {
      queuedCb?.();
    });
  });

  it("displays Japanese prompt and hearAgain hint, and replays Japanese prompt when tapped", () => {
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      if (cb) cb();
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="ja" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    expect(saySpy).toHaveBeenCalledWith(PROMPTS.ja);
    saySpy.mockClear();

    const promptBtn = screen.getByTestId("count-prompt");
    expect(promptBtn.getAttribute("role")).toBe("button");
    expect(promptBtn.getAttribute("aria-label")).toBe(
      t("ja", "shell.count.sub"),
    );
    expect(
      within(promptBtn).getByText(t("ja", "shell.count.sub")),
    ).toBeDefined();
    expect(screen.getByText(t("ja", "spell.hearAgain"))).toBeDefined();

    fireEvent.click(promptBtn);
    expect(saySpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledWith(PROMPTS.ja);
  });

  it("stops narration via useLangEpoch when language switches mid-game", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const { rerender } = render(
      <CountGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(stopNarrationSpy).not.toHaveBeenCalled();

    rerender(<CountGame onHome={() => {}} difficulty="easy" lang="ja" />);

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });

  it("unlocks input and clears pending timeouts when language switches", () => {
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();
    vi.spyOn(sound, "sayThen").mockImplementation((lines, cb) => {
      if (lines.length === 1) {
        cb?.();
      }
    });

    const { rerender } = render(
      <CountGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const correctChoice = choices.find((c) =>
      c.getAttribute("data-testid")?.includes("-answer"),
    );
    expect(correctChoice).toBeDefined();

    const wrongChoice = choices.find(
      (c) => !c.getAttribute("data-testid")?.includes("-answer"),
    );
    expect(wrongChoice).toBeDefined();

    const wrongSfx = vi.spyOn(sound.sfx, "wrong");

    // Tap correct answer while sayThen is pending: game becomes locked
    fireEvent.click(correctChoice!);

    const promptBtn = screen.getByTestId("count-prompt");
    saySpy.mockClear();
    fireEvent.click(promptBtn);
    expect(saySpy).not.toHaveBeenCalled();

    // Subsequent choice tap is also ignored while locked
    fireEvent.click(wrongChoice!);
    expect(wrongSfx).not.toHaveBeenCalled();

    // Switch language mid-lock
    rerender(<CountGame onHome={() => {}} difficulty="easy" lang="ja" />);

    // Prompt replay and inputs are unlocked
    saySpy.mockClear();
    fireEvent.click(promptBtn);
    expect(saySpy).toHaveBeenCalledWith(PROMPTS.ja);

    // Choices are also interactive again
    fireEvent.click(wrongChoice!);
    expect(wrongSfx).toHaveBeenCalledTimes(1);
  });
});

