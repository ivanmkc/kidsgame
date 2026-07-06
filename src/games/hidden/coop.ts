import { PlayerIx } from '../../multiplayer';

// Pure co-op "Team Hunt" helpers. Players/turn order come from
// multiplayer.ts (MP_PLAYERS, nextTurn) — no local roster.

/** Co-op draws an EVEN number of targets so a completed scene splits exactly
 *  N/2: odd → +1, clamp to pool, still-odd → −1. */
export function coopDrawCount(base: number, poolSize: number): number {
  let n = base % 2 === 1 ? base + 1 : base;
  n = Math.min(n, poolSize);
  if (n % 2 === 1) n -= 1;
  return n;
}

/** A found target, stamped with who held the turn (null in solo). */
export type Find = { id: string; by: PlayerIx | null };

export function countFor(finds: Find[], ix: PlayerIx): number {
  return finds.filter((f) => f.by === ix).length;
}
