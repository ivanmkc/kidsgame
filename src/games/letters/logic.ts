// Letter Hunt round builder. Three EN tiers (upper / mixed case / sound
// mode) + a JA kana hunt. Distractors bias toward visually confusable
// shapes on M/H so the game teaches discrimination — but sound-mode picks
// letters with UNIQUE sounds so a single prompt has one answer.
import { Lang } from '../../lang';
import { Rng, shuffle } from '../../rng';
import { RHYME_WORDS, WORDS } from '../language/words';

export type LetterTier = 'upper' | 'mixed' | 'sound' | 'kana';

export interface LetterTile {
  key: string;
  label: string;
  isAnswer: boolean;
}

export interface LetterRound {
  tier: LetterTier;
  targetKey: string;      // stable key for avoid-repeat + testIDs
  targetDisplay: string;  // shown in the prompt card
  promptLine: string;     // EXACT string spoken (byte-identical to speechLines())
  romanCaption?: string;  // JA romaji caption for parents
  tiles: LetterTile[];
  answerIdx: number;
}

export interface LetterSettings {
  rounds: number;
  tiles: number;
  tier: LetterTier;
}

export function settingsForLetters(
  difficulty: 'easy' | 'medium' | 'hard',
  lang: Lang,
): LetterSettings {
  if (lang === 'ja') {
    // JA kana hunt: same round curve, but tier is always kana.
    if (difficulty === 'easy') return { rounds: 8, tiles: 6, tier: 'kana' };
    if (difficulty === 'hard') return { rounds: 12, tiles: 8, tier: 'kana' };
    return { rounds: 10, tiles: 8, tier: 'kana' };
  }
  if (difficulty === 'easy') return { rounds: 8, tiles: 6, tier: 'upper' };
  if (difficulty === 'hard') return { rounds: 12, tiles: 8, tier: 'sound' };
  return { rounds: 10, tiles: 8, tier: 'mixed' };
}

const ALL_LETTERS: string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

// Shape-confusable groups — used as distractor bias on M and as the
// forbidden set on E (E asks for visually DISSIMILAR distractors).
export const LETTER_CONFUSABLES: string[][] = [
  ['E', 'F'],
  ['B', 'P', 'R'],
  ['O', 'Q', 'C'],
  ['M', 'N', 'W'],
  ['I', 'L', 'J'],
  ['U', 'V'],
];

function confusableGroup(letter: string): string[] {
  return LETTER_CONFUSABLES.find((g) => g.includes(letter)) ?? [];
}

// Dedup (letter, sound) pairs so each SOUND maps to exactly one letter —
// otherwise "Which letter says kuh?" has two right answers (C and K).
export const LETTER_SOUNDS: { letter: string; sound: string }[] = (() => {
  const seenSound = new Set<string>();
  const out: { letter: string; sound: string }[] = [];
  for (const w of [...WORDS, ...RHYME_WORDS]) {
    if (!seenSound.has(w.sound)) {
      seenSound.add(w.sound);
      out.push({ letter: w.letter, sound: w.sound });
    }
  }
  return out;
})();

// JA hiragana pool (25 gojūon rows A–NO) + romaji captions for parents.
export const KANA_POOL: { kana: string; romaji: string }[] = [
  { kana: 'あ', romaji: 'a' }, { kana: 'い', romaji: 'i' }, { kana: 'う', romaji: 'u' }, { kana: 'え', romaji: 'e' }, { kana: 'お', romaji: 'o' },
  { kana: 'か', romaji: 'ka' }, { kana: 'き', romaji: 'ki' }, { kana: 'く', romaji: 'ku' }, { kana: 'け', romaji: 'ke' }, { kana: 'こ', romaji: 'ko' },
  { kana: 'さ', romaji: 'sa' }, { kana: 'し', romaji: 'shi' }, { kana: 'す', romaji: 'su' }, { kana: 'せ', romaji: 'se' }, { kana: 'そ', romaji: 'so' },
  { kana: 'た', romaji: 'ta' }, { kana: 'ち', romaji: 'chi' }, { kana: 'つ', romaji: 'tsu' }, { kana: 'て', romaji: 'te' }, { kana: 'と', romaji: 'to' },
  { kana: 'な', romaji: 'na' }, { kana: 'に', romaji: 'ni' }, { kana: 'ぬ', romaji: 'nu' }, { kana: 'ね', romaji: 'ne' }, { kana: 'の', romaji: 'no' },
];

