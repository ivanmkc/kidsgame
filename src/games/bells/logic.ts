import { Rng, randInt } from "../../rng";
import { Difficulty } from "../../difficulty";
import { Lang, LANGS } from "../../lang";
import { t } from "../../i18n";

const PENTATONIC = [60, 62, 64, 67, 69]; // C D E G A (C major pentatonic)
const BELL_COLORS = ["#E8564F", "#FFC24B", "#5FBF6E", "#2FB8AC", "#9B7EDE"];

export function bellLabel(index: number, lang: Lang): string {
  return `${t(lang, "bells.bell")} ${index + 1}`;
}

export interface Bell {
  midi: number;
  color: string;
}

export interface BellsRound {
  bells: Bell[];
  sequence: number[]; // indices into bells[]
}

function bellCount(d: Difficulty): number {
  if (d === "easy") return 3;
  if (d === "medium") return 4;
  return 5;
}

export function seqLength(d: Difficulty): number {
  if (d === "easy") return 2;
  if (d === "medium") return 3;
  return 5;
}

export function roundsToWin(d: Difficulty): number {
  if (d === "easy") return 5;
  if (d === "medium") return 6;
  return 8;
}

function isValidSequence(seq: number[]): boolean {
  if (seq.length < 2) return true;
  let allSame = true;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] !== seq[0]) {
      allSame = false;
      break;
    }
  }
  if (allSame) return false;

  for (let i = 2; i < seq.length; i++) {
    if (seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) {
      return false;
    }
  }
  return true;
}

export function makeBellsRound(
  rng: Rng,
  d: Difficulty,
  previousSequence?: number[],
): BellsRound {
  const n = bellCount(d);
  const len = seqLength(d);
  const bells: Bell[] = [];
  for (let i = 0; i < n; i++) {
    bells.push({ midi: PENTATONIC[i], color: BELL_COLORS[i] });
  }
  let sequence: number[];
  do {
    sequence = [];
    if (d === "easy") {
      const isAscending = randInt(rng, 2) === 0;
      if (isAscending) {
        const start = randInt(rng, n - 1);
        sequence.push(start, start + 1);
      } else {
        const start = randInt(rng, n - 1) + 1;
        sequence.push(start, start - 1);
      }
    } else {
      for (let i = 0; i < len; i++) {
        sequence.push(randInt(rng, n));
      }
    }
  } while (
    (previousSequence && sequencesMatch(sequence, previousSequence)) ||
    !isValidSequence(sequence)
  );
  return { bells, sequence };
}

function sequencesMatch(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export type TapResult = "continue" | "complete" | "wrong";

export function judgeTap(
  round: BellsRound,
  tapped: number[],
  bell: number,
): TapResult {
  const step = tapped.length;
  if (step >= round.sequence.length || round.sequence[step] !== bell) {
    return "wrong";
  }
  if (step + 1 === round.sequence.length) {
    return "complete";
  }
  return "continue";
}

export type BellsPhase = "listen" | "play";

export function canTap(
  round: BellsRound,
  tapped: number[],
  phase: BellsPhase,
  won = false,
  flashing = false,
): boolean {
  if (won || flashing || phase !== "play") return false;
  return tapped.length < round.sequence.length;
}

export function speechLines(): string[] {
  return LANGS.map((l) => t(l.id, "shell.bells.sub"));
}

export interface BellsLayout {
  bellSize: number;
  gap: number;
  isLandscape: boolean;
  shortH: boolean;
}

export function bellsLayout(
  width: number,
  height: number,
  bellCount = 5,
): BellsLayout {
  const isLandscape = width > height;
  const shortH = isLandscape && height < 500;
  const gap = shortH ? (height < 360 ? 8 : 12) : 28;

  const maxBellByWidth =
    (Math.min(width - 40, 600) - (bellCount - 1) * 14) / bellCount;

  const maxBellByHeight = shortH ? Math.floor((height - 84) * 0.3) : 110;

  const bellSize = Math.max(44, Math.min(110, maxBellByWidth, maxBellByHeight));

  return { bellSize, gap, isLandscape, shortH };
}
