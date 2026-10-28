// Car Mode round engine — pure logic, no React, no side effects.
// Drives the prompt→gap→reveal→tap-advance loop for every pack.
import { Difficulty, DifficultyFilter } from "../../difficulty";
import { ALL_PACKS, PACK_ORDER, PackId, Round } from "./packs";

export interface CarModeState {
  pack: PackId;
  roundIdx: number;
  rounds: Round[];
  phase: "prompt" | "gap" | "reveal" | "done";
  pendingTaps: number;
  playerAnswer?: boolean;
}

export function filterRoundsByDifficulty(
  rounds: Round[],
  pack: PackId,
  difficulty?: Difficulty | DifficultyFilter,
): Round[] {
  if (!difficulty || difficulty === "all") return rounds;
  if (pack === "boops") {
    if (difficulty === "easy") {
      return rounds.filter((r) => (r.noteCount ?? 0) <= 3);
    }
    if (difficulty === "medium") {
      return rounds.filter(
        (r) => (r.noteCount ?? 0) >= 4 && (r.noteCount ?? 0) <= 6,
      );
    }
    if (difficulty === "hard") {
      return rounds.filter(
        (r) => (r.noteCount ?? 0) >= 7 && (r.noteCount ?? 0) <= 10,
      );
    }
  }

  if (rounds.some(r => r.level)) {
    return rounds.filter((r) => r.level === difficulty);
  }

  return rounds;
}

export function startState(
  pack: PackId,
  seed: number,
  difficulty?: Difficulty | DifficultyFilter,
): CarModeState {
  const all = ALL_PACKS[pack].rounds();
  const filtered = filterRoundsByDifficulty(all, pack, difficulty);
  const rounds = shuffleRounds(filtered, seed);
  return { pack, roundIdx: 0, rounds, phase: "prompt", pendingTaps: 0 };
}

export function currentRound(s: CarModeState): Round | null {
  if (s.phase === "done") return null;
  return s.rounds[s.roundIdx] ?? null;
}

export function toGap(s: CarModeState): CarModeState {
  if (s.phase === "gap") return s;
  return { ...s, phase: "gap", pendingTaps: 0, playerAnswer: undefined };
}

export function toReveal(s: CarModeState, forceAnswer?: boolean): CarModeState {
  if (s.phase === "reveal") return s;
  let ans = forceAnswer;
  if (ans === undefined) {
    const r = currentRound(s);
    if (r?.twoTapAnswer && s.pendingTaps === 1) {
      ans = true;
    }
  }
  return { ...s, phase: "reveal", pendingTaps: 0, playerAnswer: ans };
}

export function advance(s: CarModeState): CarModeState {
  const next = s.roundIdx + 1;
  if (next >= s.rounds.length)
    return { ...s, phase: "done", pendingTaps: 0, playerAnswer: undefined };
  return {
    ...s,
    roundIdx: next,
    phase: "prompt",
    pendingTaps: 0,
    playerAnswer: undefined,
  };
}

export function handleTap(s: CarModeState): CarModeState {
  if (s.phase === "prompt" || s.phase === "done") return s;

  const r = currentRound(s);

  if (s.phase === "gap") {
    if (r?.twoTapAnswer) {
      if (s.pendingTaps === 0) return { ...s, pendingTaps: 1 };
      return toReveal(s, false);
    }
    return s;
  }

  if (s.phase === "reveal") {
    return advance(s);
  }
  return s;
}

export function handleTapTimeout(s: CarModeState): CarModeState {
  if (s.pendingTaps === 0) return s;
  if (s.phase === "gap") return toReveal(s);
  if (s.phase === "reveal") return advance(s);
  return { ...s, pendingTaps: 0 };
}

export function isComplete(s: CarModeState): boolean {
  return s.phase === "done";
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
