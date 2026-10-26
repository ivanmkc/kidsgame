import { describe, expect, it } from 'vitest';
import {
  advance,
  currentRound,
  isComplete,
  nextPack,
  progress,
  speechLines,
  startState,
  toGap,
  toReveal,
  handleTap,
  handleTapTimeout,
} from '../logic';
import { ALL_PACKS, PACK_ORDER, PackId } from '../packs';

describe('round engine', () => {
  it('starts at round 0 in prompt phase', () => {
    const s = startState('boops', 42);
    expect(s.roundIdx).toBe(0);
    expect(s.phase).toBe('prompt');
    expect(s.pack).toBe('boops');
  });

  it('transitions prompt → gap → reveal → advance', () => {
    let s = startState('rhyme', 1);
    expect(s.phase).toBe('prompt');

    s = toGap(s);
    expect(s.phase).toBe('gap');

    s = toReveal(s);
    expect(s.phase).toBe('reveal');

    const r1 = currentRound(s);
    s = advance(s);
    expect(s.phase).toBe('prompt');
    expect(s.roundIdx).toBe(1);
    const r2 = currentRound(s);
    expect(r2).not.toBeNull();
    expect(r2!.id).not.toBe(r1!.id);
  });

  it('completes after the last round', () => {
    let s = startState('boops', 7);
    while (!isComplete(s)) {
      s = toGap(s);
      s = toReveal(s);
      s = advance(s);
    }
    expect(s.phase).toBe('done');
    expect(currentRound(s)).toBeNull();
  });

  it('progress tracks correctly', () => {
    const s = startState('rhyme', 1);
    expect(progress(s)).toBe(0);
    let s2 = s;
    for (let i = 0; i < 5; i++) {
      s2 = toGap(s2);
      s2 = toReveal(s2);
      s2 = advance(s2);
    }
    expect(progress(s2)).toBeGreaterThan(0);
  });

  it('nextPack cycles through all packs', () => {
    let p: PackId = 'boops';
    const visited: PackId[] = [p];
    for (let i = 0; i < PACK_ORDER.length; i++) {
      p = nextPack(p);
      visited.push(p);
    }
    expect(visited[visited.length - 1]).toBe('boops');
    expect(new Set(visited).size).toBe(PACK_ORDER.length);
  });
});

