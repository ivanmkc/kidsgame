import { PlayerIx, nextTurn } from '../multiplayer';

export interface DuelState {
  turn: PlayerIx;
  pairs: [number, number];
}

export function duelInit(first: PlayerIx): DuelState {
  return { turn: first, pairs: [0, 0] };
}

/** Match: scorer keeps the turn (classic extra-turn rule); miss: turn flips. */
export function duelResolve(s: DuelState, isMatch: boolean): DuelState {
  if (isMatch) {
    const pairs: [number, number] = [...s.pairs];
    pairs[s.turn] += 1;
    return { turn: s.turn, pairs };
  }
  return { turn: nextTurn(s.turn), pairs: s.pairs };
}

export function duelWinner(s: DuelState): PlayerIx | 'tie' {
  if (s.pairs[0] === s.pairs[1]) return 'tie';
  return s.pairs[0] > s.pairs[1] ? 0 : 1;
}

/** Loser starts the rematch; ties alternate from the last mover. */
export function nextStarter(s: DuelState): PlayerIx {
  const w = duelWinner(s);
  return w === 'tie' ? nextTurn(s.turn) : nextTurn(w);
}
