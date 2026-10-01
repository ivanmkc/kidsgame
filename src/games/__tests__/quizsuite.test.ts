// Suite that exercises each of the four language-round builders across
// 200 seeds — every round must have unique tiles, a correct answerIdx,
// and the domain-specific invariants (confusables, sound uniqueness,
// same-family single choice, han-tier tiles).
import { describe, expect, it } from 'vitest';
import { Lang } from '../../lang';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import {
  LETTER_CONFUSABLES, LETTER_SOUNDS, KANA_POOL, glyphTwinsOf,
  makeLetterRound, speechLines as letterSpeechLines,
} from '../letters/logic';
import {
  makeNumberRound, settingsForNumbers, speechLines as numberSpeechLines,
} from '../numbers/logic';
import {
  makeSoundsRound, settingsForSounds, speechLines as soundsSpeechLines,
} from '../sounds/logic';
import {
  availableEntries, canPlay, effectiveLang, makeRhymeRound, playableFamilies,
  settingsForRhyme, speechLines as rhymeSpeechLines,
} from '../rhymegame/logic';
import { RHYME_WORDS, WORDS, WordEntry, soundsFor } from '../language/words';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

function letterOf(label: string): string { return label.toUpperCase(); }

describe('letters: quiz round', () => {
  const tiers = ['upper', 'mixed', 'sound', 'kana'] as const;
  const tileCounts = { upper: 6, mixed: 8, sound: 8, kana: 8 } as const;

  it.each(tiers)('%s: tiles are distinct, answerIdx matches, speechLine is enumerated', (tier) => {
    const lines = new Set(letterSpeechLines());
    for (const seed of SEEDS) {
      const r = makeLetterRound(makeRng(seed), tier, tileCounts[tier]);
      expect(r.tiles).toHaveLength(tileCounts[tier]);
      expect(new Set(r.tiles.map((t) => t.key)).size).toBe(r.tiles.length);
      expect(r.tiles[r.answerIdx].isAnswer).toBe(true);
      expect(r.tiles.filter((t) => t.isAnswer)).toHaveLength(1);
      expect(lines.has(r.promptLine)).toBe(true);
    }
  });

  it('mixed tier: no tile is drawn as the target\u2019s look-alike glyph', () => {
    // Capital I and lowercase l are the same bare bar in the display face,
    // and the mixed tier deliberately prefers the I/L/J confusable group —
    // so "Find the letter I!" could put two identical-looking tiles up and
    // score only one of them.
    for (let seed = 1; seed <= 5000; seed++) {
      const r = makeLetterRound(makeRng(seed), 'mixed', 8);
      const twins = new Set(glyphTwinsOf(r.tiles[r.answerIdx].label));
      if (!twins.size) continue;
      for (const [i, tile] of r.tiles.entries()) {
        if (i === r.answerIdx) continue;
        expect(twins.has(tile.label)).toBe(false);
      }
    }
  });

  it('mixed tier: confusable-group distractors appear frequently for confusable targets', () => {
    let confusableWithSameGroupCount = 0;
    let totalConfusableTargets = 0;
    for (const seed of SEEDS) {
      const r = makeLetterRound(makeRng(seed), 'mixed', 8);
      const t = letterOf(r.targetDisplay);
      const group = LETTER_CONFUSABLES.find((g) => g.includes(t));
      if (!group) continue;
      totalConfusableTargets++;
      const distractors = r.tiles.filter((x) => !x.isAnswer).map((x) => letterOf(x.label));
      if (distractors.some((d) => group.includes(d) && d !== t)) confusableWithSameGroupCount++;
    }
    expect(totalConfusableTargets).toBeGreaterThan(0);
    // The bias should be OVERWHELMING — a target with confusables gets
    // them offered essentially every time (subject to pool size).
    expect(confusableWithSameGroupCount / totalConfusableTargets).toBeGreaterThan(0.9);
  });

  it('sound tier: distractors never share the target sound', () => {
    for (const seed of SEEDS) {
      const r = makeLetterRound(makeRng(seed), 'sound', 8);
      const target = LETTER_SOUNDS.find((s) => s.letter === r.targetKey)!;
      const sounds = r.tiles.map((t) => LETTER_SOUNDS.find((s) => s.letter === t.label)?.sound);
      // Every tile is a known sound-letter; target's sound appears exactly once.
      for (const s of sounds) expect(s).toBeDefined();
      expect(sounds.filter((s) => s === target.sound)).toHaveLength(1);
    }
  });

  it('kana tier: every tile is a valid pool member', () => {
    const validKana = new Set(KANA_POOL.map((k) => k.kana));
    for (const seed of SEEDS.slice(0, 100)) {
      const r = makeLetterRound(makeRng(seed), 'kana', 8);
      for (const t of r.tiles) expect(validKana.has(t.label)).toBe(true);
    }
  });

  it('speechLines: non-empty, unique, spans all EN letters + all kana + all sounds', () => {
    const lines = letterSpeechLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
    for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') expect(lines).toContain(`Find the letter ${L}!`);
    for (const k of KANA_POOL) expect(lines).toContain(`「${k.kana}」をさがして！`);
    for (const s of LETTER_SOUNDS) expect(lines).toContain(`Which letter says ${s.sound}?`);
  });
});

