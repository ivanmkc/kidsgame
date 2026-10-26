import { Rng, randInt } from "../../rng";
import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";

const PENTATONIC = [60, 62, 64, 67, 69]; // C D E G A (C major pentatonic)
const BELL_COLORS = ["#E8564F", "#FFC24B", "#5FBF6E", "#2FB8AC", "#9B7EDE"];

const BELL_NAMES: Record<Lang, string> = {
  en: "Bell",
  ja: "ベル",
  cmn: "铃铛",
  yue: "鈴鐺",
};

export function bellLabel(index: number, lang: Lang): string {
  const name = BELL_NAMES[lang] ?? BELL_NAMES.en;
  return `${name} ${index + 1}`;
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

export function makeBellsRound(rng: Rng, d: Difficulty): BellsRound {
  const n = bellCount(d);
  const len = seqLength(d);
  const bells: Bell[] = [];
  for (let i = 0; i < n; i++) {
    bells.push({ midi: PENTATONIC[i], color: BELL_COLORS[i] });
  }
  const sequence: number[] = [];
  for (let i = 0; i < len; i++) {
    sequence.push(randInt(rng, n));
  }
  return { bells, sequence };
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
  return [];
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
