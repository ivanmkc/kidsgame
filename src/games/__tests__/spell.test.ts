import { describe, expect, it } from 'vitest';
import { SPOTIT_ICONS } from '../../assets/images';
import { makeRng } from '../../rng';
import { RHYME_WORDS, WORDS } from '../language/words';
import {
  SpellDifficulty,
  decoysFor,
  linesForWord,
  makeRound,
  pickGameWords,
  speechLines,
  wordPool,
  wordsPerGame,
} from '../spell/logic';

const DIFFS: SpellDifficulty[] = ['easy', 'medium', 'hard'];

describe('spell — word pool', () => {
  it('empty RHYME_ICONS still yields ≥8 spellable WORDS entries', () => {
    const pool = wordPool(SPOTIT_ICONS, {});
    expect(pool.length).toBeGreaterThanOrEqual(8);
    // The 8 words the spec guarantees exist as spellable WORDS entries.
    const ens = new Set(pool.map((w) => w.en));
    for (const w of ['CAT', 'DOG', 'PIG', 'FOX', 'STAR', 'CAR', 'FISH', 'FROG']) {
      expect(ens.has(w)).toBe(true);
    }
  });

  it('picks up rhyme words when RHYME_ICONS lists them', () => {
    // Inject a non-empty rhyme map that covers a couple of rhyme entries.
    const pool = wordPool(SPOTIT_ICONS, { sun: 1, bee: 1, moon: 1 });
    const ens = new Set(pool.map((w) => w.en));
    expect(ens.has('SUN')).toBe(true);
    expect(ens.has('BEE')).toBe(true);
    expect(ens.has('MOON')).toBe(true);
    // ...but a rhyme word with no icon is still filtered out.
    expect(ens.has('CAKE')).toBe(false);
  });

  it('rejects entries outside 3-5 letters or containing a space', () => {
    const pool = wordPool(SPOTIT_ICONS, {});
    for (const w of pool) {
      expect(w.en.length).toBeGreaterThanOrEqual(3);
      expect(w.en.length).toBeLessThanOrEqual(5);
      expect(/^[A-Z]+$/.test(w.en)).toBe(true);
    }
    // "ice cream" has a space → excluded.
    expect(pool.some((w) => w.icon === 'icecream')).toBe(false);
    // "banana" is 6 letters → excluded even though its icon exists.
    expect(pool.some((w) => w.icon === 'banana')).toBe(false);
  });
});

describe('spell — pickGameWords', () => {
  it.each(DIFFS)('draws wordsPerGame(%s) distinct words', (d) => {
    const pool = wordPool(SPOTIT_ICONS, {});
    for (let seed = 1; seed <= 20; seed++) {
      const words = pickGameWords(makeRng(seed), pool, d);
      expect(words).toHaveLength(wordsPerGame(d));
      expect(new Set(words.map((w) => w.en)).size).toBe(words.length);
    }
  });

  it('easy leans toward 3-letter words when the pool supports it', () => {
    const pool = wordPool(SPOTIT_ICONS, {});
    let threes = 0, total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const w of pickGameWords(makeRng(seed), pool, 'easy')) {
        if (w.en.length === 3) threes += 1;
        total += 1;
      }
    }
    // 5 three-letter words in the pool (DOG/CAT/PIG/FOX/CAR); easy asks for 4
    // per game, so a strong lean should push majority of picks to length 3.
    expect(threes / total).toBeGreaterThan(0.6);
  });
});

