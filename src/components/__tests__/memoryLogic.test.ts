import { describe, expect, it } from 'vitest';
import { duelInit, duelResolve, duelWinner, nextStarter } from '../memoryLogic';

describe('memoryLogic duel reducers', () => {
  it('duelInit sets initial turn and zero pairs', () => {
    expect(duelInit(0)).toEqual({ turn: 0, pairs: [0, 0] });
    expect(duelInit(1)).toEqual({ turn: 1, pairs: [0, 0] });
  });

  it('duelResolve gives extra turn and increments pair count on match', () => {
    const s0 = duelInit(0);
    const s1 = duelResolve(s0, true);
    expect(s1).toEqual({ turn: 0, pairs: [1, 0] });

    const s2 = duelResolve(s1, true);
    expect(s2).toEqual({ turn: 0, pairs: [2, 0] });
  });

  it('duelResolve flips turn and keeps pair count on miss', () => {
    const s0 = duelInit(0);
    const s1 = duelResolve(s0, false);
    expect(s1).toEqual({ turn: 1, pairs: [0, 0] });

    const s2 = duelResolve(s1, false);
    expect(s2).toEqual({ turn: 0, pairs: [0, 0] });
  });

  it('duelWinner correctly identifies winner or tie', () => {
    expect(duelWinner({ turn: 0, pairs: [2, 2] })).toBe('tie');
    expect(duelWinner({ turn: 1, pairs: [3, 1] })).toBe(0);
    expect(duelWinner({ turn: 0, pairs: [1, 3] })).toBe(1);
  });

  it('nextStarter selects loser on win and alternates on tie', () => {
    // When player 0 won, player 1 starts
    expect(nextStarter({ turn: 0, pairs: [3, 1] })).toBe(1);
    // When player 1 won, player 0 starts
    expect(nextStarter({ turn: 1, pairs: [1, 3] })).toBe(0);
    // On tie, alternates from last mover
    expect(nextStarter({ turn: 0, pairs: [2, 2] })).toBe(1);
    expect(nextStarter({ turn: 1, pairs: [2, 2] })).toBe(0);
  });
});
