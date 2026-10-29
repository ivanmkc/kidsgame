import { Lang } from "../../lang";
import { RHYME_WORDS, WORDS } from "../../curriculum/content";
import { WORD_LEVELS } from "../../curriculum/content";

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

export const LEVEL_1_WORD_IDS: readonly string[] = WORD_LEVELS.level1;
export const LEVEL_2_WORD_IDS: readonly string[] = WORD_LEVELS.level2;
export const LEVEL_3_WORD_IDS: readonly string[] = WORD_LEVELS.level3;

const ALL_WORDS_BY_ID = new Map<string, Word>(
  [...WORDS, ...RHYME_WORDS].map((w) => [w.icon, w]),
);

function wordsFromIds(ids: readonly string[]): Word[] {
  return ids.map((id) => {
    const entry = ALL_WORDS_BY_ID.get(id);
    if (!entry) {
      throw new Error(`Word ID not found in shared pool: ${id}`);
    }
    return entry;
  });
}

export const LEVEL_1_WORDS: Word[] = wordsFromIds(LEVEL_1_WORD_IDS);
export const LEVEL_2_WORDS: Word[] = wordsFromIds(LEVEL_2_WORD_IDS);
export const LEVEL_3_WORDS: Word[] = wordsFromIds(LEVEL_3_WORD_IDS);

export interface LevelConfig {
  words: Word[];
  numChoices: number;
  prioritizeRhymes: boolean;
}

export function getLevelConfig(level: number, lang: Lang = "en"): LevelConfig {
  let pool: Word[];
  if (level >= 3) {
    pool = Array.from(
      new Set([...LEVEL_1_WORDS, ...LEVEL_2_WORDS, ...LEVEL_3_WORDS]),
    );
  } else if (level === 2) {
    pool = Array.from(new Set([...LEVEL_1_WORDS, ...LEVEL_2_WORDS]));
  } else {
    pool = LEVEL_1_WORDS;
  }

  if (lang !== "en") {
    pool = pool.filter((w) => !!w[lang as keyof Word]);
  }

  if (level >= 3) {
    return {
      words: pool,
      numChoices: 4,
      prioritizeRhymes: lang === "en",
    };
  } else if (level === 2) {
    return {
      words: pool,
      numChoices: 3,
      prioritizeRhymes: false,
    };
  }
  return {
    words: pool,
    numChoices: 2,
    prioritizeRhymes: false,
  };
}
