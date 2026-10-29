import { hanNumeral, Lang, numberWord } from '../../lang';
import { t } from '../../i18n';
import { Rng, shuffle } from '../../rng';
import { CURRICULUM } from '../../curriculum/content';

export interface NumberTile {
  key: string;
  label: string;
  n: number;
  isAnswer: boolean;
}

export interface NumberRound {
  targetN: number;
  targetKey: string;      // stable id incl. tier (arabic vs han)
  useHan: boolean;
  promptLines: string[];  // spoken via saySequence — every entry must appear in speechLines()
  displayText: string;    // what the prompt card shows on screen
  tiles: NumberTile[];
  answerIdx: number;
}

export interface NumberSettings {
  rounds: number;
  tiles: number;
  min: number;   // inclusive
  max: number;   // inclusive
  useHan: boolean;
}

export function settingsForNumbers(
  difficulty: 'easy' | 'medium' | 'hard', lang: Lang,
  script: 'arabic' | 'han' | 'auto' = 'auto',
): NumberSettings {
  // Ivan: script must be a player choice in ja/cmn/yue, not hard-tier-only.
  const useHan = lang !== 'en' && (script === 'han' || (script === 'auto' && difficulty === 'hard'));
  // Non-EN skips 0 — the number tables in lang.ts start at 1, so speaking
  // "0" would fall back to raw arabic.
  const min = lang === 'en' ? 0 : 1;
  const settings = CURRICULUM.numbers.numbers[difficulty];
  return { ...settings, min: useHan ? 1 : min, useHan };
}

function label(n: number, useHan: boolean): string {
  return useHan ? hanNumeral(n) : String(n);
}

function tileFor(n: number, useHan: boolean, isAnswer: boolean): NumberTile {
  return { key: `${useHan ? 'h' : 'n'}-${n}`, label: label(n, useHan), n, isAnswer };
}

export function reskinNumberRound(round: NumberRound, useHan: boolean): NumberRound {
  if (round.useHan === useHan) return round;
  const tiles = round.tiles.map((t) => tileFor(t.n, useHan, t.isAnswer));
  const targetTile = tiles.find((t) => t.isAnswer);
  return {
    ...round,
    useHan,
    targetKey: targetTile?.key ?? `${useHan ? 'h' : 'n'}-${round.targetN}`,
    displayText: label(round.targetN, false),
    tiles,
  };
}

export function makeNumberRound(
  rng: Rng, settings: NumberSettings, lang: Lang, avoidN?: number,
): NumberRound {
  const { min, max, tiles: tileCount, useHan } = settings;
  const pool: number[] = [];
  for (let n = min; n <= max; n++) pool.push(n);

  const candidates = pool.filter((n) => n !== avoidN);
  const targetN = candidates[Math.floor(rng() * candidates.length)];
  const others = pool.filter((n) => n !== targetN);
  const distractors = shuffle(rng, others).slice(0, Math.min(tileCount - 1, others.length));

  const tiles: NumberTile[] = shuffle(rng, [
    tileFor(targetN, useHan, true),
    ...distractors.map((n) => tileFor(n, useHan, false)),
  ]);

  const targetKey = tiles.find((t) => t.isAnswer)!.key;
  const displayText = label(targetN, false);
  let promptLines: string[];
  if (lang === 'en') {
    promptLines = [t(lang, 'numbers.findNumber', { n: targetN })];
  } else {
    promptLines = [t(lang, 'numbers.find'), numberWord(lang, targetN).t];
  }
  return {
    targetN, targetKey, useHan, promptLines, displayText,
    tiles, answerIdx: tiles.findIndex((t) => t.isAnswer),
  };
}

// All possible spoken lines across every lang + tier — the offline TTS
// pipeline pre-renders these so playback is instant.
export function speechLines(): string[] {
  const s = new Set<string>();
  // EN: 0..20 covers the widest tier.
  const langEn: Lang = 'en';
  for (let n = 0; n <= 20; n++) s.add(t(langEn, 'numbers.findNumber', { n }));
  // Non-EN: the "find" word plus every localized number that could appear
  // as a target (E/M go up to 9, H tier up to 20).
  for (const lang of ['ja', 'cmn', 'yue'] as const) {
    s.add(t(lang, 'numbers.find'));
    for (let n = 1; n <= 20; n++) s.add(numberWord(lang, n).t);
  }
  return [...s];
}
