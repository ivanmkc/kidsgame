// Word Builder (Spell) round builder — pre-readers hear the target word,
// tap character tiles in ORDER to fill slots. Localizes per lang:
//   en:  3-5 letter English words + phonics decoys (A-Z)
//   ja:  2-4 kana words (from WORDS.ja); tiles = kana chars, decoys drawn
//        from other pool words' kana (never the target's own kana)
//   cmn: 2-4 hanzi words (from WORDS.cmn) — single-char excluded (trivial)
//   yue: 2-4 hanzi words (from WORDS.yue) — single-char excluded (trivial)
// RHYME_WORDS have no translations → EN pool only.
import { Lang } from '../../lang';
import { RHYME_ICONS } from '../language/rhymeAssets';
import { RHYME_WORDS, WORDS, WordEntry } from '../language/words';
import { Rng, shuffle } from '../../rng';

export type SpellDifficulty = 'easy' | 'medium' | 'hard';

export interface SpellWord {
  icon: string;
  lang: Lang;
  text: string;          // display: 'CAT' (en) / 'ねこ' / '熊猫' / '熊貓'
  chars: string[];       // per-position characters (multiset preserved)
  roman: string;         // parent romanization caption ('' for en)
  source: 'spotit' | 'rhyme';
}

export interface SpellTile {
  id: number;            // stable within a round (char alone is not unique)
  char: string;          // single character (letter, kana, or hanzi)
}

export interface SpellRound {
  word: SpellWord;
  chars: string[];       // per-position target, e.g. ['C','A','T'] or ['熊','猫']
  tiles: SpellTile[];    // shuffled bank = word chars + decoys
  decoys: string[];      // pure decoy chars (no overlap with word.chars)
}

const A_TO_Z: readonly string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** 3-5 letter, single word, A-Z only (no spaces, hyphens, ice cream). */
function isSpellableEN(en: string): boolean {
  return en.length >= 3 && en.length <= 5 && /^[A-Za-z]+$/.test(en);
}

/** 2-4 characters per Unicode code-point split (`[...str]`). Applied to
 *  kana and hanzi pools; single-char zh words are excluded as too trivial. */
function isSpellableChars(chars: string[]): boolean {
  return chars.length >= 2 && chars.length <= 4;
}

/** Pick (text, roman) for a non-EN language from a WordEntry — explicit
 *  branches keep the field types nominal (jaR/cmnR/yueR). */
function localized(w: WordEntry, lang: Exclude<Lang, 'en'>): { text: string; roman: string } {
  if (lang === 'ja') return { text: w.ja, roman: w.jaR };
  if (lang === 'cmn') return { text: w.cmn, roman: w.cmnR };
  return { text: w.yue, roman: w.yueR };
}

/** All entries whose LOCALIZED word is spellable in `lang` and whose icon
 *  renders. RHYME_WORDS lack translations → included only for 'en'. */
export function wordPool(
  lang: Lang,
  spotitIcons: Record<string, unknown> = {},
  rhymeIcons: Record<string, unknown> = RHYME_ICONS,
): SpellWord[] {
  const out: SpellWord[] = [];
  if (lang === 'en') {
    for (const w of WORDS) {
      if (!isSpellableEN(w.en)) continue;
      if (spotitIcons[w.icon] === undefined) continue;
      const upper = w.en.toUpperCase();
      out.push({ icon: w.icon, lang, text: upper, chars: upper.split(''), roman: '', source: 'spotit' });
    }
    for (const w of RHYME_WORDS) {
      if (!isSpellableEN(w.en)) continue;
      if (rhymeIcons[w.icon] === undefined) continue;
      const upper = w.en.toUpperCase();
      out.push({ icon: w.icon, lang, text: upper, chars: upper.split(''), roman: '', source: 'rhyme' });
    }
    return out;
  }
  for (const w of WORDS) {
    const { text, roman } = localized(w, lang);
    const chars = [...text];
    if (!isSpellableChars(chars)) continue;
    if (spotitIcons[w.icon] === undefined) continue;
    out.push({ icon: w.icon, lang, text, chars, roman, source: 'spotit' });
  }
  return out;
}

const WORD_COUNT: Record<SpellDifficulty, number> = { easy: 4, medium: 5, hard: 6 };
const DECOY_COUNT: Record<SpellDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

export function wordsPerGame(d: SpellDifficulty): number { return WORD_COUNT[d]; }
export function decoysFor(d: SpellDifficulty): number { return DECOY_COUNT[d]; }

/** Length preference — E leans shortest, H tolerates longest — nudges the
 *  sort order but never truncates the pool (fallbacks stay reachable).
 *  Targets shift by script: EN words are 3-5, ja/cmn/yue words are 2-4. */
function lengthRank(len: number, d: SpellDifficulty, lang: Lang): number {
  const shortTarget = lang === 'en' ? 3 : 2;
  const midTarget = lang === 'en' ? 4 : 3;
  if (d === 'easy') return Math.abs(len - shortTarget);
  if (d === 'hard') return -len;
  return Math.abs(len - midTarget);
}

/** Draw `wordsPerGame(d)` distinct words from the pool, favoring the
 *  difficulty's preferred length. Pool is uniform-by-lang (from wordPool),
 *  so the first entry's lang tags the ranking. Falls back through the whole
 *  pool if the preferred tier is thin. */