describe('pack data integrity', () => {
  for (const packId of PACK_ORDER) {
    describe(packId, () => {
      const rounds = ALL_PACKS[packId].rounds();

      it('has at least 4 rounds', () => {
        expect(rounds.length).toBeGreaterThanOrEqual(4);
      });

      it('every round has prompt and reveal', () => {
        for (const r of rounds) {
          expect(r.prompt.length).toBeGreaterThan(0);
          expect(r.reveal.length).toBeGreaterThan(0);
          expect(r.gapMs).toBeGreaterThan(0);
          expect(r.pack).toBe(packId);
          expect(r.id).toBeTruthy();
        }
      });

      it('round ids are unique', () => {
        const ids = rounds.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }
});

describe('boops pack specifics', () => {
  const rounds = ALL_PACKS.boops.rounds();

  it('noteCount matches the claimed number in the reveal', () => {
    for (const r of rounds) {
      expect(r.noteCount).toBeDefined();
      expect(r.noteCount).toBeGreaterThan(0);
      expect(r.noteCount).toBeLessThanOrEqual(10);
      expect(r.reveal[0]).toContain(String(r.noteCount));
    }
  });
});

describe('silly pack specifics', () => {
  const rounds = ALL_PACKS.silly.rounds();

  it('has twoTapAnswer flag on every round', () => {
    for (const r of rounds) {
      expect(r.twoTapAnswer).toBe(true);
    }
  });

  it('has answer boolean matching silly/true', () => {
    for (const r of rounds) {
      expect(typeof r.answer).toBe('boolean');
    }
  });
});

describe('whoami pack specifics', () => {
  const rounds = ALL_PACKS.whoami.rounds();

  it('snail riddle includes a distinguishing clue not shared by a turtle', () => {
    const snailRound = rounds.find((r) => r.reveal.includes('A snail!'));
    expect(snailRound).toBeDefined();
    expect(snailRound!.prompt).toContain(
      'I leave a shiny silver trail wherever I go.',
    );
  });
});

describe('speechLines', () => {
  it('returns >50 lines', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(50);
  });

  it('includes lines from every pack', () => {
    const lines = new Set(speechLines());
    for (const packId of PACK_ORDER) {
      const rounds = ALL_PACKS[packId].rounds();
      const firstPrompt = rounds[0].prompt[0];
      expect(lines.has(firstPrompt)).toBe(true);
    }
  });

  it('has no empty strings', () => {
    for (const line of speechLines()) {
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

describe('handleTap pure transitions', () => {
  it('gap phase single tap starts pending state if twoTapAnswer', () => {
    let s = startState('silly', 42); // silly pack has twoTapAnswer
    s = toGap(s);
    const next = handleTap(s);
    expect(next.pendingTaps).toBe(1);
    expect(next.phase).toBe('gap');
  });

  it('gap phase double tap transitions immediately if twoTapAnswer', () => {
    let s = startState('silly', 42);
    s = toGap(s);
    s.pendingTaps = 1; // Simulate one tap already happened
    const next = handleTap(s);
    expect(next.phase).toBe('reveal');
    expect(next.pendingTaps).toBe(0);
  });

  it('reveal phase single tap advances immediately even if twoTapAnswer', () => {
    let s = startState('silly', 42);
    s = toReveal(s);
    const next = handleTap(s);
    expect(next.phase).toBe('prompt');
    expect(next.pendingTaps).toBe(0);
    expect(next.roundIdx).toBe(1);
  });
});

describe('handleTapTimeout pure transitions', () => {
  it('transitions to reveal from gap on timeout', () => {
    let s = startState('silly', 42);
    s = toGap(s);
    s.pendingTaps = 1;
    const next = handleTapTimeout(s);
    expect(next.phase).toBe('reveal');
    expect(next.pendingTaps).toBe(0);
  });

  it('advances from reveal on timeout', () => {
    let s = startState('silly', 42);
    s = toReveal(s);
    s.pendingTaps = 1;
    const next = handleTapTimeout(s);
    expect(next.phase).toBe('prompt');
    expect(next.pendingTaps).toBe(0);
  });
});

describe('difficulty filter in startState', () => {
  it('limits boops to 1-3 on easy', () => {
    const s = startState('boops', 42, 'easy');
    expect(s.rounds.length).toBe(3);
    for (const r of s.rounds) {
      expect(r.noteCount).toBeLessThanOrEqual(3);
    }
  });

  it('limits boops to 4-6 on medium', () => {
    const s = startState('boops', 42, 'medium');
    expect(s.rounds.length).toBe(3);
    for (const r of s.rounds) {
      expect(r.noteCount).toBeGreaterThanOrEqual(4);
      expect(r.noteCount).toBeLessThanOrEqual(6);
    }
  });

  it('limits boops to 7-10 on hard', () => {
    const s = startState('boops', 42, 'hard');
    expect(s.rounds.length).toBe(4);
    for (const r of s.rounds) {
      expect(r.noteCount).toBeGreaterThanOrEqual(7);
      expect(r.noteCount).toBeLessThanOrEqual(10);
    }
  });

  it('includes all 10 boops when difficulty is all', () => {
    const s = startState('boops', 42, 'all');
    expect(s.rounds.length).toBe(10);
  });

  it('gap phase tap stays in gap for standard packs to allow prompt replay', () => {
    let s = startState('boops', 42);
    s = toGap(s);
    const next = handleTap(s);
    expect(next.phase).toBe('gap');
  });
});
