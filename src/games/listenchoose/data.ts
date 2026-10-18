import { RHYME_WORDS, WORDS } from '../../words';

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
  'cat',
  'dog',
  'fox',
  'frog',
  'lion',
  'panda',
  'rabbit',
  'bat',
  'bear',
  'bee',
  'boat',
  'box',
  'bun',
  'cake',
  'clock',
  'coat',
  'goat',
  'hat',
  'house',
  'jar',
] as const;

const ALL_WORDS_BY_ID = new Map<string, Word>([...WORDS, ...RHYME_WORDS].map((w) => [w.icon, w]));

export const LEVEL_1_WORDS: Word[] = LEVEL_1_WORD_IDS.map((id) => {
  const entry = ALL_WORDS_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Word ID not found in shared pool: ${id}`);
  }
  return entry;
});
