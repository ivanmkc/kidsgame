// Rhyme Time — language-native sound matching. EN plays the classic
// English rhyme pool (og/at/ake…); JA/CMN/YUE build their OWN families
// off the final mora / pinyin final / Jyutping final in words.ts. Each
// language falls back to EN if it can't muster ≥3 icon-backed families
// (kids never get a two-family game). Round = target icon + spoken ask,
// plus 3 icon tiles: exactly ONE from the target's family, 2 distractors.
import { Lang } from '../../lang';
import { manifest } from '../../manifest';
import { Rng, shuffle } from '../../rng';
import { RHYME_ICONS } from '../language/rhymeAssets';
import { RHYME_WORDS, WORDS, WordEntry, wordFor } from '../language/words';

export interface RhymeEntry {
  icon: string;
  en: string;           // canonical English label (for logging / EN prompts)
  word: string;         // spoken/displayed word (native for non-EN)
  roman: string;        // parent romanization ('' for EN)
  rhymeKey: string;
  bucket: 'spotit' | 'rhyme'; // which sprite atlas holds the icon
}

export interface RhymeTile {
  key: string;
  icon: string;
  bucket: 'spotit' | 'rhyme';
  isAnswer: boolean;
}

export interface RhymeRound {
  target: RhymeEntry;
  tiles: RhymeTile[];
  answerIdx: number;
  displayPrompt: string;   // shown on the prompt card
  caption?: string;        // parent-facing romanization (non-EN)
  promptLines: string[];   // spoken via saySequence
  confirmLines: string[];  // spoken after a correct tap (celebration)
}

// Localised ask lines. EN builds the full sentence with the target word
// baked in; non-EN pairs a fixed question with the target word as a
// second spoken clip (reused from Sounds' TTS dump).
const ASK: Record<Lang, string> = {
  en: '',
  ja: 'おなじ おとで おわるのは どれ？',
  cmn: '哪个词的结尾一样？',
  yue: '邊個字尾音一樣呀？',
};

function hasRhymeIcon(icon: string): boolean {
  return Object.prototype.hasOwnProperty.call(RHYME_ICONS, icon);
}

function rhymeKeyFor(w: WordEntry, lang: Lang): string | undefined {
  if (lang === 'en') return w.rhymeKey;
  if (lang === 'ja') return w.jaRhyme;
  if (lang === 'cmn') return w.cmnRhyme;
  return w.yueRhyme; // yue
}

/** Icon-backed entries for the language's rhyme pool. RHYME_WORDS are
 *  EN-only (no localised translations exist) — non-EN pools draw solely
 *  from WORDS entries whose per-lang rhyme key is set. */
export function availableEntries(lang: Lang, spotitIcons: string[]): RhymeEntry[] {
  const spotitSet = new Set(spotitIcons);
  const out: RhymeEntry[] = [];
  for (const w of WORDS) {
    const key = rhymeKeyFor(w, lang);
    if (!key || !spotitSet.has(w.icon)) continue;
    const loc = wordFor(w, lang);
    out.push({
      icon: w.icon, en: w.en,
      word: lang === 'en' ? w.en : loc.text,
      roman: lang === 'en' ? '' : loc.roman,
      rhymeKey: key, bucket: 'spotit',
    });
  }
  if (lang === 'en') {
    for (const w of RHYME_WORDS) {
      if (!hasRhymeIcon(w.icon)) continue;
      out.push({
        icon: w.icon, en: w.en, word: w.en, roman: '',
        rhymeKey: w.rhymeKey, bucket: 'rhyme',
      });
    }
  }
  return out;
}

/** Rhyme families with at least 2 icons on disk — a family with just one
 *  icon has no possible partner, so it's not playable at all. */
export function playableFamilies(entries: RhymeEntry[]): Record<string, RhymeEntry[]> {
  const buckets: Record<string, RhymeEntry[]> = {};
  for (const e of entries) (buckets[e.rhymeKey] ??= []).push(e);
  const out: Record<string, RhymeEntry[]> = {};
  for (const [k, v] of Object.entries(buckets)) if (v.length >= 2) out[k] = v;
  return out;
}

export function canPlay(entries: RhymeEntry[]): boolean {
  // Need one target's family (≥2 icons) AND at least one other family for
  // distractors — otherwise every tile shares the target's rhyme.
  return Object.keys(playableFamilies(entries)).length >= 2;
}

/** A non-EN pool with fewer than 3 icon-backed families would leave kids
 *  with 2 or fewer possible targets — a thin, repetitive game. Fall back
 *  to the EN pool for that mode instead (never crash, never a thin game).
 *  EN itself always stays EN. */
export function effectiveLang(lang: Lang, spotitIcons: string[]): Lang {
  if (lang === 'en') return 'en';
  const entries = availableEntries(lang, spotitIcons);
  return Object.keys(playableFamilies(entries)).length >= 3 ? lang : 'en';
}

/** Rounds scale with pool size — 8/10/12 for the full pool (≥8 families
 *  is enough to keep 12 rounds novel), 8/10/10 for a leaner pool so the
 *  hard tier doesn't just replay the same handful of families twice. */
export function settingsForRhyme(
  difficulty: 'easy' | 'medium' | 'hard', familyCount: number,
): { rounds: number; tiles: number } {
  if (familyCount >= 8) {
    if (difficulty === 'easy') return { rounds: 8, tiles: 3 };
    if (difficulty === 'hard') return { rounds: 12, tiles: 3 };
    return { rounds: 10, tiles: 3 };
  }
  if (difficulty === 'easy') return { rounds: 8, tiles: 3 };
  return { rounds: 10, tiles: 3 };
}

