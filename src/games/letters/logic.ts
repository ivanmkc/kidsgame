// Letter Hunt round builder. Three EN tiers (upper / mixed case / sound
// mode) + a JA kana hunt. Distractors bias toward visually confusable
// shapes on M/H so the game teaches discrimination — but sound-mode picks
// letters with UNIQUE sounds so a single prompt has one answer.
import { t } from '../../i18n';
import { Lang } from '../../lang';
import { Rng, shuffle } from '../../rng';
import { RHYME_WORDS, WORDS } from '../../curriculum/words';

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
    // JA kana hunt: 6 tiles (easy, dissimilar), 8 tiles (medium, confusables),
    // 12 tiles (hard, high density 4x3 grid with confusable discrimination).
    if (difficulty === 'easy') return { rounds: 8, tiles: 6, tier: 'kana' };
    if (difficulty === 'hard') return { rounds: 12, tiles: 12, tier: 'kana' };
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

// Visually confusable kana groups — used as distractor bias on M/H and
// forbidden on E (dissimilar distractors).
export const KANA_CONFUSABLES: string[][] = [
  ['さ', 'ち', 'き'], // mirror symmetry (さ/ち) & crossbar count (さ/き)
  ['ぬ', 'ね'],       // looped right stem
  ['あ', 'お'],       // round body + cross
  ['い', 'こ'],       // parallel curved strokes
  ['け', 'に'],       // vertical stem + right hooks
  ['た', 'な'],       // cross stem + right marks
];

export function kanaConfusableGroup(kana: string): string[] {
  return KANA_CONFUSABLES.find((g) => g.includes(kana)) ?? [];
}

// Labels that render as the SAME glyph in the display face (Baloo 2):
// capital I and lowercase l are both a bare vertical bar. Shape-confusable
// letters are the point of the mixed tier, but two tiles a kid cannot tell
// apart are not a lesson — one of them is simply wrong for no readable
// reason. Keyed by label (case matters), not by letter.
const GLYPH_TWINS: Record<string, string[]> = {
  I: ['l'],
  l: ['I'],
};

/** Labels indistinguishable from `label` when drawn on a tile. */
export function glyphTwinsOf(label: string): string[] {
  return GLYPH_TWINS[label] ?? [];
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
  rng: Rng,
  tier: LetterTier,
  tileCount: number,
  avoidKey?: string,
  lang: Lang = tier === 'kana' ? 'ja' : 'en',
): LetterRound {
  if (tier === 'kana') {
    const candidates = KANA_POOL.filter((k) => k.kana !== avoidKey);
    const confusableCandidates = candidates.filter(
      (k) => kanaConfusableGroup(k.kana).length > 0,
    );
    // Hard mode (tileCount >= 10): prioritize confusable targets to test shape discrimination.
    const targetPool =
      tileCount >= 10 && confusableCandidates.length > 0 && rng() < 0.75
        ? confusableCandidates
        : candidates;
    const target = targetPool[pickIndex(rng, targetPool.length)];

    const forbidden = new Set(kanaConfusableGroup(target.kana));
    const otherKana = KANA_POOL.filter((k) => k.kana !== target.kana);
    const easyPool = otherKana.filter((k) => !forbidden.has(k.kana));
    const confusablePool = otherKana.filter((k) => forbidden.has(k.kana));

    let distractorKana: { kana: string; romaji: string }[];
    if (tileCount <= 6) {
      // E tier: dissimilar shapes; skip the confusable group entirely.
      distractorKana = shuffle(rng, easyPool).slice(0, tileCount - 1);
    } else {
      // M/H tiers: prefer confusables so the game teaches shape discrimination.
      distractorKana = [
        ...shuffle(rng, confusablePool),
        ...shuffle(rng, easyPool),
      ].slice(0, tileCount - 1);
    }

    const tiles: LetterTile[] = shuffle(rng, [
      { key: target.kana, label: target.kana, isAnswer: true },
      ...distractorKana.map((d) => ({ key: d.kana, label: d.kana, isAnswer: false })),
    ]);
    return {
      tier, targetKey: target.kana, targetDisplay: target.kana,
      promptLine: t(lang, 'letters.findKana', { kana: target.kana }),
      romanCaption: target.romaji,
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
      promptLine: t(lang, 'letters.sound', { sound: target.sound }),
      tiles, answerIdx: tiles.findIndex((t) => t.isAnswer),
    };
  }

  // upper / mixed
  const upperCands = ALL_LETTERS.filter((L) => L !== avoidKey?.toUpperCase());
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

  // Mixed tier draws each distractor's case at random; flip that coin back
  // if it would render a look-alike glyph (I vs l) already on the board.
  const usedLabels = new Set<string>([displayed]);
  const tiles: LetterTile[] = shuffle(rng, [
    { key, label: displayed, isAnswer: true },
    ...distractorLetters.map((L) => {
      const lower = tier === 'mixed' && rng() < 0.5;
      let lbl = lower ? L.toLowerCase() : L;
      if (glyphTwinsOf(lbl).some((twin) => usedLabels.has(twin))) {
        lbl = lower ? L : L.toLowerCase();
      }
      usedLabels.add(lbl);
      return { key: lbl, label: lbl, isAnswer: false };
    }),
  ]);

  return {
    tier, targetKey: key, targetDisplay: displayed,
    promptLine: t(lang, 'letters.find', { letter: targetLetter }),
    tiles, answerIdx: tiles.findIndex((t) => t.isAnswer),
  };
}

// Every string a Letters round could ever speak — the offline TTS
// pipeline pre-renders these; runtime must match byte-for-byte.
export function speechLines(): string[] {
  const lines = new Set<string>();
  for (const lang of (['en', 'ja', 'cmn', 'yue'] as const)) {
    // upper + mixed prompts speak the LETTER NAME (case-agnostic).
    for (const L of ALL_LETTERS) lines.add(t(lang, 'letters.find', { letter: L }));
    // sound-mode prompts, one per unique sound.
    for (const s of LETTER_SOUNDS) lines.add(t(lang, 'letters.sound', { sound: s.sound }));
    // kana prompts, one per hiragana in the pool.
    for (const k of KANA_POOL) lines.add(t(lang, 'letters.findKana', { kana: k.kana }));
  }
  return [...lines];
}

export function shouldShowGlyph(misses: number, forceShow: boolean): boolean {
  return forceShow || misses >= 2;
}
