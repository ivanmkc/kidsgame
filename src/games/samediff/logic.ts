import { Rng, randInt } from "../../rng";
import { Difficulty } from "../../difficulty";
import { SeqNote } from "../../music";
import { LANGS, Lang } from "../../lang";
import { t } from "../../i18n";

export const BASE_PHRASES: SeqNote[][] = [
  [
    { m: 60, b: 1 },
    { m: 64, b: 1 },
    { m: 67, b: 1 },
  ], // C E G
  [
    { m: 62, b: 1 },
    { m: 65, b: 1 },
    { m: 69, b: 1 },
  ], // D F A
  [
    { m: 64, b: 1 },
    { m: 67, b: 1 },
    { m: 72, b: 1 },
  ], // E G C'
  [
    { m: 65, b: 1 },
    { m: 69, b: 1 },
    { m: 72, b: 1 },
  ], // F A C'
  [
    { m: 67, b: 1 },
    { m: 72, b: 1 },
    { m: 76, b: 1 },
  ], // G C' E'
  [
    { m: 57, b: 1 },
    { m: 60, b: 1 },
    { m: 64, b: 1 },
  ], // A C E
  [
    { m: 59, b: 1 },
    { m: 62, b: 1 },
    { m: 67, b: 1 },
  ], // B D G
  [
    { m: 60, b: 1 },
    { m: 65, b: 1 },
    { m: 69, b: 1 },
  ], // C F A
  [
    { m: 62, b: 1 },
    { m: 67, b: 1 },
    { m: 71, b: 1 },
  ], // D G B
  [
    { m: 64, b: 1 },
    { m: 69, b: 1 },
    { m: 72, b: 1 },
  ], // E A C'
  [
    { m: 65, b: 1 },
    { m: 69, b: 1 },
    { m: 74, b: 1 },
  ], // F A D'
  [
    { m: 67, b: 1 },
    { m: 71, b: 1 },
    { m: 74, b: 1 },
  ], // G B D'
  [
    { m: 69, b: 1 },
    { m: 72, b: 1 },
    { m: 76, b: 1 },
  ], // A C' E'
  [
    { m: 71, b: 1 },
    { m: 74, b: 1 },
    { m: 79, b: 1 },
  ], // B D' G'
  [
    { m: 72, b: 1 },
    { m: 76, b: 1 },
    { m: 79, b: 1 },
  ], // C' E' G'
  [
    { m: 60, b: 1 },
    { m: 67, b: 1 },
    { m: 72, b: 1 },
  ], // C G C'
];

export interface SameDiffRound {
  phraseA: SeqNote[];
  phraseB: SeqNote[];
  answer: "same" | "different";
  phraseIdx: number;
}

function stepSize(d: Difficulty): number {
  if (d === "easy") return 4;
  if (d === "medium") return 2;
  return 1;
}

export function roundsToWin(d: Difficulty): number {
  if (d === "easy") return 8;
  if (d === "medium") return 10;
  return 12;
}

export function makeSameDiffRound(
  rng: Rng,
  d: Difficulty,
  history: number[] = [],
): SameDiffRound {
  const allIndices = BASE_PHRASES.map((_, i) => i);
  const cycleLength = BASE_PHRASES.length;
  const currentPass = history.slice(
    Math.floor(history.length / cycleLength) * cycleLength,
  );
  let available = allIndices.filter((i) => !currentPass.includes(i));
  if (history.length > 0) {
    const last = history[history.length - 1];
    available = available.filter((i) => i !== last);
  }
  if (available.length === 0) {
    const last = history.length > 0 ? history[history.length - 1] : undefined;
    available = allIndices.filter((i) => i !== last);
    if (available.length === 0) available = allIndices;
  }
  const phraseIdx = available[randInt(rng, available.length)];
  const phraseA = BASE_PHRASES[phraseIdx].map((n) => ({ ...n }));
  const isSame = rng() < 0.5;
  if (isSame) {
    return {
      phraseA,
      phraseB: phraseA.map((n) => ({ ...n })),
      answer: "same",
      phraseIdx,
    };
  }
  const phraseB = phraseA.map((n) => ({ ...n }));
  const changeIdx = randInt(rng, phraseB.length);
  const dir = rng() < 0.5 ? 1 : -1;
  phraseB[changeIdx] = {
    ...phraseB[changeIdx],
    m: phraseB[changeIdx].m + dir * stepSize(d),
  };
  return { phraseA, phraseB, answer: "different", phraseIdx };
}

export function isCorrect(
  round: SameDiffRound,
  picked: "same" | "different",
): boolean {
  return picked === round.answer;
}

/**
 * Compute normalized pitch positions [0..1] for a phrase given the round's min and max MIDI pitches.
 * Returns 0.5 if all notes in the round have identical pitch.
 */
export function phrasePitchRatios(
  round: SameDiffRound,
  phrase: SeqNote[],
): number[] {
  const allNotes = [...round.phraseA, ...round.phraseB];
  let minM = allNotes[0]?.m ?? 60;
  let maxM = minM;
  for (const n of allNotes) {
    if (n.m < minM) minM = n.m;
    if (n.m > maxM) maxM = n.m;
  }
  if (maxM === minM) {
    return phrase.map(() => 0.5);
  }
  return phrase.map((n) => (n.m - minM) / (maxM - minM));
}

export function getInstructionalFeedback(
  round: SameDiffRound,
  lang: Lang,
): string[] {
  const answerKey = round.answer === "same" ? "music.same" : "music.different";
  return [t(lang, answerKey)];
}

export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, "shell.samediff.sub"));
    out.push(t(l.id, "music.listen"));
    out.push(t(l.id, "music.same"));
    out.push(t(l.id, "music.different"));
  }
  return [...new Set(out)];
}
