import { Rng } from "../../rng";
import { Difficulty } from "../../difficulty";
import { SeqNote } from "../../music";
import { LANGS } from "../../lang";
import { t } from "../../i18n";

const MELODIES: SeqNote[][] = [
  [
    { m: 60, b: 1 },
    { m: 62, b: 1 },
    { m: 64, b: 1 },
    { m: 62, b: 1 },
    { m: 60, b: 2 },
  ],
  [
    { m: 64, b: 1 },
    { m: 65, b: 1 },
    { m: 67, b: 2 },
    { m: 64, b: 1 },
    { m: 62, b: 1 },
    { m: 60, b: 2 },
  ],
  [
    { m: 60, b: 1 },
    { m: 64, b: 1 },
    { m: 67, b: 1 },
    { m: 72, b: 2 },
    { m: 67, b: 1 },
    { m: 60, b: 2 },
  ],
  [
    { m: 67, b: 1 },
    { m: 65, b: 1 },
    { m: 64, b: 1 },
    { m: 62, b: 1 },
    { m: 60, b: 2 },
  ],
];

export interface FastSlowRound {
  notes: SeqNote[];
  bpm: number;
}

/** Every bpm a round can carry sits clearly on one side of this line
 *  (slow tempos top out at 100, fast ones start at 140). */
const FAST_BPM_MIN = 140;

export function roundsToWin(d: Difficulty): number {
  if (d === "easy") return 8;
  if (d === "medium") return 10;
  return 12;
}

export function makeFastSlowRound(
  rng: Rng,
  d: Difficulty,
  history: ("fast" | "slow")[] = [],
): FastSlowRound {
  let speed: "fast" | "slow";
  const len = history.length;
  if (len >= 2 && history[len - 1] === history[len - 2]) {
    speed = history[len - 1] === "slow" ? "fast" : "slow";
  } else if (len >= 1) {
    // Weighted probability: if the last round was fast, weight towards slow (e.g. 70% chance of slow), and vice versa
    const last = history[len - 1];
    const threshold = last === "fast" ? 0.7 : 0.3;
    speed = rng() < threshold ? "slow" : "fast";
  } else {
    speed = rng() < 0.5 ? "fast" : "slow";
  }

  let bpm: number;
  let slowMax = 90;
  let fastMin = 150;
  let maxBpm = 170;
  let minBpm = 70;
  if (d === "medium") {
    slowMax = 95;
    fastMin = 145;
    minBpm = 75;
    maxBpm = 165;
  } else if (d === "hard") {
    slowMax = 100;
    fastMin = 140;
    minBpm = 80;
    maxBpm = 160;
  }

  if (speed === "fast") {
    bpm = Math.floor(fastMin + rng() * (maxBpm - fastMin + 1));
  } else {
    bpm = Math.floor(minBpm + rng() * (slowMax - minBpm + 1));
  }

  const melodyIndex = Math.floor(rng() * MELODIES.length);
  const baseMelody = MELODIES[melodyIndex];
  const transpose = Math.floor(rng() * 13) - 6;
  const notes = baseMelody.map((n) => ({ ...n, m: n.m + transpose }));

  return { notes, bpm };
}

function speedOf(bpm: number): "fast" | "slow" {
  return bpm >= FAST_BPM_MIN ? "fast" : "slow";
}

export function isCorrect(
  round: FastSlowRound,
  picked: "fast" | "slow",
): boolean {
  return picked === getActualSpeed(round);
}

export function getActualSpeed(round: FastSlowRound): "fast" | "slow" {
  return speedOf(round.bpm);
}

/** Voice-clip contract: every spoken line, all langs. */
export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, "shell.fastslow.sub"));
    out.push(t(l.id, "music.listen"));
    out.push(t(l.id, "music.fast"));
    out.push(t(l.id, "music.slow"));
  }
  return [...new Set(out)];
}
