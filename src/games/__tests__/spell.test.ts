import { describe, expect, it } from 'vitest';
import { SPOTIT_ICONS } from '../../assets/images';
import { Lang } from '../../lang';
import { makeRng } from '../../rng';
import { RHYME_WORDS, WORDS } from '../language/words';
import {
  SpellDifficulty, SpellWord,
  charLine, decoyAlphabetFor, decoysFor, linesForWord, makeRound,
  pickGameWords, speechLines, wordPool, wordsPerGame,
} from '../spell/logic';

const DIFFS: SpellDifficulty[] = ['easy', 'medium', 'hard'];

// Stub icon map: every WORDS entry passes the icon gate — lets non-EN pool
// tests exercise the character-length filter without depending on the
// asset bundle. RHYME_ICONS defaulted, empty {}, per test.
const ALL_ICONS: Record<string, number> =
  Object.fromEntries(WORDS.map((w) => [w.icon, 1]));

describe('spell — EN word pool (unchanged behavior)', () => {
  it('empty RHYME_ICONS still yields ≥8 spellable WORDS entries', () => {
    const pool = wordPool('en', SPOTIT_ICONS, {});
    expect(pool.length).toBeGreaterThanOrEqual(8);
    const ens = new Set(pool.map((w) => w.text));
    for (const w of ['CAT', 'DOG', 'PIG', 'FOX', 'STAR', 'CAR', 'FISH', 'FROG']) {
      expect(ens.has(w)).toBe(true);
    }
    for (const w of pool) {
      expect(w.lang).toBe('en');
      expect(w.chars.join('')).toBe(w.text);
      expect(w.roman).toBe('');
    }
  });

  it('picks up rhyme words when RHYME_ICONS lists them', () => {
    const pool = wordPool('en', SPOTIT_ICONS, { sun: 1, bee: 1, moon: 1 });
    const ens = new Set(pool.map((w) => w.text));
    expect(ens.has('SUN')).toBe(true);
    expect(ens.has('BEE')).toBe(true);
    expect(ens.has('MOON')).toBe(true);
    expect(ens.has('CAKE')).toBe(false);
  });

  it('rejects entries outside 3-5 letters or containing a space', () => {
    const pool = wordPool('en', SPOTIT_ICONS, {});
    for (const w of pool) {
      expect(w.text.length).toBeGreaterThanOrEqual(3);
      expect(w.text.length).toBeLessThanOrEqual(5);
      expect(/^[A-Z]+$/.test(w.text)).toBe(true);
    }
    expect(pool.some((w) => w.icon === 'icecream')).toBe(false);
    expect(pool.some((w) => w.icon === 'banana')).toBe(false);
  });
});

describe('spell — ja word pool', () => {
  it('pulls kana words with 2-4 chars, rejects overlong entries', () => {
    const pool = wordPool('ja', ALL_ICONS);
    expect(pool.length).toBeGreaterThanOrEqual(15);
    for (const w of pool) {
      expect(w.lang).toBe('ja');
      expect(w.chars.length).toBeGreaterThanOrEqual(2);
      expect(w.chars.length).toBeLessThanOrEqual(4);
      expect(w.chars.join('')).toBe(w.text);
    }
    const texts = new Set(pool.map((w) => w.text));
    expect(texts.has('ねこ')).toBe(true);         // 2 kana
    expect(texts.has('ライオン')).toBe(true);      // 4 kana
    expect(texts.has('ロケット')).toBe(true);      // small ッ counted as its own char
    expect(texts.has('ユニコーン')).toBe(false);   // 5 kana → excluded
    expect(texts.has('ちょうちょ')).toBe(false);   // 5 chars via [...str] → excluded
    expect(texts.has('てんとうむし')).toBe(false); // 6 chars → excluded
    expect(texts.has('アイスクリーム')).toBe(false); // 7 chars → excluded
  });

  it('excludes RHYME_WORDS (no translations exist)', () => {
    const pool = wordPool('ja', ALL_ICONS);
    expect(pool.every((w) => w.source === 'spotit')).toBe(true);
  });

  it('exposes the jaR romanization caption for parents', () => {
    const pool = wordPool('ja', ALL_ICONS);
    const neko = pool.find((w) => w.text === 'ねこ');
    expect(neko?.roman).toBe('neko');
  });

  it('respects the icon gate like EN', () => {
    const pool = wordPool('ja', { panda: 1 });
    expect(pool).toHaveLength(1);
    expect(pool[0].icon).toBe('panda');
    expect(pool[0].text).toBe('パンダ');
  });
});

