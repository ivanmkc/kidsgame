import { Platform } from 'react-native';

export type Difficulty = 'easy' | 'medium' | 'hard';
/** Menu filter: 'all' shows every level (round games play medium rules). */
export type DifficultyFilter = 'all' | Difficulty;

const KEY = 'kgb.filter.v1';
const LEGACY_KEY = 'kgb.difficulty.v1';

export function loadFilter(): DifficultyFilter {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const v = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (v === 'all' || v === 'easy' || v === 'medium' || v === 'hard') return v;
  }
  return 'all';
}

export function saveFilter(f: DifficultyFilter): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(KEY, f); } catch { /* non-fatal */ }
  }
}

/** Round games need a concrete difficulty; 'all' plays as medium. */
export function difficultyOf(f: DifficultyFilter): Difficulty {
  return f === 'all' ? 'medium' : f;
}

export interface DifficultySettings {
  label: string;
  emoji: string;
  spotitRounds: number;
  memoryPairs: number;
  puzzleCols: number;
  puzzleRows: number;
  diffHint: boolean; // easy players get a 💡 button that flashes one answer
  timer: boolean;    // easy mode is pressure-free: no visible timer
  rulesRounds: number;
  rulesTiles: number;
  rulesRecallFrom: number; // round index where memory-check rounds may start (Infinity = never)
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy', emoji: '😊',
    spotitRounds: 10, memoryPairs: 4,
    puzzleCols: 3, puzzleRows: 2,
    diffHint: true, timer: false,
    rulesRounds: 10, rulesTiles: 6, rulesRecallFrom: Infinity,
  },
  medium: {
    label: 'Medium', emoji: '🌟',
    spotitRounds: 12, memoryPairs: 6,
    puzzleCols: 3, puzzleRows: 3,
    diffHint: false, timer: true,
    rulesRounds: 10, rulesTiles: 8, rulesRecallFrom: 6,
  },
  hard: {
    label: 'Hard', emoji: '🔥',
    spotitRounds: 14, memoryPairs: 8,
    puzzleCols: 4, puzzleRows: 3,
    diffHint: false, timer: true,
    rulesRounds: 10, rulesTiles: 9, rulesRecallFrom: 3,
  },
};

export function settingsFor(d: Difficulty | undefined): DifficultySettings {
  return DIFFICULTIES[d ?? 'medium'];
}

export const FILTERS: { id: DifficultyFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🎨' },
  { id: 'easy', label: 'Easy', emoji: '😊' },
  { id: 'medium', label: 'Medium', emoji: '🌟' },
  { id: 'hard', label: 'Hard', emoji: '🔥' },
];

export function inFilter(level: Difficulty | undefined, f: DifficultyFilter): boolean {
  return f === 'all' || !level || level === f;
}
