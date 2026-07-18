// Car Mode round engine — pure logic, no React, no side effects.
// Drives the prompt→gap→reveal→tap-advance loop for every pack.
import { ALL_PACKS, PACK_ORDER, PackId, Round } from './packs';

export interface CarModeState {
  pack: PackId;
  roundIdx: number;
  rounds: Round[];
  phase: 'prompt' | 'gap' | 'reveal' | 'done';
}

export function startState(pack: PackId, seed: number): CarModeState {
  const rounds = shuffleRounds(ALL_PACKS[pack].rounds(), seed);
  return { pack, roundIdx: 0, rounds, phase: 'prompt' };
}

export function currentRound(s: CarModeState): Round | null {
  if (s.phase === 'done') return null;
  return s.rounds[s.roundIdx] ?? null;
}

export function toGap(s: CarModeState): CarModeState {
  return { ...s, phase: 'gap' };
}

export function toReveal(s: CarModeState): CarModeState {
  return { ...s, phase: 'reveal' };
}

export function advance(s: CarModeState): CarModeState {
  const next = s.roundIdx + 1;
  if (next >= s.rounds.length) return { ...s, phase: 'done' };
  return { ...s, roundIdx: next, phase: 'prompt' };
}

export function isComplete(s: CarModeState): boolean {
  return s.phase === 'done';
}

export function progress(s: CarModeState): number {
  return s.rounds.length === 0 ? 0 : s.roundIdx / s.rounds.length;
}

export function nextPack(current: PackId): PackId {
  const idx = PACK_ORDER.indexOf(current);
  return PACK_ORDER[(idx + 1) % PACK_ORDER.length];
}

function shuffleRounds(rounds: Round[], seed: number): Round[] {
  const arr = [...rounds];
  let s = seed | 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function speechLines(): string[] {
  const out = new Set<string>();
  for (const packId of PACK_ORDER) {
    const rounds = ALL_PACKS[packId].rounds();
    for (const r of rounds) {
      for (const line of r.prompt) out.add(line);
      for (const line of r.reveal) out.add(line);
    }
  }
  return [...out];
}
