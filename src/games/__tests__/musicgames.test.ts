import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as music from "../../music";
import { makeRng } from "../../rng";
import { BellsGame } from "../bells/BellsGame";
import { EchoBeatGame } from "../echobeat/EchoBeatGame";
import {
  makeHighLowRound,
  roundsToWin as hlRounds,
  correctAnswer as hlAnswer,
  isCorrect as hlCorrect,
} from "../highlow/logic";
import * as bellsLogic from "../bells/logic";
const {
  makeBellsRound,
  judgeTap,
  roundsToWin: bellRounds,
  seqLength,
  canTap,
} = bellsLogic;
import {
  makeEchoBeatRound,
  checkEcho,
  roundsToWin as echoRounds,
  tolerancePct,
  speechLines as echoSpeechLines,
} from "../echobeat/logic";
import {
  makeSteadyBeatRound,
  scoreTaps,
  roundsToWin as steadyRounds,
  passThreshold,
  windowMs,
  speechLines as steadySpeechLines,
} from "../steadybeat/logic";
import {
  makeSameDiffRound,
  isCorrect,
  roundsToWin as sdRounds,
} from "../samediff/logic";

let capturedReset: (() => void) | null = null;
vi.mock("../../components/WinOverlay", () => ({
  WinOverlay: (props: { onNext?: () => void }) => {
    capturedReset = props.onNext ?? null;
    return null;
  },
}));

describe("high or low", () => {
  it("generates rounds with distinct notes", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const rng = makeRng(seed);
        const r = makeHighLowRound(rng, d);
        expect(r.noteA).not.toBe(r.noteB);
        expect(Math.abs(r.noteB - r.noteA)).toBeGreaterThan(0);
        expect(["high", "low"]).toContain(hlAnswer(r));
      }
    }
  });

  it("the answer is what the ears heard, never a coin flip", () => {
    // The kid hears note A then note B and taps HIGH or LOW for where the
    // second one landed — so the answer has to follow the notes. When it
    // was drawn independently the round was pure 50/50 luck.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const r = makeHighLowRound(makeRng(seed), d);
        const wentUp = r.noteB > r.noteA;
        const ans = hlAnswer(r);
        expect(ans).toBe(wentUp ? "high" : "low");
        expect(hlCorrect(r, ans)).toBe(true);
        expect(hlCorrect(r, ans === "high" ? "low" : "high")).toBe(false);
        seen.add(ans);
      }
    }
    expect(seen).toEqual(new Set(["high", "low"]));
  });

  it("roundsToWin increases with difficulty", () => {
    expect(hlRounds("easy")).toBeLessThan(hlRounds("medium"));
    expect(hlRounds("medium")).toBeLessThan(hlRounds("hard"));
  });
});

