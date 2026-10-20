// @vitest-environment happy-dom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { CompareGame } from "../CompareGame";
import * as logic from "../logic";

const noop = () => {};

describe("CompareGame fast-tap lock", () => {
  let goodSpy: ReturnType<typeof vi.spyOn>;
  let wrongSpy: ReturnType<typeof vi.spyOn>;
  let saySpy: ReturnType<typeof vi.spyOn>;
  let sayThenSpy: ReturnType<typeof vi.spyOn>;
  let sayThenCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    sayThenCallback = null;
    goodSpy = vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    wrongSpy = vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    sayThenSpy = vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      sayThenCallback = cb ?? null;
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("hammering the wrong side ignores duplicate taps and queues only one error sound and voice prompt", () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    saySpy.mockClear();

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    expect(wrongPlate).toBeDefined();

    act(() => {
      fireEvent.click(wrongPlate);
      fireEvent.click(wrongPlate);
      fireEvent.click(wrongPlate);
    });

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(wrongPlate);
    });
    expect(wrongSpy).toHaveBeenCalledTimes(2);
  });

  it("hammering the correct side ignores duplicate taps, increments score once, and advances round cleanly", () => {
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(screen.getByTestId("compare-score").textContent).toContain("0/6");

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    expect(correctPlate).toBeDefined();

    fireEvent.click(correctPlate);
    fireEvent.click(correctPlate);
    fireEvent.click(correctPlate);

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");

    expect(sayThenCallback).not.toBeNull();
    act(() => {
      sayThenCallback!();
    });

    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");

    const nextPlates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const nextCorrect = nextPlates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    fireEvent.click(nextCorrect);
    expect(goodSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("compare-score").textContent).toContain("2/6");
  });

  it("ignores taps on correct side while wrong-side feedback is active", () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;

    act(() => {
      fireEvent.click(wrongPlate);
    });
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(correctPlate);
    });
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("compare-score").textContent).toContain("0/6");

    act(() => {
      vi.advanceTimersByTime(450);
    });

    act(() => {
      fireEvent.click(correctPlate);
    });
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");
  });

  it("ignores wrong tap while correct side celebration is playing", () => {
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;

    fireEvent.click(correctPlate);
    expect(goodSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(wrongPlate);
    expect(wrongSpy).not.toHaveBeenCalled();
  });

  it("reset on play again resets score and unlocks input", () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let r = 0; r < 6; r++) {
      const plates = [
        screen.getByTestId(/^compare-plate-left/),
        screen.getByTestId(/^compare-plate-right/),
      ];
      const correctPlate = plates.find((p) =>
        p.getAttribute("data-testid")?.endsWith("-correct"),
      )!;
      act(() => {
        fireEvent.click(correctPlate);
      });
      if (r < 5) {
        expect(sayThenCallback).not.toBeNull();
        act(() => {
          sayThenCallback!();
        });
      }
    }

    expect(screen.getByTestId("compare-score").textContent).toContain("6/6");

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const playAgainBtn = screen.getByTestId("play-again");
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    expect(screen.getByTestId("compare-score").textContent).toContain("0/6");

    const newPlates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const newCorrect = newPlates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    act(() => {
      fireEvent.click(newCorrect);
    });
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");
  });
});

