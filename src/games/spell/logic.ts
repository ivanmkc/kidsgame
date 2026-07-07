// Word Builder (Spell) round builder — pre-readers hear the target word,
// tap letter tiles in ORDER to fill slots. English only in every language
// mode (phonics is language-specific). Pool grows automatically as new
// rhyme icons ship; tests inject small `iconMap`s so filtering is
// exercised without depending on the asset table.
import { RHYME_ICONS } from '../language/rhymeAssets';
import { RHYME_WORDS, WORDS } from '../language/words';
import { Rng, shuffle } from '../../rng';

export type SpellDifficulty = 'easy' | 'medium' | 'hard';

export interface SpellWord {
  icon: string;
  en: string;       // uppercase for display; letters uppercase A-Z
  source: 'spotit' | 'rhyme';
}

export interface SpellTile {
  id: number;       // stable within a round (letter alone is not unique)
  letter: string;   // single A-Z
}

export interface SpellRound {
  word: SpellWord;
  letters: string[];        // per-position target, e.g. ['C','A','T']
  tiles: SpellTile[];       // shuffled bank = word letters + decoys
  decoys: string[];         // the pure decoy letters (no overlap with word)
}

const A_TO_Z: readonly string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** 3-5 letter, single word, A-Z only (no spaces, hyphens, ice cream). */
function isSpellable(en: string): boolean {
  return en.length >= 3 && en.length <= 5 && /^[A-Za-z]+$/.test(en);
}

/** Filter the shared WORDS/RHYME_WORDS tables to spellable entries whose
 *  icon actually renders. Injectable maps let tests bypass the asset stub. */
export function wordPool(
  spotitIcons: Record<string, unknown> = {},
  rhymeIcons: Record<string, unknown> = RHYME_ICONS,
): SpellWord[] {
  const out: SpellWord[] = [];
  for (const w of WORDS) {
    if (isSpellable(w.en) && spotitIcons[w.icon] !== undefined) {
      out.push({ icon: w.icon, en: w.en.toUpperCase(), source: 'spotit' });
    }
  }
  for (const w of RHYME_WORDS) {
    if (isSpellable(w.en) && rhymeIcons[w.icon] !== undefined) {
      out.push({ icon: w.icon, en: w.en.toUpperCase(), source: 'rhyme' });
    }
  }
  return out;
}

const WORD_COUNT: Record<SpellDifficulty, number> = { easy: 4, medium: 5, hard: 6 };
const DECOY_COUNT: Record<SpellDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

export function wordsPerGame(d: SpellDifficulty): number { return WORD_COUNT[d]; }
export function decoysFor(d: SpellDifficulty): number { return DECOY_COUNT[d]; }

/** Length preference — E leans 3-letter, H tolerates 5-letter — nudges
 *  the sort order but never truncates the pool (fallbacks stay reachable). */
function lengthRank(len: number, d: SpellDifficulty): number {
  if (d === 'easy') return Math.abs(len - 3);
  if (d === 'hard') return -len;
  return Math.abs(len - 4);
}

/** Draw `wordsPerGame(d)` distinct words from the pool, favoring the
 *  difficulty's preferred length. Falls back through the whole pool if
 *  the preferred tier is thin — never returns fewer than min(pool, count). */
export function pickGameWords(rng: Rng, pool: SpellWord[], d: SpellDifficulty): SpellWord[] {
  const want = wordsPerGame(d);
  const shuffled = shuffle(rng, pool);
  const ranked = shuffled
    .map((w, i) => ({ w, i, r: lengthRank(w.en.length, d) }))
    .sort((a, b) => a.r - b.r || a.i - b.i);
  const chosen: SpellWord[] = [];
  const seen = new Set<string>();
  for (const { w } of ranked) {
    if (chosen.length >= want) break;
    if (seen.has(w.en)) continue;   // dedup by word text
    seen.add(w.en);
    chosen.push(w);
  }
  return chosen;
}

/** Build the tile bank for one word: exactly the word's letters (multiset
 *  preserved for double-letter words like APPLE) plus `decoyCount` distinct
 *  letters that DO NOT appear in the word — so the only duplicates in the
 *  bank are the ones the word itself demands. Next-needed-letter matching
 *  in the UI keeps the round solvable regardless of tap order. */
export function makeRound(rng: Rng, word: SpellWord, decoyCount: number): SpellRound {
  const letters = word.en.split('');
  const banned = new Set(letters);
  const decoyPool = A_TO_Z.filter((l) => !banned.has(l));
  const decoys = shuffle(rng, decoyPool).slice(0, Math.min(decoyCount, decoyPool.length));
  const combined = [...letters, ...decoys];
  const shuffled = shuffle(rng, combined);
  const tiles: SpellTile[] = shuffled.map((letter, i) => ({ id: i, letter }));
  return { word, letters, tiles, decoys };
}

/** Every string a Spell round could ever speak — the offline TTS pipeline
 *  pre-renders these; runtime must match byte-for-byte. Enumerates over
 *  ALL possibly-spellable words in WORDS + RHYME_WORDS (icon availability
 *  is a runtime concern — better an extra clip than a missing one). */
export function speechLines(): string[] {
  const lines = new Set<string>();
  for (const L of A_TO_Z) lines.add(`${L}!`);
  const all: { en: string }[] = [
    ...WORDS.filter((w) => isSpellable(w.en)),
    ...RHYME_WORDS.filter((w) => isSpellable(w.en)),
  ];
  for (const w of all) {
    const upper = w.en.toUpperCase();
    const title = upper[0] + upper.slice(1).toLowerCase();
    lines.add(`Can you spell ${upper}?`);
    lines.add(upper.split('').join('... '));
    lines.add(`You spelled ${upper}!`);
    lines.add(`${title}!`);
  }
  return [...lines];
}

/** Convenience for the game component: the 4 spoken lines for one word,
 *  in the exact strings speechLines() enumerates. */
export function linesForWord(word: SpellWord): {
  ask: string; spell: string; done: string; bare: string;
} {
  const upper = word.en.toUpperCase();
  const title = upper[0] + upper.slice(1).toLowerCase();
  return {
    ask: `Can you spell ${upper}?`,
    spell: upper.split('').join('... '),
    done: `You spelled ${upper}!`,
    bare: `${title}!`,
  };
}
