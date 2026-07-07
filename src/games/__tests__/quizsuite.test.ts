// Suite that exercises each of the four language-round builders across
// 200 seeds — every round must have unique tiles, a correct answerIdx,
// and the domain-specific invariants (confusables, sound uniqueness,
// same-family single choice, han-tier tiles).
import { describe, expect, it } from 'vitest';
import { Lang } from '../../lang';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import {
  LETTER_CONFUSABLES, LETTER_SOUNDS, KANA_POOL,
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
import { RHYME_WORDS, WORDS, WordEntry } from '../language/words';

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
  const entries = availableEntries(manifest.spotit.icons);

  it('has at least two playable families with the current asset set', () => {
    expect(canPlay(entries)).toBe(true);
    expect(Object.keys(playableFamilies(entries)).length).toBeGreaterThanOrEqual(2);
  });

  it('tiles distinct, exactly ONE same-family choice, target NOT in tiles', () => {
    for (const seed of SEEDS) {
      const r = makeRhymeRound(makeRng(seed), entries, 3);
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

  it('speechLines: non-empty, unique, contains prompt+confirm for each round produced', () => {
    const lines = new Set(rhymeSpeechLines(manifest.spotit.icons));
    expect(lines.size).toBeGreaterThan(0);
    for (const seed of SEEDS.slice(0, 60)) {
      const r = makeRhymeRound(makeRng(seed), entries, 3);
      expect(lines.has(r.promptLine)).toBe(true);
      for (const line of r.confirmLines) expect(lines.has(line)).toBe(true);
    }
    // uniqueness
    const asArray = rhymeSpeechLines(manifest.spotit.icons);
    expect(new Set(asArray).size).toBe(asArray.length);
  });
});