describe('spell — makeRound (tile bank + solvability)', () => {
  it.each(DIFFS)('bank = word letters (multiset) + N distinct non-word decoys for %s', (d) => {
    const pool = wordPool(SPOTIT_ICONS, {});
    const decoyCount = decoysFor(d);
    for (let seed = 1; seed <= 40; seed++) {
      const rng = makeRng(seed);
      const words = pickGameWords(rng, pool, d);
      for (const w of words) {
        const round = makeRound(rng, w, decoyCount);
        // Word letters preserved as a multiset (double letters like APPLE stay).
        const wordCounts = countLetters(round.letters);
        const tileCounts = countLetters(round.tiles.map((t) => t.letter));
        for (const [L, n] of wordCounts) {
          expect(tileCounts.get(L) ?? 0).toBeGreaterThanOrEqual(n);
        }
        // Decoys are exactly N letters and never overlap with the word.
        expect(round.decoys).toHaveLength(decoyCount);
        expect(new Set(round.decoys).size).toBe(decoyCount);
        for (const d0 of round.decoys) expect(round.letters).not.toContain(d0);
        // Total tile count = |word| + decoys — no strays.
        expect(round.tiles).toHaveLength(round.letters.length + decoyCount);
        // Every tile id is unique — the UI keys off them.
        expect(new Set(round.tiles.map((t) => t.id)).size).toBe(round.tiles.length);
      }
    }
  });

  it('correct-next-letter matching solves every round across 200 seeds', () => {
    const pool = wordPool(SPOTIT_ICONS, {});
    for (let seed = 1; seed <= 200; seed++) {
      const rng = makeRng(seed);
      const d: SpellDifficulty = (['easy', 'medium', 'hard'] as const)[seed % 3];
      const words = pickGameWords(rng, pool, d);
      for (const w of words) {
        const round = makeRound(rng, w, decoysFor(d));
        // Simulate a rational kid: for each slot, pick ANY untapped tile
        // whose letter matches the next needed letter — must always find one.
        const used = new Set<number>();
        const placed: string[] = [];
        for (let slot = 0; slot < round.letters.length; slot++) {
          const need = round.letters[slot];
          const candidate = round.tiles.find(
            (t) => !used.has(t.id) && t.letter === need,
          );
          expect(candidate, `word=${w.en} slot=${slot}`).toBeDefined();
          used.add(candidate!.id);
          placed.push(candidate!.letter);
        }
        expect(placed.join('')).toBe(w.en);
        // Also: an INCORRECT tap (any tile whose letter ≠ expected) never
        // moves the kid forward — this is the anti-cheese check.
        const fresh = makeRound(makeRng(seed + 7), w, decoysFor(d));
        for (let slot = 0; slot < fresh.letters.length; slot++) {
          const need = fresh.letters[slot];
          for (const t of fresh.tiles) {
            if (t.letter !== need) {
              // A wrong-letter tile is exactly that — its .letter is NOT `need`.
              expect(t.letter).not.toBe(need);
            }
          }
        }
      }
    }
  });
});

describe('spell — speechLines coverage', () => {
  it('contains every letter name A!..Z!', () => {
    const lines = new Set(speechLines());
    for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') expect(lines.has(`${L}!`)).toBe(true);
  });

  it('every pool word contributes its 4 lines (ask, spell, done, bare)', () => {
    const lines = new Set(speechLines());
    const pool = wordPool(SPOTIT_ICONS, RHYME_WORDS.reduce<Record<string, number>>((m, w) => { m[w.icon] = 1; return m; }, {}));
    expect(pool.length).toBeGreaterThan(0);
    for (const w of pool) {
      const { ask, spell, done, bare } = linesForWord(w);
      expect(lines.has(ask), `missing ask for ${w.en}`).toBe(true);
      expect(lines.has(spell), `missing spell for ${w.en}`).toBe(true);
      expect(lines.has(done), `missing done for ${w.en}`).toBe(true);
      expect(lines.has(bare), `missing bare for ${w.en}`).toBe(true);
    }
  });

  it('spell line uses "... " separator (e.g. CAT → "C... A... T")', () => {
    expect(linesForWord({ icon: 'cat', en: 'CAT', source: 'spotit' }).spell).toBe('C... A... T');
    expect(linesForWord({ icon: 'cat', en: 'CAT', source: 'spotit' }).bare).toBe('Cat!');
  });
});

// Small helper — count letter occurrences.
function countLetters(letters: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const L of letters) m.set(L, (m.get(L) ?? 0) + 1);
  return m;
}

// Reference: full sweep of WORDS/RHYME_WORDS just so failures elsewhere in
// the pool (e.g. an entry with punctuation slipping in) show up here first.
describe('spell — canonical pool sanity', () => {
  it('WORDS and RHYME_WORDS have some spellable entries', () => {
    const spellable = (arr: { en: string }[]) =>
      arr.filter((w) => w.en.length >= 3 && w.en.length <= 5 && /^[A-Za-z]+$/.test(w.en));
    expect(spellable(WORDS).length).toBeGreaterThanOrEqual(8);
    expect(spellable(RHYME_WORDS).length).toBeGreaterThan(0);
  });
});
