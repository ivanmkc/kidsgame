import { RHYME_WORDS, WORDS } from "../../words";

export interface Word {
  icon: string;
  en: string;
  letter: string;
  sound: string;
  rhymeKey?: string;
  nameTwins?: string[];
  altSounds?: string[];
  ja?: string;
  jaR?: string;
  cmn?: string;
  cmnR?: string;
  yue?: string;
  yueR?: string;
}

export const LEVEL_1_WORD_IDS = [
  "cat",
  "dog",
  "fox",
  "frog",
  "lion",
  "panda",
  "rabbit",
  "bat",
  "bear",
  "bee",
  "boat",
  "box",
  "bun",
  "cake",
  "clock",
  "coat",
  "goat",
  "hat",
  "house",
  "jar",
] as const;

const ALL_WORDS_BY_ID = new Map<string, Word>(
  [...WORDS, ...RHYME_WORDS].map((w) => [w.icon, w]),
);

export const LEVEL_1_WORDS: Word[] = LEVEL_1_WORD_IDS.map((id) => {
  const entry = ALL_WORDS_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Word ID not found in shared pool: ${id}`);
  }
  return entry;
});

export const LEVEL_2_WORD_IDS = [
  "moon",
  "mouse",
  "pear",
  "rock",
  "snail",
  "snake",
  "sock",
  "spoon",
  "sun",
  "tree",
  "whale",
] as const;

export const LEVEL_2_WORDS: Word[] = LEVEL_2_WORD_IDS.map((id) => {
  const entry = ALL_WORDS_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Word ID not found in shared pool: ${id}`);
  }
  return entry;
});

export const LEVEL_3_WORD_IDS = [
  "hat",
  "bat",
  "cat",
  "house",
  "mouse",
  "boat",
  "coat",
  "rock",
  "sock",
  "clock",
  "bear",
  "pear",
] as const;

export const LEVEL_3_WORDS: Word[] = LEVEL_3_WORD_IDS.map((id) => {
  const entry = ALL_WORDS_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Word ID not found in shared pool: ${id}`);
  }
  return entry;
});

export interface LevelConfig {
  words: Word[];
  numChoices: number;
  prioritizeRhymes: boolean;
}

export function getLevelConfig(level: number): LevelConfig {
  if (level >= 3) {
    return {
      words: Array.from(
        new Set([...LEVEL_1_WORDS, ...LEVEL_2_WORDS, ...LEVEL_3_WORDS]),
      ),
      numChoices: 4,
      prioritizeRhymes: true,
    };
  } else if (level === 2) {
    return {
      words: Array.from(new Set([...LEVEL_1_WORDS, ...LEVEL_2_WORDS])),
      numChoices: 3,
      prioritizeRhymes: false,
    };
  }
  return {
    words: LEVEL_1_WORDS,
    numChoices: 2,
    prioritizeRhymes: false,
  };
}