describe('numbers: quiz round', () => {
  const langs: Lang[] = ['en', 'ja', 'cmn', 'yue'];
  const diffs = ['easy', 'medium', 'hard'] as const;

  it.each(langs.flatMap((l) => diffs.map((d) => [l, d] as const)))(
    '%s/%s: tiles distinct, in range, answerIdx correct across seeds',
    (lang, d) => {
      const s = settingsForNumbers(d, lang);
      for (const seed of SEEDS.slice(0, 100)) {
        const r = makeNumberRound(makeRng(seed), s, lang);
        expect(r.tiles.length).toBeGreaterThan(0);
        expect(r.tiles.length).toBeLessThanOrEqual(s.tiles);
        expect(new Set(r.tiles.map((t) => t.key)).size).toBe(r.tiles.length);
        for (const t of r.tiles) {
          expect(t.n).toBeGreaterThanOrEqual(s.min);
          expect(t.n).toBeLessThanOrEqual(s.max);
        }
        expect(r.tiles[r.answerIdx].n).toBe(r.targetN);
        expect(r.tiles.filter((t) => t.isAnswer)).toHaveLength(1);
      }
    },
  );

  it.each(['ja', 'cmn', 'yue'] as const)('%s hard tier: han-numeral tiles', (lang) => {
    const s = settingsForNumbers('hard', lang);
    expect(s.useHan).toBe(true);
    const HAN = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
    for (const seed of SEEDS.slice(0, 60)) {
      const r = makeNumberRound(makeRng(seed), s, lang);
      expect(r.useHan).toBe(true);
      for (const t of r.tiles) expect(HAN).toContain(t.label);
    }
  });

  it('en covers 0..20 across the three tiers', () => {
    const easy = settingsForNumbers('easy', 'en');
    const medium = settingsForNumbers('medium', 'en');
    const hard = settingsForNumbers('hard', 'en');
    expect([easy.min, easy.max]).toEqual([0, 5]);
    expect([medium.min, medium.max]).toEqual([0, 9]);
    expect([hard.min, hard.max]).toEqual([0, 20]);
  });

  it('speechLines: non-empty, unique, contains 0..20 EN + non-EN find-words', () => {
    const lines = numberSpeechLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
    for (let n = 0; n <= 20; n++) expect(lines).toContain(`Find the number ${n}!`);
    expect(lines).toContain('さがしてね！');
    expect(lines).toContain('找一找！');
    expect(lines).toContain('搵一搵！');
  });
});