describe('spell — cmn word pool', () => {
  it('pulls 2-4 hanzi words, excludes single-char (too trivial)', () => {
    const pool = wordPool('cmn', ALL_ICONS);
    expect(pool.length).toBeGreaterThanOrEqual(20);
    for (const w of pool) {
      expect(w.lang).toBe('cmn');
      expect(w.chars.length).toBeGreaterThanOrEqual(2);
      expect(w.chars.length).toBeLessThanOrEqual(4);
    }
    const texts = new Set(pool.map((w) => w.text));
    // Single-char cmn words are excluded.
    for (const single of ['狗', '猫', '猪', '鱼', '花']) {
      expect(texts.has(single)).toBe(false);
    }
    // 2- and 3-char words present.
    expect(texts.has('熊猫')).toBe(true);
    expect(texts.has('狐狸')).toBe(true);
    expect(texts.has('向日葵')).toBe(true);
    expect(texts.has('冰淇淋')).toBe(true);
    expect(pool.find((w) => w.icon === 'panda')?.roman).toBe('xióngmāo');
  });
});

describe('spell — yue word pool', () => {
  it('pulls 2-4 hanzi words, excludes single-char (too trivial)', () => {
    const pool = wordPool('yue', ALL_ICONS);
    expect(pool.length).toBeGreaterThanOrEqual(20);
    for (const w of pool) {
      expect(w.lang).toBe('yue');
      expect(w.chars.length).toBeGreaterThanOrEqual(2);
      expect(w.chars.length).toBeLessThanOrEqual(4);
    }
    const texts = new Set(pool.map((w) => w.text));
    for (const single of ['狗', '貓', '豬', '蟹', '魚', '花', '車']) {
      expect(texts.has(single)).toBe(false);
    }
    expect(texts.has('熊貓')).toBe(true);          // note traditional 貓
    expect(texts.has('士多啤梨')).toBe(true);       // 4-char
    expect(pool.find((w) => w.icon === 'strawberry')?.roman).toBe('si-do-be-lei');
  });
});

