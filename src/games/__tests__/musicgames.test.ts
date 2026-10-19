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
  checkSequence,
  roundsToWin: bellRounds,
  seqLength,
  canTap,
} = bellsLogic;
import {
  makeEchoBeatRound,
  checkEcho,
  roundsToWin as echoRounds,
  tolerancePct,
} from "../echobeat/logic";
import {
  makeSteadyBeatRound,
  scoreTaps,
  roundsToWin as steadyRounds,
  passThreshold,
  windowMs,
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

  it("checkSequence validates correctly", () => {
    const rng = makeRng(42);
    const r = makeBellsRound(rng, "easy");
    expect(checkSequence(r, r.sequence)).toBe(true);
    expect(checkSequence(r, [])).toBe(false);
    const wrong = r.sequence.map((v) => (v + 1) % r.bells.length);
    if (wrong.some((v, i) => v !== r.sequence[i])) {
      expect(checkSequence(r, wrong)).toBe(false);
    }
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
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});

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

      // After 1050ms, initial 500ms delay plays note 1, then at 1000ms
      // the glow clears and step is scheduled for note 2 at 1200ms.
      act(() => {
        vi.advanceTimersByTime(1050);
      });
      // We played 1 note in this demo
      expect(playNoteSpy).toHaveBeenCalledTimes(1);

      // Unmount mid-demo during the listen phase (before note 2 plays at 1200ms)
      act(() => {
        root.unmount();
      });

      // Advance timers well beyond the remaining demo duration
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // No further notes should have played
      expect(playNoteSpy).toHaveBeenCalledTimes(1);
    } finally {
      g.window = origWindow;
      g.document = origDocument;
      g.HTMLIFrameElement = origHTMLIFrameElement;
      g.IS_REACT_ACT_ENVIRONMENT = origAct;
      playNoteSpy.mockRestore();
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
    const taps = Array.from({ length: 8 }, (_, i) => start + (i + 1) * beatMs);
    const result = scoreTaps(r, taps, start, "easy");
    expect(result.hits).toBe(8);
    expect(result.total).toBe(8);
  });

  it("expects first tap one beat after count-in ends, not at startMs", () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, "hard");
    const beatMs = 60000 / r.bpm;
    const start = 1000;
    // Tapping at startMs (count-in beat 4) misses beat 1 and loses the 8th tap
    const prematureTaps = Array.from(
      { length: 8 },
      (_, i) => start + i * beatMs,
    );
    const simResult = scoreTaps(r, prematureTaps, start, "hard");
    expect(simResult.hits).toBe(7);

    // Natural taps starting 1 beat period after startMs score full marks
    const naturalTaps = Array.from(
      { length: 8 },
      (_, i) => start + (i + 1) * beatMs,
    );
    const naturalResult = scoreTaps(r, naturalTaps, start, "hard");
    expect(naturalResult.hits).toBe(8);
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
});