describe('sounds: quiz round', () => {
  const langs: Lang[] = ['en', 'ja', 'cmn', 'yue'];
  const diffs = ['easy', 'medium', 'hard'] as const;

  it.each(langs.flatMap((l) => diffs.map((d) => [l, d] as const)))(
    '%s/%s: tiles distinct, exactly-one answer, no two share a sound',
    (lang, d) => {
      const s = settingsForSounds(d);
      for (const seed of SEEDS.slice(0, 60)) {
        const r = makeSoundsRound(makeRng(seed), manifest.spotit.icons, lang, s.tiles);
        expect(r.tiles).toHaveLength(s.tiles);
        expect(new Set(r.tiles.map((t) => t.key)).size).toBe(r.tiles.length);
        expect(r.tiles.filter((t) => t.isAnswer)).toHaveLength(1);
        // sound-uniqueness invariant — even in non-EN modes where the
        // spoken cue is the localised word, no two tiles carry the same
        // English phonic sound (keeps the round teachable & audible).
        const sounds = r.tiles.map((t) => WORDS.find((w) => w.icon === t.icon)?.sound);
        expect(new Set(sounds).size).toBe(sounds.length);
      }
    },
  );

  it('no distractor can answer the prompt under a name the kid might use', () => {
    // The prompt names ONE first-sound; a picture a kid would call by
    // another name ("bunny" for the rabbit, "soccer ball" for the ball)
    // carries that name's sound too, and must not sit next to the answer.
    // Same for the non-EN word prompts: "\u306f\u306a" must not show two flowers.
    for (const lang of ['en', 'ja', 'cmn', 'yue'] as Lang[]) {
      for (const seed of SEEDS) {
        const r = makeSoundsRound(makeRng(seed), manifest.spotit.icons, lang, 4);
        const answer = WORDS.find((w) => w.icon === r.tiles[r.answerIdx].key)!;
        const twins = new Set(answer.nameTwins ?? []);
        for (const [i, tile] of r.tiles.entries()) {
          if (i === r.answerIdx) continue;
          const w = WORDS.find((x) => x.icon === tile.key)!;
          expect(soundsFor(w)).not.toContain(answer.sound);
          expect(twins.has(w.icon)).toBe(false);
        }
      }
    }
  });

  it('en: prompt line is enumerated in speechLines', () => {
    const lines = new Set(soundsSpeechLines());
    for (const seed of SEEDS.slice(0, 60)) {
      const r = makeSoundsRound(makeRng(seed), manifest.spotit.icons, 'en', 4);
      for (const line of r.promptLines) expect(lines.has(line)).toBe(true);
      for (const line of r.confirmLines) expect(lines.has(line)).toBe(true);
    }
  });

  it('non-en: both spoken lines are enumerated', () => {
    const lines = new Set(soundsSpeechLines());
    for (const lang of ['ja', 'cmn', 'yue'] as const) {
      for (const seed of SEEDS.slice(0, 40)) {
        const r = makeSoundsRound(makeRng(seed), manifest.spotit.icons, lang, 4);
        for (const line of r.promptLines) expect(lines.has(line)).toBe(true);
        for (const line of r.confirmLines) expect(lines.has(line)).toBe(true);
      }
    }
  });

  it('speechLines: non-empty and unique', () => {
    const lines = soundsSpeechLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe('rhyme: quiz round', () => {
  const RHYME_LANGS: Lang[] = ['en', 'ja', 'cmn', 'yue'];
  const iconsList = manifest.spotit.icons;
  const entriesEn = availableEntries('en', iconsList);

  it('has at least two playable EN families with the current asset set', () => {
    expect(canPlay(entriesEn)).toBe(true);
    expect(Object.keys(playableFamilies(entriesEn)).length).toBeGreaterThanOrEqual(2);
  });

  it.each(RHYME_LANGS)('tiles distinct, exactly ONE same-family choice, target NOT in tiles (%s)', (lang) => {
    const entries = availableEntries(lang, iconsList);
    if (!canPlay(entries)) return; // language mode falls back to EN — covered by 'en' iteration.
    for (const seed of SEEDS) {
      const r = makeRhymeRound(makeRng(seed), entries, 3, lang);
      expect(r.tiles).toHaveLength(3);
      expect(new Set(r.tiles.map((t) => t.icon)).size).toBe(3);
      expect(r.tiles.some((t) => t.icon === r.target.icon)).toBe(false);
      const sameFamily = r.tiles.filter((t) => {
        const e = entries.find((x) => x.icon === t.icon)!;
        return e.rhymeKey === r.target.rhymeKey;
      });
      expect(sameFamily).toHaveLength(1);
      expect(sameFamily[0].isAnswer).toBe(true);
      expect(r.tiles.filter((t) => t.isAnswer)).toHaveLength(1);
      expect(r.tiles[r.answerIdx].isAnswer).toBe(true);
    }
  });

  it('speechLines: non-empty, unique, contains prompt+confirm for every round produced (all langs)', () => {
    const lines = new Set(rhymeSpeechLines(iconsList));
    expect(lines.size).toBeGreaterThan(0);
    for (const lang of RHYME_LANGS) {
      const entries = availableEntries(lang, iconsList);
      if (!canPlay(entries)) continue;
      for (const seed of SEEDS.slice(0, 60)) {
        const r = makeRhymeRound(makeRng(seed), entries, 3, lang);
        for (const line of r.promptLines) if (line) expect(lines.has(line)).toBe(true);
        for (const line of r.confirmLines) expect(lines.has(line)).toBe(true);
      }
    }
    // uniqueness
    const asArray = rhymeSpeechLines(iconsList);
    expect(new Set(asArray).size).toBe(asArray.length);
  });

  it('speechLines spans every language whose pool clears the fallback bar', () => {
    const arr = rhymeSpeechLines(iconsList);
    // EN classic celebration
    expect(arr).toContain('They rhyme!');
    // JA/CMN/YUE ask lines — the fixed prompt clip for each mode
    expect(arr).toContain('おなじ おとで おわるのは どれ？');
    expect(arr).toContain('哪个词的结尾一样？');
    expect(arr).toContain('邊個字尾音一樣呀？');
    // A representative celebration line for each non-EN mode
    expect(arr.some((l) => l.endsWith('！おなじ おと！'))).toBe(true);
    expect(arr.some((l) => l.endsWith('！押韵！'))).toBe(true);
    expect(arr.some((l) => l.endsWith('！好啱音！'))).toBe(true);
  });
});

describe('rhyme: per-language families', () => {
  const iconsList = manifest.spotit.icons;
  const RHYME_LANGS: Lang[] = ['en', 'ja', 'cmn', 'yue'];

  it.each(RHYME_LANGS)('%s: every playable-family member shares the family key', (lang) => {
    const entries = availableEntries(lang, iconsList);
    const families = playableFamilies(entries);
    for (const [key, members] of Object.entries(families)) {
      expect(members.length).toBeGreaterThanOrEqual(2);
      for (const m of members) {
        expect(m.rhymeKey, `${lang}: ${m.icon} in family ${key}`).toBe(key);
      }
    }
  });

  it.each(['ja', 'cmn', 'yue'] as const)('%s: pool has ≥3 icon-backed families (no EN fallback)', (lang) => {
    const entries = availableEntries(lang, iconsList);
    const families = playableFamilies(entries);
    expect(Object.keys(families).length).toBeGreaterThanOrEqual(3);
    expect(effectiveLang(lang, iconsList)).toBe(lang);
  });

  it('effectiveLang: EN always stays EN; a starved pool falls back to EN', () => {
    expect(effectiveLang('en', iconsList)).toBe('en');
    // Starve the icon set to just one WORDS entry — no non-EN pool will
    // clear 3 families, so every non-EN mode must fall back to EN.
    const starved = ['dog'];
    for (const lang of ['ja', 'cmn', 'yue'] as const) {
      expect(effectiveLang(lang, starved)).toBe('en');
    }
  });

  it('non-EN pools never draw from RHYME_WORDS (EN-only atlas)', () => {
    const rhymeIcons = new Set(RHYME_WORDS.map((w) => w.icon));
    for (const lang of ['ja', 'cmn', 'yue'] as const) {
      const entries = availableEntries(lang, iconsList);
      for (const e of entries) expect(rhymeIcons.has(e.icon)).toBe(false);
    }
  });

  it('non-EN entries carry native word + romanization; EN entries are bare', () => {
    const en = availableEntries('en', iconsList);
    for (const e of en) {
      expect(e.word).toBe(e.en);
      expect(e.roman).toBe('');
    }
    for (const lang of ['ja', 'cmn', 'yue'] as const) {
      const entries = availableEntries(lang, iconsList);
      if (!entries.length) continue;
      for (const e of entries) {
        expect(e.word.length).toBeGreaterThan(0);
        expect(e.word).not.toBe(e.en);
        expect(e.roman.length).toBeGreaterThan(0);
      }
    }
  });

  // Guard against a wandering finger typing an ambiguous per-lang rhyme
  // key — if two languages ever collided their rhyme namespaces we'd want
  // that surface immediately, but the fields are separate by design so
  // this just documents the shape.
  it('WORDS: per-lang rhyme fields never overlap the EN rhymeKey', () => {
    const enKeys = new Set(WORDS.map((w: WordEntry) => w.rhymeKey).filter(Boolean) as string[]);
    // Non-EN keys are drawn from a completely different vocabulary (kana
    // moras / pinyin finals / Jyutping finals), so no accidental collision
    // is possible today — but if someone later tries to reuse 'og' as a
    // ja key this test breaks first.
    for (const w of WORDS) {
      for (const k of [w.jaRhyme, w.cmnRhyme, w.yueRhyme]) {
        if (!k) continue;
        expect(enKeys.has(k), `${w.icon}: per-lang key '${k}' collides with EN rhymeKey`).toBe(false);
      }
    }
  });
});

describe('rhyme: settings scale with pool size', () => {
  it('≥8 families: easy/medium/hard = 8/10/12 rounds', () => {
    expect(settingsForRhyme('easy', 8)).toEqual({ rounds: 8, tiles: 3 });
    expect(settingsForRhyme('medium', 8)).toEqual({ rounds: 10, tiles: 3 });
    expect(settingsForRhyme('hard', 8)).toEqual({ rounds: 12, tiles: 3 });
    expect(settingsForRhyme('hard', 20)).toEqual({ rounds: 12, tiles: 3 });
  });

  it('lean pool (<8 families): hard tier stays at 10 rounds (no over-replay)', () => {
    expect(settingsForRhyme('easy', 5)).toEqual({ rounds: 8, tiles: 3 });
    expect(settingsForRhyme('medium', 5)).toEqual({ rounds: 10, tiles: 3 });
    expect(settingsForRhyme('hard', 5)).toEqual({ rounds: 10, tiles: 3 });
    expect(settingsForRhyme('hard', 3)).toEqual({ rounds: 10, tiles: 3 });
  });
});