describe('spell — pickGameWords', () => {
  it.each(DIFFS)('draws wordsPerGame(%s) distinct EN words', (d) => {
    const pool = wordPool('en', SPOTIT_ICONS, {});
    for (let seed = 1; seed <= 20; seed++) {
      const words = pickGameWords(makeRng(seed), pool, d);
      expect(words).toHaveLength(wordsPerGame(d));
      expect(new Set(words.map((w) => w.text)).size).toBe(words.length);
    }
  });

  it('easy leans toward 3-letter words when the pool supports it (EN)', () => {
    const pool = wordPool('en', SPOTIT_ICONS, {});
    let threes = 0, total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const w of pickGameWords(makeRng(seed), pool, 'easy')) {
        if (w.chars.length === 3) threes += 1;
        total += 1;
      }
    }
    expect(threes / total).toBeGreaterThan(0.6);
  });

  it.each(['ja', 'cmn', 'yue'] as const)('draws distinct 2-4 char words for %s', (lang) => {
    const pool = wordPool(lang, ALL_ICONS);
    for (const d of DIFFS) {
      for (let seed = 1; seed <= 10; seed++) {
        const words = pickGameWords(makeRng(seed), pool, d);
        expect(words.length).toBeGreaterThan(0);
        expect(words.length).toBeLessThanOrEqual(wordsPerGame(d));
        expect(new Set(words.map((w) => w.text)).size).toBe(words.length);
        for (const w of words) {
          expect(w.lang).toBe(lang);
          expect(w.chars.length).toBeGreaterThanOrEqual(2);
          expect(w.chars.length).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('easy leans toward 2-char words in non-EN modes', () => {
    for (const lang of ['ja', 'cmn', 'yue'] as const) {
      const pool = wordPool(lang, ALL_ICONS);
      let twos = 0, total = 0;
      for (let seed = 1; seed <= 40; seed++) {
        for (const w of pickGameWords(makeRng(seed), pool, 'easy')) {
          if (w.chars.length === 2) twos += 1;
          total += 1;
        }
      }
      expect(twos / total).toBeGreaterThan(0.6);
    }
  });
});

describe('spell — makeRound (tile bank + solvability)', () => {
  it.each(DIFFS)('EN: bank = word chars (multiset) + N A-Z decoys for %s', (d) => {
    const pool = wordPool('en', SPOTIT_ICONS, {});
    const alphabet = decoyAlphabetFor('en', pool);
    const decoyCount = decoysFor(d);
    for (let seed = 1; seed <= 40; seed++) {
      const rng = makeRng(seed);
      const words = pickGameWords(rng, pool, d);
      for (const w of words) {
        const round = makeRound(rng, w, decoyCount, alphabet);
        const wordCounts = countChars(round.chars);
        const tileCounts = countChars(round.tiles.map((t) => t.char));
        for (const [c, n] of wordCounts) {
          expect(tileCounts.get(c) ?? 0).toBeGreaterThanOrEqual(n);
        }
        expect(round.decoys).toHaveLength(decoyCount);
        expect(new Set(round.decoys).size).toBe(decoyCount);
        for (const d0 of round.decoys) expect(round.chars).not.toContain(d0);
        expect(round.tiles).toHaveLength(round.chars.length + decoyCount);
        expect(new Set(round.tiles.map((t) => t.id)).size).toBe(round.tiles.length);
      }
    }
  });

  it.each(['ja', 'cmn', 'yue'] as const)(
    '%s: decoys come from OTHER pool words, never the target chars', (lang) => {
    const pool = wordPool(lang, ALL_ICONS);
    const alphabet = decoyAlphabetFor(lang, pool);
    // Alphabet must be a subset of the pool's own character set (no A-Z leakage).
    const poolChars = new Set(pool.flatMap((w) => w.chars));
    for (const c of alphabet) expect(poolChars.has(c)).toBe(true);
    expect(alphabet.length).toBeGreaterThan(0);

    for (const d of DIFFS) {
      const decoyCount = decoysFor(d);
      for (let seed = 1; seed <= 30; seed++) {
        const rng = makeRng(seed);
        const words = pickGameWords(rng, pool, d);
        for (const w of words) {
          const round = makeRound(rng, w, decoyCount, alphabet);
          // Word chars preserved (multiset).
          const wordCounts = countChars(round.chars);
          const tileCounts = countChars(round.tiles.map((t) => t.char));
          for (const [c, n] of wordCounts) {
            expect(tileCounts.get(c) ?? 0).toBeGreaterThanOrEqual(n);
          }
          expect(new Set(round.decoys).size).toBe(round.decoys.length);
          for (const d0 of round.decoys) {
            expect(w.chars).not.toContain(d0);       // disjoint from target
            expect(poolChars.has(d0)).toBe(true);    // from the pool alphabet
          }
          expect(round.tiles).toHaveLength(round.chars.length + round.decoys.length);
          expect(new Set(round.tiles.map((t) => t.id)).size).toBe(round.tiles.length);
        }
      }
    }
  });

  it.each(['en', 'ja', 'cmn', 'yue'] as const)(
    '%s: correct-next-char matching solves every round across many seeds', (lang) => {
    const pool = lang === 'en' ? wordPool('en', SPOTIT_ICONS, {}) : wordPool(lang, ALL_ICONS);
    const alphabet = decoyAlphabetFor(lang, pool);
    for (let seed = 1; seed <= 60; seed++) {
      const rng = makeRng(seed);
      const d: SpellDifficulty = DIFFS[seed % 3];
      const words = pickGameWords(rng, pool, d);
      for (const w of words) {
        const round = makeRound(rng, w, decoysFor(d), alphabet);
        const used = new Set<number>();
        const placed: string[] = [];
        for (let slot = 0; slot < round.chars.length; slot++) {
          const need = round.chars[slot];
          const candidate = round.tiles.find(
            (t) => !used.has(t.id) && t.char === need,
          );
          expect(candidate, `lang=${lang} word=${w.text} slot=${slot}`).toBeDefined();
          used.add(candidate!.id);
          placed.push(candidate!.char);
        }
        expect(placed.join('')).toBe(w.text);
      }
    }
  });
});

describe('spell — linesForWord (per-lang wrapping)', () => {
  it('EN keeps the existing lines byte-for-byte', () => {
    const w: SpellWord = { icon: 'cat', lang: 'en', text: 'CAT', chars: ['C', 'A', 'T'], roman: '', source: 'spotit' };
    const lines = linesForWord(w);
    expect(lines.ask).toBe('Can you spell cat?');
    expect(lines.spell).toBe('C... A... T');
    expect(lines.done).toBe('You spelled cat!');
    expect(lines.bare).toBe('Cat!');
  });

  it('ja wraps with 「…」を つくってね！ and uses fullwidth punctuation', () => {
    const w: SpellWord = { icon: 'cat', lang: 'ja', text: 'ねこ', chars: ['ね', 'こ'], roman: 'neko', source: 'spotit' };
    const lines = linesForWord(w);
    expect(lines.ask).toBe('「ねこ」を つくってね！');
    expect(lines.spell).toBe('ね… こ！');
    expect(lines.done).toBe('できた！ねこ！');
    expect(lines.bare).toBeUndefined();
  });

  it('cmn uses 拼一拼 / 拼好了 wrappers', () => {
    const w: SpellWord = { icon: 'panda', lang: 'cmn', text: '熊猫', chars: ['熊', '猫'], roman: 'xióngmāo', source: 'spotit' };
    const lines = linesForWord(w);
    expect(lines.ask).toBe('拼一拼：熊猫！');
    expect(lines.spell).toBe('熊… 猫！');
    expect(lines.done).toBe('拼好了！熊猫！');
  });

  it('yue uses 砌一砌 / 砌好晒 wrappers', () => {
    const w: SpellWord = { icon: 'panda', lang: 'yue', text: '熊貓', chars: ['熊', '貓'], roman: 'hung-maau', source: 'spotit' };
    const lines = linesForWord(w);
    expect(lines.ask).toBe('砌一砌：熊貓！');
    expect(lines.spell).toBe('熊… 貓！');
    expect(lines.done).toBe('砌好晒！熊貓！');
  });

  it('charLine picks ASCII "!" for EN and fullwidth "！" for non-EN', () => {
    expect(charLine('A', 'en')).toBe('A!');
    expect(charLine('い', 'ja')).toBe('い！');
    expect(charLine('熊', 'cmn')).toBe('熊！');
    expect(charLine('貓', 'yue')).toBe('貓！');
  });
});

describe('spell — speechLines() coverage (union of ALL four languages)', () => {
  const LINES = new Set(speechLines());

  it('EN: every letter A!..Z! and every spellable en word contributes ask/spell/done/bare', () => {
    for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') expect(LINES.has(`${L}!`)).toBe(true);
    const pool = wordPool('en', SPOTIT_ICONS,
      RHYME_WORDS.reduce<Record<string, number>>((m, w) => { m[w.icon] = 1; return m; }, {}));
    expect(pool.length).toBeGreaterThan(0);
    for (const w of pool) {
      const { ask, spell, done, bare } = linesForWord(w);
      expect(LINES.has(ask), `missing ask for ${w.text}`).toBe(true);
      expect(LINES.has(spell), `missing spell for ${w.text}`).toBe(true);
      expect(LINES.has(done), `missing done for ${w.text}`).toBe(true);
      expect(LINES.has(bare!), `missing bare for ${w.text}`).toBe(true);
    }
  });

  it.each(['ja', 'cmn', 'yue'] as const)(
    '%s: every pool word contributes per-char + ask/spell/done', (lang) => {
    const pool = wordPool(lang, ALL_ICONS);
    expect(pool.length).toBeGreaterThan(0);
    for (const w of pool) {
      for (const c of w.chars) {
        expect(LINES.has(charLine(c, lang)), `missing char line ${c} for ${w.text}`).toBe(true);
      }
      const { ask, spell, done } = linesForWord(w);
      expect(LINES.has(ask), `missing ask for ${w.text}`).toBe(true);
      expect(LINES.has(spell), `missing spell for ${w.text}`).toBe(true);
      expect(LINES.has(done), `missing done for ${w.text}`).toBe(true);
    }
  });

  it('lines are deduped and non-empty', () => {
    const arr = speechLines();
    expect(arr.length).toBe(LINES.size);
    for (const l of arr) expect(l).not.toBe('');
  });
});

// Small helper — count occurrences per char.
function countChars(chars: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of chars) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

// Reference: full sweep of WORDS/RHYME_WORDS just so failures elsewhere in
// the pool (e.g. an entry with punctuation slipping in) show up here first.
describe('spell — canonical pool sanity', () => {
  it('WORDS and RHYME_WORDS still have spellable entries', () => {
    expect(wordPool('en', SPOTIT_ICONS, {}).length).toBeGreaterThanOrEqual(8);
    expect(wordPool('ja', ALL_ICONS).length).toBeGreaterThan(0);
    expect(wordPool('cmn', ALL_ICONS).length).toBeGreaterThan(0);
    expect(wordPool('yue', ALL_ICONS).length).toBeGreaterThan(0);
  });

  it('speechLines() spans all four languages', () => {
    const arr = speechLines();
    expect(arr.some((l) => l.includes('Can you spell'))).toBe(true);
    expect(arr.some((l) => l.includes('つくってね'))).toBe(true);
    expect(arr.some((l) => l.startsWith('拼一拼'))).toBe(true);
    expect(arr.some((l) => l.startsWith('砌一砌'))).toBe(true);
  });

  // Compile-time nudge: keep imports honest.
  it('Lang import remains referenced', () => {
    const l: Lang = 'ja';
    expect(l).toBe('ja');
  });
});