describe("CompareGame prompt replay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb && cb());
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "wrong").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders prompt as an interactive button and replays spoken prompt on tap", () => {
    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");

    render(<CompareGame onHome={noop} difficulty="easy" lang="en" />);

    // Initial mount speaks prompt once
    expect(saySpy).toHaveBeenCalledWith("Tap the side with MORE!");
    saySpy.mockClear();

    // The prompt card should have button role and prompt label
    const promptBtn = screen.getByRole("button", {
      name: "Tap the side with MORE!",
    });
    expect(promptBtn).toBeDefined();
    expect(screen.getByText("Tap the side with MORE!")).toBeDefined();
    expect(screen.getByText("🔊 Tap to hear again")).toBeDefined();

    // Clicking the prompt card replays the instruction and plays tap sfx
    fireEvent.click(promptBtn);
    expect(tapSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Tap the side with MORE!");
  });

  it("replays FEWER prompt when round asks for fewer on hard mode", () => {
    vi.spyOn(logic, "makeCompareRound").mockReturnValue({
      left: { icon: "star", count: 3, positions: [] },
      right: { icon: "heart", count: 6, positions: [] },
      ask: "fewer",
      correctSide: "left",
    });

    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");

    render(<CompareGame onHome={noop} difficulty="hard" lang="en" />);

    expect(saySpy).toHaveBeenCalledWith("Tap the side with FEWER!");
    saySpy.mockClear();

    const promptBtn = screen.getByTestId("compare-prompt-fewer");
    expect(promptBtn).toBeDefined();
    expect(screen.getByText("Tap the side with FEWER!")).toBeDefined();

    fireEvent.click(promptBtn);
    expect(tapSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Tap the side with FEWER!");
  });

  it("disables prompt button and does not replay audio when game is won", () => {
    let queuedCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      queuedCb = cb;
    });

    // Make rounds: 1 round needed to win on easy for this test
    vi.spyOn(logic, "compareSettings").mockReturnValue({
      rounds: 1,
      range: [1, 7],
      minGap: 3,
      minRatio: 1.25,
      fewerFraction: 0,
    });

    vi.spyOn(logic, "makeCompareRound").mockReturnValue({
      left: { icon: "star", count: 6, positions: [] },
      right: { icon: "heart", count: 2, positions: [] },
      ask: "more",
      correctSide: "left",
    });

    render(<CompareGame onHome={noop} difficulty="easy" lang="en" />);

    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");
    saySpy.mockClear();

    // Tap correct plate to win
    const leftPlate = screen.getByTestId("compare-plate-left-star-6-correct");
    fireEvent.click(leftPlate);

    // Complete celebration callback
    act(() => {
      queuedCb?.();
    });

    // Win overlay is visible
    expect(screen.getByTestId("win-overlay")).toBeDefined();

    tapSpy.mockClear();
    saySpy.mockClear();

    // Prompt button should be disabled when won
    const promptBtn = screen.getByTestId("compare-prompt-more");
    fireEvent.click(promptBtn);

    expect(tapSpy).not.toHaveBeenCalled();
    expect(saySpy).not.toHaveBeenCalled();
  });

  it("does not replay audio while locked during round transition", () => {
    let queuedCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      queuedCb = cb;
    });

    vi.spyOn(logic, "compareSettings").mockReturnValue({
      rounds: 5,
      range: [1, 7],
      minGap: 3,
      minRatio: 1.25,
      fewerFraction: 0,
    });

    vi.spyOn(logic, "makeCompareRound").mockReturnValue({
      left: { icon: "star", count: 6, positions: [] },
      right: { icon: "heart", count: 2, positions: [] },
      ask: "more",
      correctSide: "left",
    });

    render(<CompareGame onHome={noop} difficulty="easy" lang="en" />);

    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");
    saySpy.mockClear();

    // Tap correct plate to start celebration/transition
    const leftPlate = screen.getByTestId("compare-plate-left-star-6-correct");
    fireEvent.click(leftPlate);

    // Prompt button is clicked while locked (queuedCb hasn't resolved yet)
    const promptBtn = screen.getByTestId("compare-prompt-more");
    fireEvent.click(promptBtn);

    expect(tapSpy).not.toHaveBeenCalled();
    expect(saySpy).not.toHaveBeenCalled();

    // Finish transition
    act(() => {
      queuedCb?.();
    });
  });
});