export function pickGameWords(rng: Rng, pool: SpellWord[], d: SpellDifficulty): SpellWord[] {
  const want = wordsPerGame(d);
  const lang: Lang = pool[0]?.lang ?? 'en';
  const shuffled = shuffle(rng, pool);
  const ranked = shuffled
    .map((w, i) => ({ w, i, r: lengthRank(w.chars.length, d, lang) }))
    .sort((a, b) => a.r - b.r || a.i - b.i);
  const chosen: SpellWord[] = [];
  const seen = new Set<string>();
  for (const { w } of ranked) {
    if (chosen.length >= want) break;
    if (seen.has(w.text)) continue;   // dedup by display text
    seen.add(w.text);
    chosen.push(w);
  }
  return chosen;
}

/** Alphabet from which decoys are drawn, per lang.
 *  en: static A-Z (matches the phonics convention).
 *  ja/cmn/yue: union of every character appearing in OTHER pool words in
 *  the same script. makeRound then removes the target's own chars so
 *  decoys never overlap the answer. */
export function decoyAlphabetFor(lang: Lang, pool: SpellWord[]): string[] {
  if (lang === 'en') return A_TO_Z.slice();
  const s = new Set<string>();
  for (const w of pool) for (const c of w.chars) s.add(c);
  return [...s];
}

/** Build the tile bank for one word: exactly the word's characters
 *  (multiset preserved — 星星 stays as two 星 tiles) plus `decoyCount`
 *  distinct chars from `alphabet` that DO NOT appear in the word. The
 *  UI's next-needed-char matching keeps every round solvable. */
export function makeRound(
  rng: Rng,
  word: SpellWord,
  decoyCount: number,
  alphabet: readonly string[] = A_TO_Z,
): SpellRound {
  const chars = word.chars.slice();
  const banned = new Set(chars);
  const decoyPool = alphabet.filter((c) => !banned.has(c));
  const decoys = shuffle(rng, decoyPool).slice(0, Math.min(decoyCount, decoyPool.length));
  const combined = [...chars, ...decoys];
  const shuffled = shuffle(rng, combined);
  const tiles: SpellTile[] = shuffled.map((char, i) => ({ id: i, char }));
  return { word, chars, tiles, decoys };
}

/** Per-tap spoken cue for one character. EN uses ASCII '!'; non-EN uses
 *  the fullwidth '！' so the TTS pipeline synthesizes the correct clip. */
export function charLine(char: string, lang: Lang): string {
  return lang === 'en' ? `${char}!` : `${char}！`;
}

/** The 4 lines a Spell round speaks for one word.
 *  ask/spell fire on load and on tap-to-hear; wrong-tap re-plays spell;
 *  done fires on completion. EN keeps its existing strings byte-for-byte;
 *  ja/cmn/yue use the localized prompts from the spec. */
export function linesForWord(word: SpellWord): {
  ask: string; spell: string; done: string; bare?: string;
} {
  if (word.lang === 'en') {
    const upper = word.text;
    const title = upper[0] + upper.slice(1).toLowerCase();
    // Spoken prompts use the lowercase WORD: TTS reads "SUN" as the
    // initialism S-U-N, which hands the kid the answer and defeats the
    // game. The letter-by-letter re-cue (spell) is the only place we
    // WANT spelled-out letters.
    const spoken = upper.toLowerCase();
    return {
      ask: `Can you spell ${spoken}?`,
      spell: upper.split('').join('... '),
      done: `You spelled ${spoken}!`,
      bare: `${title}!`,
    };
  }
  const text = word.text;
  const spell = word.chars.join('… ') + '！';
  if (word.lang === 'ja') {
    return {
      ask: `「${text}」を つくってね！`,
      spell,
      done: `できた！${text}！`,
    };
  }
  if (word.lang === 'cmn') {
    return {
      ask: `拼一拼：${text}！`,
      spell,
      done: `拼好了！${text}！`,
    };
  }
  // yue
  return {
    ask: `砌一砌：${text}！`,
    spell,
    done: `砌好晒！${text}！`,
  };
}

/** Every string a Spell round could ever speak, across ALL FOUR language
 *  modes. The offline TTS pipeline pre-renders these; runtime must match
 *  byte-for-byte. Icon availability is a runtime concern — better an extra
 *  clip than a missing one. Non-ASCII lines are auto-tagged by script:
 *  kana → ja clips, hanzi → both cmn+yue clips, so identical hanzi
 *  strings work in both zh modes via the lang-keyed lookup. */
export function speechLines(): string[] {
  const lines = new Set<string>();

  // ---------- English (unchanged) ----------
  for (const L of A_TO_Z) lines.add(charLine(L, 'en'));
  const enSources: { text: string; chars: string[] }[] = [];
  for (const w of WORDS) if (isSpellableEN(w.en)) {
    const upper = w.en.toUpperCase();
    enSources.push({ text: upper, chars: upper.split('') });
  }
  for (const w of RHYME_WORDS) if (isSpellableEN(w.en)) {
    const upper = w.en.toUpperCase();
    enSources.push({ text: upper, chars: upper.split('') });
  }
  for (const s of enSources) {
    const sw: SpellWord = { icon: '', lang: 'en', text: s.text, chars: s.chars, roman: '', source: 'spotit' };
    const wl = linesForWord(sw);
    lines.add(wl.ask); lines.add(wl.spell); lines.add(wl.done);
    if (wl.bare) lines.add(wl.bare);
  }

  // ---------- ja / cmn / yue ----------
  for (const lang of ['ja', 'cmn', 'yue'] as const) {
    for (const w of WORDS) {
      const { text } = localized(w, lang);
      const chars = [...text];
      if (!isSpellableChars(chars)) continue;
      for (const c of chars) lines.add(charLine(c, lang));
      const sw: SpellWord = { icon: w.icon, lang, text, chars, roman: '', source: 'spotit' };
      const wl = linesForWord(sw);
      lines.add(wl.ask); lines.add(wl.spell); lines.add(wl.done);
    }
  }
  return [...lines];
}
