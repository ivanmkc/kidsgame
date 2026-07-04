import { Platform } from 'react-native';

export type Difficulty = 'easy' | 'medium' | 'hard';

const KEY = 'kgb.difficulty.v1';

export function loadDifficulty(): Difficulty {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const v = window.localStorage.getItem(KEY);
    if (v === 'easy' || v === 'medium' || v === 'hard') return v;
  }
  return 'easy';
}

export function saveDifficulty(d: Difficulty): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(KEY, d); } catch { /* non-fatal */ }
  }
}

export interface DifficultySettings {
  label: string;
  emoji: string;
  spotitRounds: number;
  memoryPairs: number;
  puzzleCols: number;
  puzzleRows: number;
  diffHint: boolean; // easy players get a 💡 button that flashes one answer
  rulesRounds: number;
  rulesTiles: number;
  rulesRecallFrom: number; // round index where memory-check rounds may start (Infinity = never)
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy', emoji: '😊',
    spotitRounds: 3, memoryPairs: 4,
    puzzleCols: 3, puzzleRows: 2,
    diffHint: true,
    rulesRounds: 10, rulesTiles: 6, rulesRecallFrom: Infinity,
  },
  medium: {
    label: 'Medium', emoji: '🌟',
    spotitRounds: 5, memoryPairs: 6,
    puzzleCols: 3, puzzleRows: 3,
    diffHint: false,
    rulesRounds: 10, rulesTiles: 8, rulesRecallFrom: 6,
  },
  hard: {
    label: 'Hard', emoji: '🔥',
    spotitRounds: 7, memoryPairs: 8,
    puzzleCols: 4, puzzleRows: 3,
    diffHint: false,
    rulesRounds: 10, rulesTiles: 9, rulesRecallFrom: 3,
  },
};

export function settingsFor(d: Difficulty | undefined): DifficultySettings {
  return DIFFICULTIES[d ?? 'easy'];
}