describe("CompareGame wrong answer timer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "wrong").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  function getPlates() {
    const correctPlate = screen.getByTestId(/-correct$/);
    const wrongPlate = screen
      .getAllByTestId(/^compare-plate-/)
      .find((el) => !el.getAttribute("data-testid")?.endsWith("-correct"))!;
    return { correctPlate, wrongPlate };
  }

  it("cancels the wrong-answer repeat prompt timer when the player taps the correct plate", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Initial mount speaks the round prompt once.
    expect(saySpy).toHaveBeenCalledTimes(1);

    const { correctPlate, wrongPlate } = getPlates();

    // Tap wrong plate: schedules a 500ms repeat prompt.
    act(() => {
      fireEvent.click(wrongPlate);
    });
    expect(sfx.wrong).toHaveBeenCalledTimes(1);

    // After 450ms wrong feedback lock releases, player taps the correct plate at 460ms.
    act(() => {
      vi.advanceTimersByTime(460);
    });
    act(() => {
      fireEvent.click(correctPlate);
    });
    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(sound.sayThen).toHaveBeenCalledTimes(1);

    // Advance past the 500ms mark from the initial wrong tap.
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // The repeat prompt timer was cleared, so `say` was NOT called again.
    expect(saySpy).toHaveBeenCalledTimes(1);
  });

  it("does not speak repeat prompt over victory celebration when wrong plate is tapped before winning plate", () => {
    const spokenLines: string[] = [];
    vi.spyOn(sound, "say").mockImplementation((line) => {
      spokenLines.push(line);
    });
    let capturedDone: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, done) => {
      capturedDone = done;
    });

    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Complete 5 rounds cleanly
    for (let i = 0; i < 5; i++) {
      const { correctPlate } = getPlates();
      act(() => {
        fireEvent.click(correctPlate);
      });
      act(() => {
        capturedDone?.();
      });
    }

    spokenLines.length = 0;

    // On final round (round 6): tap wrong plate
    const { correctPlate: finalCorrect, wrongPlate: finalWrong } = getPlates();
    act(() => {
      fireEvent.click(finalWrong);
    });

    // After 450ms wrong feedback lock releases, tap correct plate at 460ms
    act(() => {
      vi.advanceTimersByTime(460);
    });
    act(() => {
      fireEvent.click(finalCorrect);
    });

    // Win line is spoken
    expect(spokenLines).toContain("Sharp eyes! You compared like a champ!");

    // Advance past 500ms from the wrong tap
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // The repeat prompt must NOT be spoken after the win line
    expect(spokenLines).toEqual(["Sharp eyes! You compared like a champ!"]);
  });

  it("cancels the wrong-answer repeat prompt timer on unmount", () => {
    const saySpy = vi.spyOn(sound, "say");
    const { unmount } = render(
      <CompareGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(saySpy).toHaveBeenCalledTimes(1);

    const { wrongPlate } = getPlates();
    act(() => {
      fireEvent.click(wrongPlate);
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    unmount();

    // Advance past the 500ms mark.
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // The repeat prompt should not speak after navigating away / unmounting.
    expect(saySpy).toHaveBeenCalledTimes(1);
  });

  it("speaks repeat prompt after 500ms if no correct plate was tapped", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(saySpy).toHaveBeenCalledTimes(1);

    const { wrongPlate } = getPlates();
    act(() => {
      fireEvent.click(wrongPlate);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Repeat prompt fires at 500ms.
    expect(saySpy).toHaveBeenCalledTimes(2);
  });

  it("resets the timer when tapping wrong plate again after lock releases", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(saySpy).toHaveBeenCalledTimes(1);

    const { wrongPlate } = getPlates();
    act(() => {
      fireEvent.click(wrongPlate);
    });

    // At 460ms (after the 450ms wrong feedback lock releases, but before 500ms prompt timer):
    act(() => {
      vi.advanceTimersByTime(460);
    });
    act(() => {
      fireEvent.click(wrongPlate);
    });

    // At 500ms from first tap (40ms from second tap), first timer was cancelled and should not fire.
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(saySpy).toHaveBeenCalledTimes(1);

    // At 500ms from the second tap (460ms more), the second timer fires.
    act(() => {
      vi.advanceTimersByTime(460);
    });
    expect(saySpy).toHaveBeenCalledTimes(2);
  });

  it("cancels the wrong-answer repeat prompt timer on reset", () => {
    const saySpy = vi.spyOn(sound, "say");
    let capturedDone: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, done) => {
      capturedDone = done;
    });

    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Complete 6 rounds to win
    for (let i = 0; i < 6; i++) {
      const { correctPlate } = getPlates();
      act(() => {
        fireEvent.click(correctPlate);
      });
      act(() => {
        capturedDone?.();
      });
    }

    // Win overlay animations need to finish so buttons become armed
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // WinOverlay is now visible. Tap "Play Again".
    const playAgainBtn = screen.getByTestId("play-again");
    saySpy.mockClear();

    act(() => {
      fireEvent.click(playAgainBtn);
    });
    // After reset, a new round's prompt is spoken on mount/round change.
    expect(saySpy).toHaveBeenCalledTimes(1);

    // Advance past 500ms, ensure no leaked timer from previous round.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(saySpy).toHaveBeenCalledTimes(1);
  });
});
