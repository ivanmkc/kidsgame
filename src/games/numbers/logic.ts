// Number Hunt round builder. EN speaks one line ("Find the number 5!");
// JA/cmn/yue speak two ("さがしてね！" then the number word) so each spoken
// asset stays short and reusable. Hard tier in JA/zh swaps arabic tiles
// for han numerals (一..十) with numbers 1-10.
import { HAN_NUMERALS, Lang, numberWord } from '../../lang';
import { Rng, shuffle } from '../../rng';

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

// Wording for the second (or first) spoken line in non-EN modes; kept
// short so the offline TTS clip stays tiny + snappy.
const FIND_WORD: Record<Lang, string> = {
  en: '',                 // EN speaks a single "Find the number N!" line instead
  ja: 'さがしてね！',
  cmn: '找一找！',
  yue: '搵一搵！',
};

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
  if (difficulty === 'easy')   return { rounds: 8,  tiles: 5, min, max: 5,  useHan: false };
  if (difficulty === 'hard')   return { rounds: 12, tiles: 9, min: useHan ? 1 : min, max: 20, useHan };
  return                              { rounds: 10, tiles: 7, min, max: 9,  useHan: false };
}

export function hanNumeral(n: number): string {
  if (n <= 10) return HAN_NUMERALS[n - 1] ?? String(n);
  if (n < 20) return `十${HAN_NUMERALS[n - 11]}`;
  if (n === 20) return '二十';
  return String(n);
}

function label(n: number, useHan: boolean): string {
  return useHan ? hanNumeral(n) : String(n);
}

function tileFor(n: number, useHan: boolean, isAnswer: boolean): NumberTile {
  return { key: `${useHan ? 'h' : 'n'}-${n}`, label: label(n, useHan), n, isAnswer };
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
  const displayText = label(targetN, useHan);
  let promptLines: string[];
  if (lang === 'en') {
    promptLines = [`Find the number ${targetN}!`];
  } else {
    promptLines = [FIND_WORD[lang], numberWord(lang, targetN).t];
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
  for (let n = 0; n <= 20; n++) s.add(`Find the number ${n}!`);
  // Non-EN: the "find" word plus every localized number that could appear
  // as a target (E/M go up to 9, H (han) tier up to 10).
  for (const lang of ['ja', 'cmn', 'yue'] as const) {
    s.add(FIND_WORD[lang]);
    for (let n = 1; n <= 10; n++) s.add(numberWord(lang, n).t);
  }
  return [...s];
}