function pickIndex(rng: Rng, n: number): number { return Math.floor(rng() * n); }

export function makeLetterRound(
  rng: Rng, tier: LetterTier, tileCount: number, avoidKey?: string,
): LetterRound {
  if (tier === 'kana') {
    const candidates = KANA_POOL.filter((k) => k.kana !== avoidKey);
    const target = candidates[pickIndex(rng, candidates.length)];
    const distractors = shuffle(rng, KANA_POOL.filter((k) => k.kana !== target.kana)).slice(0, tileCount - 1);
    const tiles: LetterTile[] = shuffle(rng, [
      { key: target.kana, label: target.kana, isAnswer: true },
      ...distractors.map((d) => ({ key: d.kana, label: d.kana, isAnswer: false })),
    ]);
    return {
      tier, targetKey: target.kana, targetDisplay: target.kana,
      promptLine: `「${target.kana}」をさがして！`, romanCaption: target.romaji,
      tiles, answerIdx: tiles.findIndex((t) => t.isAnswer),
    };
  }

  if (tier === 'sound') {
    const candidates = LETTER_SOUNDS.filter((s) => s.letter !== avoidKey);
    const target = candidates[pickIndex(rng, candidates.length)];
    // Distractors: other letters with DIFFERENT sounds so exactly one tile
    // answers "Which letter says X?".
    const others = LETTER_SOUNDS.filter((s) => s.letter !== target.letter);
    const distractors = shuffle(rng, others).slice(0, tileCount - 1);
    const tiles: LetterTile[] = shuffle(rng, [
      { key: target.letter, label: target.letter, isAnswer: true },
      ...distractors.map((d) => ({ key: d.letter, label: d.letter, isAnswer: false })),
    ]);
    return {
      tier, targetKey: target.letter, targetDisplay: target.letter,
      promptLine: `Which letter says ${target.sound}?`,
      tiles, answerIdx: tiles.findIndex((t) => t.isAnswer),
    };
  }

  // upper / mixed
  const upperCands = ALL_LETTERS.filter((L) => L !== avoidKey);
  const targetLetter = upperCands[pickIndex(rng, upperCands.length)];
  const useLower = tier === 'mixed' && rng() < 0.5;
  const displayed = useLower ? targetLetter.toLowerCase() : targetLetter;
  const key = displayed;

  const forbidden = new Set(confusableGroup(targetLetter));
  const otherLetters = ALL_LETTERS.filter((L) => L !== targetLetter);
  const easyPool = otherLetters.filter((L) => !forbidden.has(L));
  const confusablePool = otherLetters.filter((L) => forbidden.has(L));

  let distractorLetters: string[];
  if (tier === 'upper') {
    // E tier: dissimilar shapes; skip the confusable group entirely.
    distractorLetters = shuffle(rng, easyPool).slice(0, tileCount - 1);
  } else {
    // M tier: prefer confusables so the game teaches shape discrimination.
    distractorLetters = [
      ...shuffle(rng, confusablePool),
      ...shuffle(rng, easyPool),
    ].slice(0, tileCount - 1);
  }

  const tiles: LetterTile[] = shuffle(rng, [
    { key, label: displayed, isAnswer: true },
    ...distractorLetters.map((L) => {
      const lower = tier === 'mixed' && rng() < 0.5;
      const lbl = lower ? L.toLowerCase() : L;
      return { key: lbl, label: lbl, isAnswer: false };
    }),
  ]);

  return {
    tier, targetKey: key, targetDisplay: displayed,
    promptLine: `Find the letter ${targetLetter}!`,
    tiles, answerIdx: tiles.findIndex((t) => t.isAnswer),
  };
}

// Every string a Letters round could ever speak — the offline TTS
// pipeline pre-renders these; runtime must match byte-for-byte.
export function speechLines(): string[] {
  const lines = new Set<string>();
  // upper + mixed prompts speak the LETTER NAME (case-agnostic).
  for (const L of ALL_LETTERS) lines.add(`Find the letter ${L}!`);
  // sound-mode prompts, one per unique sound.
  for (const s of LETTER_SOUNDS) lines.add(`Which letter says ${s.sound}?`);
  // kana prompts, one per hiragana in the pool.
  for (const k of KANA_POOL) lines.add(`「${k.kana}」をさがして！`);
  return [...lines];
}
