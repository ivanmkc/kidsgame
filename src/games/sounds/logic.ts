// First Sounds (EN phonics) / First Words (JA/cmn/yue localised).
// Distractors in every mode carry DISTINCT phonic sounds so that even in
// non-EN modes the tile set can't accidentally offer two "duh" answers.
import { Lang } from '../../lang';
import { Rng, shuffle } from '../../rng';
import { WORDS, WordEntry, soundsFor, wordFor } from '../../words';

export interface SoundsTile {
  key: string;
  icon: string;
  wordIdx: number;
  isAnswer: boolean;
}

export interface SoundsRound {
  target: WordEntry;
  targetIdx: number;
  lang: Lang;
  tiles: SoundsTile[];
  answerIdx: number;
}

export interface SoundsSettings {
  rounds: number;
  tiles: number;
}

export function settingsForSounds(difficulty: 'easy' | 'medium' | 'hard'): SoundsSettings {
  if (difficulty === 'easy') return { rounds: 8,  tiles: 3 };
  if (difficulty === 'hard') return { rounds: 12, tiles: 4 };
  return                            { rounds: 10, tiles: 4 };
}

export interface SoundsLayout {
  gap: number;
  tile: number;
  gridWidth: number;
}

function candidateTile(
  width: number,
  height: number,
  cols: number,
  rows: number,
): number {
  const gap = 14;
  return Math.min(
    (Math.min(width - 32, 600) - (cols - 1) * gap) / cols,
    (height - 84 - 130 - (rows - 1) * gap) / rows,
    170,
  );
}

export function soundsLayout(
  width: number,
  height: number,
  tileCount: number,
): SoundsLayout {
  const gap = 14;

  let cols: number;
  let rows: number;
  let tile: number;

  if (tileCount === 4) {
    const tile2x2 = candidateTile(width, height, 2, 2);
    const tile1x4 = candidateTile(width, height, 4, 1);
    if (tile1x4 > tile2x2) {
      cols = 4;
      rows = 1;
      tile = tile1x4;
    } else {
      cols = 2;
      rows = 2;
      tile = tile2x2;
    }
  } else if (tileCount <= 3) {
    cols = 3;
    rows = 1;
    tile = candidateTile(width, height, cols, rows);
  } else {
    cols = 3;
    rows = Math.ceil(tileCount / cols);
    tile = candidateTile(width, height, cols, rows);
  }

  const gridWidth = cols * tile + (cols - 1) * gap;
  return { gap, tile, gridWidth };
}

const ASK: Record<Lang, string> = {
  en: '',                    // EN builds a full "Which one starts with X?" line
  ja: 'どれかな？',
  cmn: '哪一个是？',
  yue: '邊個係？',
};

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export interface SoundsPrompts {
  promptLines: string[];
  displayPrompt: string;
  caption?: string;
  confirmLines: string[];
}

export function resolveSoundsPrompts(target: WordEntry, lang: Lang): SoundsPrompts {
  if (lang === 'en') {
    const promptLines = [`Which one starts with ${target.sound}?`];
    return {
      promptLines,
      displayPrompt: promptLines[0],
      confirmLines: [
        `${capitalize(target.en)}!`,
        `${capitalize(target.en)} starts with ${target.sound}!`,
      ],
    };
  }
  const w = wordFor(target, lang);
  return {
    promptLines: [ASK[lang], w.text],
    displayPrompt: `${ASK[lang]} ${w.text}`,
    confirmLines: [`${w.text}！`, `${capitalize(target.en)}!`],
    caption: w.roman,
  };
}

// Filter the master WORDS list to entries whose icon is actually shipped —
// SPOTIT_ICONS is the source of truth. WORDS today matches it, but the
// filter keeps us honest if the icon pipeline ever drops one.
function playablePool(icons: string[]): WordEntry[] {
  return WORDS.filter((w) => icons.includes(w.icon));
}

export function makeSoundsRound(
  rng: Rng, icons: string[], lang: Lang, tileCount: number, avoidIcon?: string,
): SoundsRound {
  const pool = playablePool(icons);
  const candidates = pool.filter((w) => w.icon !== avoidIcon);
  const target = candidates[Math.floor(rng() * candidates.length)];

  // Distractors must (a) be different words, (b) carry a different phonic
  // sound so a first-sounds prompt has exactly one right answer — including
  // under any name a kid might use for the picture ("bunny" for the rabbit
  // is a 'buh' answer too) — and (c) never be something the kid would call
  // by the TARGET's name, which is what a non-EN word prompt asks for.
  const twins = new Set(target.nameTwins ?? []);
  const ambiguous = (w: WordEntry) =>
    twins.has(w.icon) || soundsFor(w).includes(target.sound);
  const usedSounds = new Set<string>([target.sound]);
  const distractors: WordEntry[] = [];
  const shuffled = shuffle(rng, pool.filter((w) => w.icon !== target.icon && !ambiguous(w)));
  for (const w of shuffled) {
    if (distractors.length >= tileCount - 1) break;
    if (usedSounds.has(w.sound)) continue;
    usedSounds.add(w.sound);
    distractors.push(w);
  }
  // Extremely narrow WORDS lists could run out of unique sounds; fall back
  // to any unambiguous word (still icon-distinct) rather than crashing.
  if (distractors.length < tileCount - 1) {
    for (const w of shuffled) {
      if (distractors.length >= tileCount - 1) break;
      if (distractors.includes(w)) continue;
      distractors.push(w);
    }
  }

  const combined = shuffle(rng, [target, ...distractors]);
  const tiles: SoundsTile[] = combined.map((w) => ({
    key: w.icon,
    icon: w.icon,
    wordIdx: pool.indexOf(w),
    isAnswer: w.icon === target.icon,
  }));

  return {
    target,
    targetIdx: pool.indexOf(target),
    lang,
    tiles,
    answerIdx: tiles.findIndex((t) => t.isAnswer),
  };
}

// Every string the game could ever speak. The offline TTS pipeline
// pre-renders these; runtime `say`/`saySequence` must match byte-exact.
export function speechLines(): string[] {
  const s = new Set<string>();
  // EN: one prompt per unique sound + a two-line confirmation per word.
  const seenSound = new Set<string>();
  for (const w of WORDS) {
    if (!seenSound.has(w.sound)) {
      seenSound.add(w.sound);
      s.add(`Which one starts with ${w.sound}?`);
    }
    s.add(`${capitalize(w.en)}!`);
    s.add(`${capitalize(w.en)} starts with ${w.sound}!`);
  }
  // Non-EN: fixed ask word + per-entry localized word + confirm chime.
  for (const lang of ['ja', 'cmn', 'yue'] as const) {
    s.add(ASK[lang]);
    for (const w of WORDS) {
      const loc = wordFor(w, lang);
      s.add(loc.text);
      s.add(`${loc.text}！`);
    }
  }
  return [...s];
}
