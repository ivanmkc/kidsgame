import { Rng, randInt } from "../../rng";
import { Difficulty } from "../../difficulty";
import { LANGS, Lang } from "../../lang";
import { t } from "../../i18n";

export interface SteadyBeatRound {
  bpm: number;
  beatsPerRound: number;
}

function bpmRange(d: Difficulty): [number, number] {
  if (d === "easy") return [80, 100];
  if (d === "medium") return [70, 110];
  return [60, 120];
}

export function windowMs(d: Difficulty): number {
  if (d === "easy") return 250;
  if (d === "medium") return 180;
  return 120;
}

export function roundsToWin(d: Difficulty): number {
  if (d === "easy") return 4;
  if (d === "medium") return 5;
  return 6;
}

export function makeSteadyBeatRound(rng: Rng, d: Difficulty): SteadyBeatRound {
  const [lo, hi] = bpmRange(d);
  const bpm = lo + randInt(rng, hi - lo + 1);
  return { bpm, beatsPerRound: 8 };
}

export function scoreTaps(
  round: SteadyBeatRound,
  tapTimesMs: number[],
  startMs: number,
  d: Difficulty,
): { hits: number; total: number } {
  const beatMs = 60000 / round.bpm;
  const win = windowMs(d);
  let hits = 0;
  const beatTimes: number[] = [];
  for (let i = 0; i < round.beatsPerRound; i++) {
    beatTimes.push(startMs + i * beatMs);
  }
  const used = new Set<number>();
  for (const tap of tapTimesMs) {
    for (let b = 0; b < beatTimes.length; b++) {
      if (used.has(b)) continue;
      if (Math.abs(tap - beatTimes[b]) <= win) {
        hits++;
        used.add(b);
        break;
      }
    }
  }
  const extraTaps = Math.max(0, tapTimesMs.length - round.beatsPerRound);
  hits = Math.max(0, hits - extraTaps);
  return { hits, total: round.beatsPerRound };
}

export function passThreshold(d: Difficulty): number {
  if (d === "easy") return 0.5;
  if (d === "medium") return 0.625;
  return 0.75;
}

export type RhythmEvaluation = "fast" | "slow" | "listen";

export function evaluateRhythm(
  round: SteadyBeatRound,
  tapTimesMs: number[],
): RhythmEvaluation {
  const minTaps = Math.ceil(round.beatsPerRound / 2);
  if (tapTimesMs.length < minTaps) return "listen";
  const targetBeatMs = 60000 / round.bpm;
  let totalInterval = 0;
  for (let i = 1; i < tapTimesMs.length; i++) {
    totalInterval += tapTimesMs[i] - tapTimesMs[i - 1];
  }
  const avgInterval = totalInterval / (tapTimesMs.length - 1);
  const tolerance = targetBeatMs * 0.15;
  if (avgInterval < targetBeatMs - tolerance) return "fast";
  if (avgInterval > targetBeatMs + tolerance) return "slow";
  return "listen";
}

export function getInstructionalFeedback(
  round: SteadyBeatRound,
  lang: Lang,
  tapTimesMs?: number[],
): string[] {
  const rhythm = tapTimesMs ? evaluateRhythm(round, tapTimesMs) : "listen";
  if (rhythm === "fast") {
    return [t(lang, "music.fast"), t(lang, "music.listen")];
  }
  if (rhythm === "slow") {
    return [t(lang, "music.slow"), t(lang, "music.listen")];
  }
  return [t(lang, "music.listen")];
}

/** Voice-clip contract: every spoken line, all langs. */
export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, "shell.steadybeat.sub"));
    out.push(t(l.id, "music.yourTurn"));
    out.push(t(l.id, "music.listen"));
    out.push(t(l.id, "music.fast"));
    out.push(t(l.id, "music.slow"));
  }
  return [...new Set(out)];
}
