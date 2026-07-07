// Rhyme Time — EN-only in every locale (rhyme is an English-phonics
// concept; JA/zh render the same game). Round = target word (spoken +
// icon shown big) + 3 icon tiles: exactly ONE from the target's rhyme
// family, 2 distractors from OTHER families.
import { manifest } from '../../manifest';
import { Rng, shuffle } from '../../rng';
import { RHYME_ICONS } from '../language/rhymeAssets';
import { RHYME_WORDS, WORDS } from '../language/words';

export interface RhymeEntry {
  icon: string;
  en: string;
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
  promptLine: string;         // "Which one rhymes with FROG?"
  confirmLines: string[];     // ["FROG... DOG!", "They rhyme!"]
}

export function settingsForRhyme(difficulty: 'easy' | 'medium' | 'hard'): { rounds: number; tiles: number } {
  if (difficulty === 'easy') return { rounds: 8,  tiles: 3 };
  return                            { rounds: 10, tiles: 3 };
}

/** Icons actually shipped for RHYME_WORDS — RHYME_ICONS may be empty
 *  before the pipeline populates it, so we filter defensively. */
function hasRhymeIcon(icon: string): boolean {
  return Object.prototype.hasOwnProperty.call(RHYME_ICONS, icon);
}

/** All rhyme entries whose icon is actually available. Pass in the sprite
 *  keys for the main atlas (`manifest.spotit.icons`); the rhyme atlas is
 *  read directly so we don't need to plumb it through. */
export function availableEntries(spotitIcons: string[]): RhymeEntry[] {
  const spotitSet = new Set(spotitIcons);
  const out: RhymeEntry[] = [];
  for (const w of WORDS) {
    if (w.rhymeKey && spotitSet.has(w.icon)) {
      out.push({ icon: w.icon, en: w.en, rhymeKey: w.rhymeKey, bucket: 'spotit' });
    }
  }
  for (const w of RHYME_WORDS) {
    if (hasRhymeIcon(w.icon)) {
      out.push({ icon: w.icon, en: w.en, rhymeKey: w.rhymeKey, bucket: 'rhyme' });
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

export function makeRhymeRound(
  rng: Rng, entries: RhymeEntry[], tileCount: number, avoidIcon?: string,
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

  const upper = (s: string) => s.toUpperCase();
  const promptLine = `Which one rhymes with ${upper(target.en)}?`;
  const confirmLines = [`${upper(target.en)}... ${upper(correct.en)}!`, 'They rhyme!'];
  return {
    target, tiles,
    answerIdx: tiles.findIndex((t) => t.isAnswer),
    promptLine, confirmLines,
  };
}

// Every string a Rhyme round could ever speak, given the current icons on
// disk. Enumerating pair lines for EVERY ordered pair inside each family
// keeps the TTS pipeline byte-exact regardless of which member is picked.
// Defaults to the shipped sprite atlas so the TTS-dump tool can call it
// without threading manifest through.
export function speechLines(spotitIcons: string[] = manifest.spotit.icons): string[] {
  const entries = availableEntries(spotitIcons);
  const families = playableFamilies(entries);
  const s = new Set<string>();
  s.add('They rhyme!');
  for (const family of Object.values(families)) {
    for (const t of family) {
      s.add(`Which one rhymes with ${t.en.toUpperCase()}?`);
      for (const c of family) {
        if (c.icon === t.icon) continue;
        s.add(`${t.en.toUpperCase()}... ${c.en.toUpperCase()}!`);
      }
    }
  }
  return [...s];
}
