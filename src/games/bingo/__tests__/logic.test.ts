import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../rng';
import { manifest } from '../../../manifest';
import { WORDS, soundsFor } from '../../language/words';
import {
  BingoBoard, checkBingo, makeBoard, settingsForBingo, speechLines,
} from '../logic';

const icons = manifest.spotit.icons;

function boardWith(seed: number, size: number, mode: 'name' | 'phonics', lang: 'en' | 'ja' | 'cmn' | 'yue' = 'en'): BingoBoard {
  return makeBoard(makeRng(seed), icons, size, mode, lang);
}

describe('makeBoard', () => {
  it('produces a 3x3 board with 9 cells and 9 calls', () => {
    const b = boardWith(42, 3, 'name');
    expect(b.size).toBe(3);
    expect(b.cells).toHaveLength(9);
    expect(b.calls).toHaveLength(9);
  });

  it('produces a 4x4 board with 16 cells and 16 calls', () => {
    const b = boardWith(99, 4, 'name');
    expect(b.size).toBe(4);
    expect(b.cells).toHaveLength(16);
    expect(b.calls).toHaveLength(16);
  });

  it('has all distinct icons on the board', () => {
    const b = boardWith(1, 3, 'name');
    const boardIcons = b.cells.map((c) => c.icon);
    expect(new Set(boardIcons).size).toBe(9);
  });

  it('every call targets exactly one cell on the board', () => {
    const b = boardWith(7, 4, 'name');
    for (const call of b.calls) {
      expect(call.answerIdx).toBeGreaterThanOrEqual(0);
      expect(call.answerIdx).toBeLessThan(b.cells.length);
    }
  });

  it('no two calls target the same cell', () => {
    const b = boardWith(7, 4, 'name');
    const targets = b.calls.map((c) => c.answerIdx);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('phonics board has distinct sounds per cell', () => {
    const b = boardWith(42, 3, 'phonics');
    const sounds = b.cells.map((c) => {
      const w = WORDS.find((entry) => entry.icon === c.icon);
      return w?.sound;
    });
    expect(new Set(sounds).size).toBe(9);
  });

  it('phonics board: no call has two plausible answers, under any child name', () => {
    // "Find something that starts with buh!" must not offer BOTH the
    // butterfly and the rabbit (a kid calls it a bunny).
    for (let seed = 1; seed <= 200; seed++) {
      const b = boardWith(seed, 3, 'phonics');
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

  it('name board: never shows two icons a kid calls by the same word', () => {
    // "Find the flower!" fits the blossom and the sunflower equally.
    for (const size of [3, 4] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const b = boardWith(seed, size, 'name');
        expect(b.cells).toHaveLength(size * size);
        const onBoard = new Set(b.cells.map((c) => c.icon));
        for (const icon of onBoard) {
          const w = WORDS.find((entry) => entry.icon === icon)!;
          for (const twin of w.nameTwins ?? []) expect(onBoard.has(twin)).toBe(false);
        }
      }
    }
  });

  it('works in all four languages', () => {
    for (const lang of ['en', 'ja', 'cmn', 'yue'] as const) {
      const b = boardWith(10, 3, 'name', lang);
      expect(b.cells).toHaveLength(9);
      for (const call of b.calls) {
        expect(call.promptLines.length).toBeGreaterThan(0);
        expect(call.displayPrompt.length).toBeGreaterThan(0);
        expect(call.confirmLines.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('checkBingo', () => {
  it('returns null for an empty 3x3 board', () => {
    expect(checkBingo(Array(9).fill(false), 3)).toBeNull();
  });

  it('detects a completed row', () => {
    const m = [true, true, true, false, false, false, false, false, false];
    expect(checkBingo(m, 3)).toEqual([0, 1, 2]);
  });

  it('detects a completed column', () => {
    const m = [true, false, false, true, false, false, true, false, false];
    expect(checkBingo(m, 3)).toEqual([0, 3, 6]);
  });

  it('detects main diagonal', () => {
    const m = [true, false, false, false, true, false, false, false, true];
    expect(checkBingo(m, 3)).toEqual([0, 4, 8]);
  });

  it('detects anti-diagonal', () => {
    const m = [false, false, true, false, true, false, true, false, false];
    expect(checkBingo(m, 3)).toEqual([2, 4, 6]);
  });

  it('returns null when no line is complete', () => {
    const m = [true, false, false, false, true, false, false, false, false];
    expect(checkBingo(m, 3)).toBeNull();
  });

  it('works for 4x4', () => {
    const m = Array(16).fill(false);
    m[0] = m[5] = m[10] = m[15] = true;
    expect(checkBingo(m, 4)).toEqual([0, 5, 10, 15]);
  });
});

describe('full game playthrough', () => {
  it('always reaches bingo within N^2 calls', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const size of [3, 4]) {
        const b = boardWith(seed, size, 'name');
        const marked = Array(b.cells.length).fill(false);
        let foundBingo = false;
        for (const call of b.calls) {
          marked[call.answerIdx] = true;
          if (checkBingo(marked, size)) { foundBingo = true; break; }
        }
        expect(foundBingo).toBe(true);
      }
    }
  });
});

describe('settingsForBingo', () => {
  it('easy is 3x3 name', () => {
    expect(settingsForBingo('easy', 'en')).toEqual({ gridSize: 3, mode: 'name' });
  });
  it('medium EN is 3x3 phonics', () => {
    expect(settingsForBingo('medium', 'en')).toEqual({ gridSize: 3, mode: 'phonics' });
  });
  it('medium JA falls back to name', () => {
    expect(settingsForBingo('medium', 'ja')).toEqual({ gridSize: 3, mode: 'name' });
  });
  it('hard is 4x4 name', () => {
    expect(settingsForBingo('hard', 'en')).toEqual({ gridSize: 4, mode: 'name' });
  });
});

describe('speechLines', () => {
  it('returns a non-empty set', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(50);
  });

  it('has no duplicates', () => {
    const lines = speechLines();
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('includes bingo shout for all langs', () => {
    const lines = speechLines();
    expect(lines).toContain('BINGO!');
    expect(lines).toContain('ビンゴ！');
    expect(lines).toContain('宾果！');
    expect(lines).toContain('BINGO！');
  });

  it('includes name-mode prompts', () => {
    const lines = speechLines();
    expect(lines).toContain('Find the dog!');
    expect(lines).toContain('さがしてね');
    expect(lines).toContain('找一找');
    expect(lines).toContain('搵一搵');
  });

  it('includes phonics prompts', () => {
    const lines = speechLines();
    expect(lines).toContain('Find something that starts with duh!');
  });
});