function upperEN(s: string): string { return s.toUpperCase(); }

function buildLines(lang: Lang, target: RhymeEntry, correct: RhymeEntry): {
  promptLines: string[]; displayPrompt: string; caption?: string; confirmLines: string[];
} {
  if (lang === 'en') {
    const tU = upperEN(target.en);
    const cU = upperEN(correct.en);
    const line = `Which one rhymes with ${tU}?`;
    return {
      promptLines: [line], displayPrompt: line,
      confirmLines: [`${tU}... ${cU}!`, 'They rhyme!'],
    };
  }
  const ask = ASK[lang];
  // Two-clip prompt: fixed ask + target word (reuses per-word clips that
  // the Sounds pipeline already renders — no new TTS work per target).
  const promptLines = [ask, target.word];
  const displayPrompt = `${ask} ${target.word}`;
  let confirmLines: string[];
  if (lang === 'ja') confirmLines = [`${target.word}、${correct.word}！おなじ おと！`];
  else if (lang === 'cmn') confirmLines = [`${target.word}，${correct.word}！押韵！`];
  else confirmLines = [`${target.word}，${correct.word}！好啱音！`]; // yue
  return { promptLines, displayPrompt, caption: target.roman || undefined, confirmLines };
}

export function makeRhymeRound(
  rng: Rng, entries: RhymeEntry[], tileCount: number, lang: Lang, avoidIcon?: string,
): RhymeRound {
  const families = playableFamilies(entries);
  const familyKeys = Object.keys(families);
  if (familyKeys.length < 2) {
    throw new Error('Not enough rhyme families to build a round');
  }
  // Pick a family, then a target from it (avoiding the previous target).
  const targetFamily = familyKeys[Math.floor(rng() * familyKeys.length)];
  const familyMembers = families[targetFamily];
  const targetCandidates = familyMembers.filter((e) => e.icon !== avoidIcon);
  const target = (targetCandidates.length ? targetCandidates : familyMembers)[
    Math.floor(rng() * (targetCandidates.length || familyMembers.length))
  ];

  // Correct: any DIFFERENT icon in the same family.
  const sameFamily = shuffle(rng, familyMembers.filter((e) => e.icon !== target.icon));
  const correct = sameFamily[0];

  // Distractors: (tileCount - 1) icons from OTHER families. Prefer one
  // per family for variety, then backfill from the same pools if we ran
  // out of family variety.
  const needed = tileCount - 1; // total tiles − 1 correct = distractors (target lives in the prompt card)
  const otherFamilyKeys = shuffle(rng, familyKeys.filter((k) => k !== targetFamily));
  const distractors: RhymeEntry[] = [];
  const takenIcons = new Set<string>([target.icon, correct.icon]);
  for (const k of otherFamilyKeys) {
    if (distractors.length >= needed) break;
    const pool = shuffle(rng, families[k]).filter((e) => !takenIcons.has(e.icon));
    if (!pool.length) continue;
    distractors.push(pool[0]);
    takenIcons.add(pool[0].icon);
  }
  if (distractors.length < needed) {
    const backfill = shuffle(rng, otherFamilyKeys.flatMap((k) => families[k]))
      .filter((e) => !takenIcons.has(e.icon));
    for (const e of backfill) {
      if (distractors.length >= needed) break;
      distractors.push(e);
      takenIcons.add(e.icon);
    }
  }

  // The target itself lives in the prompt card, NOT in the tiles — tiles
  // are the correct-family partner + distinct other-family distractors.
  const tileEntries = shuffle(rng, [correct, ...distractors]).slice(0, tileCount);
  const tiles: RhymeTile[] = tileEntries.map((e) => ({
    key: e.icon, icon: e.icon, bucket: e.bucket, isAnswer: e.icon === correct.icon,
  }));

  const { promptLines, displayPrompt, caption, confirmLines } = buildLines(lang, target, correct);
  return {
    target, tiles,
    answerIdx: tiles.findIndex((t) => t.isAnswer),
    displayPrompt, caption, promptLines, confirmLines,
  };
}

// Every string a Rhyme round could ever speak, across all four language
// modes and their icon-backed rhyme families. Enumerating pair lines for
// every ordered pair inside each family keeps the TTS pipeline byte-exact
// regardless of which member is picked. A non-EN pool that would fall
// back to EN contributes no lines (it plays the EN prompts, already
// enumerated). Defaults to the shipped sprite atlas so the TTS-dump tool
// can call it without threading manifest through.
export function speechLines(spotitIcons: string[] = manifest.spotit.icons): string[] {
  const s = new Set<string>();
  for (const lang of ['en', 'ja', 'cmn', 'yue'] as const) {
    const entries = availableEntries(lang, spotitIcons);
    const families = playableFamilies(entries);
    if (lang !== 'en' && Object.keys(families).length < 3) continue;
    for (const family of Object.values(families)) {
      for (const target of family) {
        for (const correct of family) {
          if (correct.icon === target.icon) continue;
          const built = buildLines(lang, target, correct);
          for (const line of built.promptLines) if (line) s.add(line);
          for (const line of built.confirmLines) s.add(line);
        }
      }
    }
  }
  return [...s];
}
