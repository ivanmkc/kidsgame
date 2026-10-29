import { Rng, randInt } from "../../rng";
import { Difficulty } from "../../difficulty";
import { LANGS, Lang } from "../../lang";
import { t } from "../../i18n";

export interface HighLowRound {
  noteA: number; // midi — played first
  noteB: number; // midi — played second
}

const BASE_MIDI = 60; // middle C

function intervalFor(d: Difficulty): number {
  if (d === "easy") return 12;
  if (d === "medium") return 7;
  return 3;
}

export function roundsToWin(d: Difficulty): number {
  if (d === "easy") return 8;
  if (d === "medium") return 10;
  return 12;
}

/** The kid hears note A then note B and taps ↗️ HIGHER or ↘️ LOWER for where
 *  the SECOND note landed. The answer must therefore fall out of the two
 *  notes — never a coin flip, or the round is unwinnable by listening. */
export function makeHighLowRound(rng: Rng, d: Difficulty): HighLowRound {
  const interval = intervalFor(d);
  const base = BASE_MIDI + randInt(rng, 13) - 6;
  const secondIsHigher = rng() < 0.5;
  const noteA = secondIsHigher ? base : base + interval;
  const noteB = secondIsHigher ? base + interval : base;
  return { noteA, noteB };
}

/** Derived from the notes, so a hand-built round can't disagree with what
 *  the ears heard. */
export function correctAnswer(round: HighLowRound): "high" | "low" {
  return round.noteB > round.noteA ? "high" : "low";
}

export function isCorrect(
  round: HighLowRound,
  picked: "high" | "low",
): boolean {
  return picked === correctAnswer(round);
}

export const MELODY_DOT_OFFSET_Y = 20;

/** Vertical offset for visual pitch representation. Higher pitch shifts up
 *  (-Y), lower pitch shifts down (+Y), giving children playing with sound muted
 *  an unambiguous visual cue matching the heard contour. */
export function melodyDotOffsetY(round: HighLowRound, index: number): number {
  const note = index === 0 ? round.noteA : round.noteB;
  const other = index === 0 ? round.noteB : round.noteA;
  if (note > other) return -MELODY_DOT_OFFSET_Y;
  if (note < other) return MELODY_DOT_OFFSET_Y;
  return 0;
}

export function getInstructionalFeedback(
  round: HighLowRound,
  lang: Lang,
): string[] {
  const answer = correctAnswer(round);
  const dirKey = answer === "high" ? "music.high" : "music.low";
  return [t(lang, dirKey), t(lang, "music.listen")];
}

export function nextScoreValue(currentScore: number): number {
  return currentScore + 1;
}

export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, "shell.highlow.sub"));
    out.push(t(l.id, "music.listen"));
    out.push(t(l.id, "music.high"));
    out.push(t(l.id, "music.low"));
  }
  return [...new Set(out)];
}

export interface HighLowLayout {
  gap: number;
  pickBtnPaddingHorizontal: number;
  pickBtnMinWidth: number;
  replaySize: number;
  replayFontSize: number;
  pickLabelFontSize: number;
}

export function highLowLayout(width: number): HighLowLayout {
  if (width > 0 && width < 430) {
    return {
      gap: 10,
      pickBtnPaddingHorizontal: 8,
      pickBtnMinWidth: 96,
      replaySize: 56,
      replayFontSize: 28,
      pickLabelFontSize: 16,
    };
  }
  return {
    gap: 12,
    pickBtnPaddingHorizontal: 16,
    pickBtnMinWidth: 130,
    replaySize: 72,
    replayFontSize: 36,
    pickLabelFontSize: 22,
  };
}