describe("melody bells", () => {
  it("generates valid sequences within bell count", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const rng = makeRng(seed);
        const r = makeBellsRound(rng, d);
        expect(r.sequence).toHaveLength(seqLength(d));
        for (const idx of r.sequence) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(r.bells.length);
        }
        expect(r.bells.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("judgeTap validates prefix and completion correctly", () => {
    const rng = makeRng(42);
    const r = makeBellsRound(rng, "easy");
    const [first, second] = r.sequence;
    const wrongFirst = (first + 1) % r.bells.length;
    expect(judgeTap(r, [], wrongFirst)).toBe("wrong");
    expect(judgeTap(r, [], first)).toBe("continue");
    expect(judgeTap(r, [first], second)).toBe("complete");
    expect(judgeTap(r, [first], wrongFirst)).toBe("wrong");
  });

  it("roundsToWin increases with difficulty", () => {
    expect(bellRounds("easy")).toBeLessThan(bellRounds("medium"));
    expect(bellRounds("medium")).toBeLessThan(bellRounds("hard"));
  });

  it("canTap allows taps during active play while sequence is incomplete", () => {
    const rng = makeRng(42);
    const r = makeBellsRound(rng, "medium");
    expect(r.sequence).toHaveLength(3);

    expect(canTap(r, [], "play")).toBe(true);
    expect(canTap(r, [0], "play")).toBe(true);
    expect(canTap(r, [0, 1], "play")).toBe(true);
  });

  it("canTap blocks taps once sequence length is reached or when not in active play", () => {
    const rng = makeRng(42);
    const r = makeBellsRound(rng, "medium");
    expect(r.sequence).toHaveLength(3);

    expect(canTap(r, [0, 1, 2], "play")).toBe(false);
    expect(canTap(r, [0, 1, 2, 0], "play")).toBe(false);
    expect(canTap(r, [0, 1, 2, 0, 0], "play")).toBe(false);

    expect(canTap(r, [], "listen")).toBe(false);
    expect(canTap(r, [0], "listen")).toBe(false);

    expect(canTap(r, [], "play", true)).toBe(false);
    expect(canTap(r, [0], "play", true)).toBe(false);
  });

  it("renders BellsGame and displays localized strings", () => {
    const noop = () => {};
    const html = renderToString(
      React.createElement(BellsGame, {
        onHome: noop,
        difficulty: "easy",
        lang: "en",
      }),
    );
    expect(html).toContain("Melody Bells");
    expect(html).toContain("Listen, then play the tune back!");
    expect(html).toContain("Listen...");
  });

  it("hides status card when won", () => {
    const roundsSpy = vi.spyOn(bellsLogic, "roundsToWin").mockReturnValue(0);
    const html = renderToString(
      React.createElement(BellsGame, {
        onHome: () => {},
        difficulty: "easy",
        lang: "en",
      }),
    );
    expect(html).not.toContain("Listen...");
    expect(html).not.toContain("Your turn");
    roundsSpy.mockRestore();
  });

  it("unmounts during listen phase and cancels demo timers", () => {
    vi.useFakeTimers();
    let notesPlayed = 0;
    let mockCancel: (() => void) | null = null;
    const playSequenceSpy = vi
      .spyOn(music, "playSequence")
      .mockImplementation((notes, bpm, onNote, onDone) => {
        let time = 0;
        const timers: ReturnType<typeof setTimeout>[] = [];
        for (let i = 0; i < notes.length; i++) {
          timers.push(
            setTimeout(() => {
              notesPlayed++;
              onNote?.(i);
            }, time),
          );
          time += ((notes[i].b * 60) / bpm) * 1000;
        }
        timers.push(setTimeout(() => onDone?.(), time));
        mockCancel = () => {
          timers.forEach(clearTimeout);
        };
        return mockCancel;
      });
    const stopSequenceSpy = vi
      .spyOn(music, "stopSequence")
      .mockImplementation(() => {
        if (mockCancel) {
          mockCancel();
          mockCancel = null;
        }
      });

    type FakeNode = {
      nodeName: string;
      tagName: string;
      nodeType: number;
      setAttribute: () => void;
      removeAttribute: () => void;
      style: Record<string, string>;
      appendChild: () => void;
      removeChild: () => void;
      insertBefore: () => void;
      addEventListener: () => void;
      removeEventListener: () => void;
    };

    const makeNode = (): FakeNode => ({
      nodeName: "DIV",
      tagName: "div",
      nodeType: 1,
      setAttribute: () => {},
      removeAttribute: () => {},
      style: {},
      appendChild: () => {},
      removeChild: () => {},
      insertBefore: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    class FakeIFrame {}

    const doc = {
      nodeName: "#document",
      tagName: "#document",
      nodeType: 9,
      createElement: makeNode,
      createElementNS: makeNode,
      createTextNode: () => ({ nodeType: 3, nodeName: "#text" }),
      addEventListener: () => {},
      removeEventListener: () => {},
      defaultView: {
        HTMLIFrameElement: FakeIFrame,
      },
      body: makeNode(),
      activeElement: null,
    };

    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      HTMLIFrameElement?: unknown;
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const origWindow = g.window;
    const origDocument = g.document;
    const origHTMLIFrameElement = g.HTMLIFrameElement;
    const origAct = g.IS_REACT_ACT_ENVIRONMENT;

    g.window = doc.defaultView;
    g.HTMLIFrameElement = FakeIFrame;
    g.document = doc;
    g.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      const container = {
        ...makeNode(),
        ownerDocument: doc,
      };

      const root = createRoot(container as unknown as HTMLElement);
      act(() => {
        root.render(
          React.createElement(BellsGame, {
            onHome: () => {},
            difficulty: "hard",
            lang: "en",
          }),
        );
      });

      // Calling reset invokes clearDemo and restarts round
      act(() => {
        capturedReset?.();
      });

      // After 500ms, note 1 (at 0ms) has played, but note 2 (at ~706ms) has not.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      // We played 1 note in this demo
      expect(notesPlayed).toBe(1);

      // Unmount mid-demo during the listen phase (before note 2 plays at ~706ms)
      act(() => {
        root.unmount();
      });

      // Advance timers well beyond the remaining demo duration
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // No further notes should have played
      expect(notesPlayed).toBe(1);
    } finally {
      g.window = origWindow;
      g.document = origDocument;
      g.HTMLIFrameElement = origHTMLIFrameElement;
      g.IS_REACT_ACT_ENVIRONMENT = origAct;
      playSequenceSpy.mockRestore();
      stopSequenceSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("echo beat", () => {
  it("renders EchoBeatGame and displays localized strings", () => {
    const noop = () => {};
    const html = renderToString(
      React.createElement(EchoBeatGame, {
        onHome: noop,
        difficulty: "easy",
        lang: "en",
      }),
    );
    expect(html).toContain("Echo Beat");
    expect(html).toContain("Tap the rhythm you hear!");
  });

  it("generates rounds with correct hitCount", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const rng = makeRng(seed);
        const r = makeEchoBeatRound(rng, d);
        expect(r.hitCount).toBe(r.gaps.length + 1);
        expect(r.hitCount).toBeGreaterThanOrEqual(2);
        expect(r.hitCount).toBeLessThanOrEqual(6);
        for (const g of r.gaps) {
          expect(g).toBeGreaterThan(0);
        }
      }
    }
  });

  it("perfect echo passes on easy (count only)", () => {
    const rng = makeRng(42);
    const r = makeEchoBeatRound(rng, "easy");
    const taps = Array.from({ length: r.hitCount }, (_, i) => i * 500);
    const result = checkEcho(r, taps, "easy");
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(true);
  });

  it("wrong count fails", () => {
    const rng = makeRng(42);
    const r = makeEchoBeatRound(rng, "medium");
    const taps = Array.from({ length: r.hitCount + 1 }, (_, i) => i * 500);
    const result = checkEcho(r, taps, "medium");
    expect(result.countCorrect).toBe(false);
  });

  it("matching timing passes on medium", () => {
    const rng = makeRng(42);
    const r = makeEchoBeatRound(rng, "medium");
    let t = 0;
    const taps = [t];
    for (const g of r.gaps) {
      t += g * 1000;
      taps.push(t);
    }
    const result = checkEcho(r, taps, "medium");
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(true);
  });

  it("tolerance tightens with difficulty", () => {
    expect(tolerancePct("easy")).toBeGreaterThan(tolerancePct("medium"));
    expect(tolerancePct("medium")).toBeGreaterThan(tolerancePct("hard"));
  });

  it("roundsToWin increases with difficulty", () => {
    expect(echoRounds("easy")).toBeLessThan(echoRounds("medium"));
    expect(echoRounds("medium")).toBeLessThan(echoRounds("hard"));
  });

  it("speechLines covers at least 4 langs, no duplicates", () => {
    const lines = echoSpeechLines();
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe("steady beat", () => {
  it("generates rounds with valid bpm", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const rng = makeRng(seed);
        const r = makeSteadyBeatRound(rng, d);
        expect(r.bpm).toBeGreaterThanOrEqual(60);
        expect(r.bpm).toBeLessThanOrEqual(120);
        expect(r.beatsPerRound).toBe(8);
      }
    }
  });

  it("perfect taps score full marks", () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, "easy");
    const beatMs = 60000 / r.bpm;
    const start = 1000;
    const taps = Array.from({ length: 8 }, (_, i) => start + i * beatMs);
    const result = scoreTaps(r, taps, start, "easy");
    expect(result.hits).toBe(8);
    expect(result.total).toBe(8);
  });

  it("expects first tap on downbeat at startMs when Your turn appears", () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, "hard");
    const beatMs = 60000 / r.bpm;
    const start = 1000;
    // Natural taps starting immediately on the downbeat at startMs score full marks
    const downbeatTaps = Array.from(
      { length: 8 },
      (_, i) => start + i * beatMs,
    );
    const downbeatResult = scoreTaps(r, downbeatTaps, start, "hard");
    expect(downbeatResult.hits).toBe(8);

    // Delayed taps starting 1 beat period after startMs miss beat 0 and lose the 8th tap
    const delayedTaps = Array.from(
      { length: 8 },
      (_, i) => start + (i + 1) * beatMs,
    );
    const delayedResult = scoreTaps(r, delayedTaps, start, "hard");
    expect(delayedResult.hits).toBe(7);
  });

  it("spamming extra taps penalizes the score", () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, "easy");
    const beatMs = 60000 / r.bpm;
    const start = 1000;
    const taps = Array.from({ length: 8 }, (_, i) => start + i * beatMs);
    
    // Add 3 extra wild taps
    taps.push(start + 1.5 * beatMs);
    taps.push(start + 2.5 * beatMs);
    taps.push(start + 3.5 * beatMs);
    
    const result = scoreTaps(r, taps, start, "easy");
    expect(result.hits).toBe(5); // 8 hits minus 3 extra taps
  });

  it("wildly mashing the button drops the score to zero", () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, "easy");
    const start = 1000;
    const taps = Array.from({ length: 20 }, (_, i) => start + i * 100);
    
    const result = scoreTaps(r, taps, start, "easy");
    expect(result.hits).toBe(0); // Way too many extra taps
  });

  it("no taps score zero", () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, "easy");
    const result = scoreTaps(r, [], 1000, "easy");
    expect(result.hits).toBe(0);
  });

  it("window tightens with difficulty", () => {
    expect(windowMs("easy")).toBeGreaterThan(windowMs("medium"));
    expect(windowMs("medium")).toBeGreaterThan(windowMs("hard"));
  });

  it("threshold increases with difficulty", () => {
    expect(passThreshold("easy")).toBeLessThan(passThreshold("medium"));
    expect(passThreshold("medium")).toBeLessThan(passThreshold("hard"));
  });

  it("roundsToWin increases with difficulty", () => {
    expect(steadyRounds("easy")).toBeLessThan(steadyRounds("medium"));
    expect(steadyRounds("medium")).toBeLessThan(steadyRounds("hard"));
  });

  it("speechLines covers at least 4 langs, no duplicates", () => {
    const lines = steadySpeechLines();
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe("same or different", () => {
  it("same rounds have identical phrases", () => {
    let sawSame = false;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const r = makeSameDiffRound(rng, "easy");
      if (r.answer === "same") {
        sawSame = true;
        expect(r.phraseA.map((n) => n.m)).toEqual(r.phraseB.map((n) => n.m));
        expect(isCorrect(r, "same")).toBe(true);
        expect(isCorrect(r, "different")).toBe(false);
      }
    }
    expect(sawSame).toBe(true);
  });

  it("different rounds have at least one changed note", () => {
    let sawDiff = false;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const r = makeSameDiffRound(rng, "hard");
      if (r.answer === "different") {
        sawDiff = true;
        const aMidi = r.phraseA.map((n) => n.m);
        const bMidi = r.phraseB.map((n) => n.m);
        expect(aMidi).not.toEqual(bMidi);
        expect(isCorrect(r, "different")).toBe(true);
        expect(isCorrect(r, "same")).toBe(false);
      }
    }
    expect(sawDiff).toBe(true);
  });

  it("roundsToWin increases with difficulty", () => {
    expect(sdRounds("easy")).toBeLessThan(sdRounds("medium"));
    expect(sdRounds("medium")).toBeLessThan(sdRounds("hard"));
  });

  it("never selects back-to-back duplicate base phrases across rounds", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const rng = makeRng(seed);
        const history: number[] = [];
        const total = sdRounds(d);
        for (let r = 0; r < total; r++) {
          const round = makeSameDiffRound(rng, d, history);
          expect(round.phraseIdx).toBeDefined();
          if (history.length > 0) {
            expect(round.phraseIdx).not.toBe(history[history.length - 1]);
          }
          history.push(round.phraseIdx);
        }
        expect(new Set(history).size).toBe(total);
      }
    }
  });
});
