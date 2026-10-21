import { describe, expect, it } from "vitest";
import { makeRng } from "../../../rng";
import { manifest } from "../../../manifest";
import { VOICE } from "../../../assets/voice";
import { WORDS, soundsFor } from "../../../words";
import {
  BingoBoard,
  bingoLayout,
  checkBingo,
  makeBoard,
  settingsForBingo,
  speechLines,
  bingoShout,
  tileLabel,
} from "../logic";

const icons = manifest.spotit.icons;

function boardWith(
  seed: number,
  size: number,
  mode: "name" | "phonics",
  lang: "en" | "ja" | "cmn" | "yue" = "en",
): BingoBoard {
  return makeBoard(makeRng(seed), icons, size, mode, lang);
}

describe("makeBoard", () => {
  it("produces a 3x3 board with 9 cells and 9 calls", () => {
    const b = boardWith(42, 3, "name");
    expect(b.size).toBe(3);
    expect(b.cells).toHaveLength(9);
    expect(b.calls).toHaveLength(9);
  });

  it("produces a 4x4 board with 16 cells and 16 calls", () => {
    const b = boardWith(99, 4, "name");
    expect(b.size).toBe(4);
    expect(b.cells).toHaveLength(16);
    expect(b.calls).toHaveLength(16);
  });

  it("has all distinct icons on the board", () => {
    const b = boardWith(1, 3, "name");
    const boardIcons = b.cells.map((c) => c.icon);
    expect(new Set(boardIcons).size).toBe(9);
  });

  it("every call targets exactly one cell on the board", () => {
    const b = boardWith(7, 4, "name");
    for (const call of b.calls) {
      expect(call.answerIdx).toBeGreaterThanOrEqual(0);
      expect(call.answerIdx).toBeLessThan(b.cells.length);
    }
  });

  it("no two calls target the same cell", () => {
    const b = boardWith(7, 4, "name");
    const targets = b.calls.map((c) => c.answerIdx);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("phonics board has distinct sounds per cell", () => {
    const b = boardWith(42, 3, "phonics");
    const sounds = b.cells.map((c) => {
      const w = WORDS.find((entry) => entry.icon === c.icon);
      return w?.sound;
    });
    expect(new Set(sounds).size).toBe(9);
  });

  it("phonics board: no call has two plausible answers, under any child name", () => {
    // "Find something that starts with buh!" must not offer BOTH the
    // butterfly and the rabbit (a kid calls it a bunny).
    for (let seed = 1; seed <= 200; seed++) {
      const b = boardWith(seed, 3, "phonics");
      expect(b.cells).toHaveLength(9);
      const claimed = new Set<string>();
      for (const c of b.cells) {
        const w = WORDS.find((entry) => entry.icon === c.icon)!;
        for (const snd of soundsFor(w)) {
          expect(claimed.has(snd)).toBe(false);
          claimed.add(snd);
        }
      }
    }
  });

  it("name board: never shows two icons a kid calls by the same word", () => {
    // "Find the flower!" fits the blossom and the sunflower equally.
    for (const size of [3, 4, 5] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const b = boardWith(seed, size, "name");
        expect(b.cells).toHaveLength(size * size);
        const onBoard = new Set(b.cells.map((c) => c.icon));
        for (const icon of onBoard) {
          const w = WORDS.find((entry) => entry.icon === icon)!;
          for (const twin of w.nameTwins ?? [])
            expect(onBoard.has(twin)).toBe(false);
        }
      }
    }
  });

  it("works in all four languages", () => {
    for (const lang of ["en", "ja", "cmn", "yue"] as const) {
      const b = boardWith(10, 3, "name", lang);
      expect(b.cells).toHaveLength(9);
      for (const call of b.calls) {
        expect(call.promptLines.length).toBeGreaterThan(0);
        expect(call.confirmLines.length).toBeGreaterThan(0);
      }
    }
  });

  it("assigns localized spoken labels to all cells across languages", () => {
    for (const lang of ["en", "ja", "cmn", "yue"] as const) {
      const b = boardWith(10, 3, "name", lang);
      for (const cell of b.cells) {
        expect(cell.label).toBe(tileLabel(cell.icon, lang));
        expect(cell.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("checkBingo", () => {
  it("returns null for an empty 3x3 board", () => {
    expect(checkBingo(Array(9).fill(false), 3)).toBeNull();
  });

  it("detects a completed row", () => {
    const m = [true, true, true, false, false, false, false, false, false];
    expect(checkBingo(m, 3)).toEqual([0, 1, 2]);
  });

  it("detects a completed column", () => {
    const m = [true, false, false, true, false, false, true, false, false];
    expect(checkBingo(m, 3)).toEqual([0, 3, 6]);
  });

  it("detects main diagonal", () => {
    const m = [true, false, false, false, true, false, false, false, true];
    expect(checkBingo(m, 3)).toEqual([0, 4, 8]);
  });

  it("detects anti-diagonal", () => {
    const m = [false, false, true, false, true, false, true, false, false];
    expect(checkBingo(m, 3)).toEqual([2, 4, 6]);
  });

  it("returns null when no line is complete", () => {
    const m = [true, false, false, false, true, false, false, false, false];
    expect(checkBingo(m, 3)).toBeNull();
  });

  it("works for 4x4", () => {
    const m = Array(16).fill(false);
    m[0] = m[5] = m[10] = m[15] = true;
    expect(checkBingo(m, 4)).toEqual([0, 5, 10, 15]);
  });

  it("works for 5x5", () => {
    const m = Array(25).fill(false);
    m[0] = m[6] = m[12] = m[18] = m[24] = true;
    expect(checkBingo(m, 5)).toEqual([0, 6, 12, 18, 24]);
  });
});

describe("full game playthrough", () => {
  it("always reaches bingo within N^2 calls", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const size of [3, 4, 5]) {
        const b = boardWith(seed, size, "name");
        const marked = Array(b.cells.length).fill(false);
        let foundBingo = false;
        for (const call of b.calls) {
          marked[call.answerIdx] = true;
          if (checkBingo(marked, size)) {
            foundBingo = true;
            break;
          }
        }
        expect(foundBingo).toBe(true);
      }
    }
  });
});

describe("settingsForBingo", () => {
  it("easy is 3x3 name in all languages", () => {
    expect(settingsForBingo("easy", "en")).toEqual({
      gridSize: 3,
      mode: "name",
    });
    expect(settingsForBingo("easy", "ja")).toEqual({
      gridSize: 3,
      mode: "name",
    });
    expect(settingsForBingo("easy", "cmn")).toEqual({
      gridSize: 3,
      mode: "name",
    });
    expect(settingsForBingo("easy", "yue")).toEqual({
      gridSize: 3,
      mode: "name",
    });
  });

  it("medium EN is 4x4 name", () => {
    expect(settingsForBingo("medium", "en")).toEqual({
      gridSize: 4,
      mode: "name",
    });
  });

  it("medium non-EN differentiates from easy with a 4x4 board", () => {
    expect(settingsForBingo("medium", "ja")).toEqual({
      gridSize: 4,
      mode: "name",
    });
    expect(settingsForBingo("medium", "cmn")).toEqual({
      gridSize: 4,
      mode: "name",
    });
    expect(settingsForBingo("medium", "yue")).toEqual({
      gridSize: 4,
      mode: "name",
    });
  });

  it("hard is 3x3 phonics in EN and 5x5 name in non-EN", () => {
    expect(settingsForBingo("hard", "en")).toEqual({
      gridSize: 3,
      mode: "phonics",
    });
    expect(settingsForBingo("hard", "ja")).toEqual({
      gridSize: 5,
      mode: "name",
    });
    expect(settingsForBingo("hard", "cmn")).toEqual({
      gridSize: 5,
      mode: "name",
    });
    expect(settingsForBingo("hard", "yue")).toEqual({
      gridSize: 5,
      mode: "name",
    });
  });

  it("difficulty levels are strictly distinct across all languages", () => {
    for (const lang of ["en", "ja", "cmn", "yue"] as const) {
      const easy = settingsForBingo("easy", lang);
      const medium = settingsForBingo("medium", lang);
      const hard = settingsForBingo("hard", lang);
      expect(easy).not.toEqual(medium);
      expect(medium).not.toEqual(hard);
      expect(easy).not.toEqual(hard);
    }
  });
});

describe("bingoLayout", () => {
  it("portrait: keeps gap 10, sets landscape false", () => {
    const l = bingoLayout(390, 844, 4);
    expect(l.isLandscape).toBe(false);
    expect(l.gap).toBe(10);
    expect(l.tileSize).toBeGreaterThan(0);
  });

  it("landscape (phone): sets landscape true, touch targets >= 64px for 4x4", () => {
    const l = bingoLayout(844, 390, 4);
    expect(l.isLandscape).toBe(true);
    expect(l.gap).toBe(8);
    expect(l.tileSize).toBeGreaterThanOrEqual(64);
  });

  it("landscape (phone): sets landscape true, touch targets >= 64px for 3x3", () => {
    const l = bingoLayout(844, 390, 3);
    expect(l.isLandscape).toBe(true);
    expect(l.gap).toBe(10);
    expect(l.tileSize).toBeGreaterThanOrEqual(64);
  });
});

describe("speechLines", () => {
  it("returns a non-empty set", () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(50);
  });

  it("has no duplicates", () => {
    const lines = speechLines();
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("includes bingo shout for all langs", () => {
    const lines = speechLines();
    expect(lines).toContain("BINGO!");
    expect(lines).toContain("ビンゴ！");
    expect(lines).toContain("宾果！");
  });

  it("includes name-mode prompts", () => {
    const lines = speechLines();
    expect(lines).toContain("Find the dog!");
    expect(lines).toContain("さがしてね");
    expect(lines).toContain("找一找");
    expect(lines).toContain("搵一搵");
  });

  it("includes phonics prompts", () => {
    const lines = speechLines();
    expect(lines).toContain("Find something that starts with duh!");
  });

  it("every promptLines and confirmLines entry on generated phonics boards is in speechLines", () => {
    const manifestLines = new Set(speechLines());
    for (let seed = 1; seed <= 50; seed++) {
      const b = boardWith(seed, 3, "phonics");
      for (const call of b.calls) {
        for (const line of call.promptLines) {
          expect(manifestLines.has(line)).toBe(true);
        }
        for (const line of call.confirmLines) {
          expect(manifestLines.has(line)).toBe(true);
        }
      }
    }
  });
});

describe("bingoShout", () => {
  it("returns ASCII shout for Cantonese matching English", () => {
    expect(bingoShout("yue")).toBe("BINGO!");
  });

  it("maps every language shout to a pre-rendered voice clip", () => {
    const langs = ["en", "ja", "cmn", "yue"] as const;
    for (const lang of langs) {
      const shout = bingoShout(lang);
      const clip =
        (lang !== "en" ? VOICE[`${lang}|${shout}`] : undefined) ?? VOICE[shout];
      expect(clip).toBeDefined();
    }
  });
});

describe("tileLabel", () => {
  it("returns localized spoken words matching the prompt instead of raw icon IDs", () => {
    expect(tileLabel("blossom", "en")).toBe("flower");
    expect(tileLabel("blossom", "ja")).toBe("はな");
    expect(tileLabel("blossom", "cmn")).toBe("花");
    expect(tileLabel("blossom", "yue")).toBe("花");

    expect(tileLabel("soccer", "en")).toBe("ball");
    expect(tileLabel("soccer", "ja")).toBe("ボール");
    expect(tileLabel("soccer", "cmn")).toBe("足球");
    expect(tileLabel("soccer", "yue")).toBe("足球");

    expect(tileLabel("gift", "en")).toBe("present");
    expect(tileLabel("gift", "ja")).toBe("プレゼント");
    expect(tileLabel("gift", "cmn")).toBe("礼物");
    expect(tileLabel("gift", "yue")).toBe("禮物");

    expect(tileLabel("icecream", "en")).toBe("ice cream");
    expect(tileLabel("icecream", "ja")).toBe("アイスクリーム");
    expect(tileLabel("icecream", "cmn")).toBe("冰淇淋");
    expect(tileLabel("icecream", "yue")).toBe("雪糕");

    expect(tileLabel("dog", "en")).toBe("dog");
    expect(tileLabel("dog", "ja")).toBe("いぬ");
    expect(tileLabel("dog", "cmn")).toBe("狗");
    expect(tileLabel("dog", "yue")).toBe("狗");
  });

  it("throws loudly when given an unknown icon", () => {
    expect(() => tileLabel("unknown-asset-id", "en")).toThrow(
      "Unknown bingo icon: unknown-asset-id",
    );
  });
});
