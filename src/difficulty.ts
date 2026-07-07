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
  diffDraw: number;   // differences drawn per play from the scene pool
  hiddenDraw: number; // targets drawn per play from the scene pool
  timer: boolean;    // easy mode is pressure-free: no visible timer
  rulesRounds: number;
  rulesTiles: number;
  rulesRecallFrom: number; // round index where memory-check rounds may start (Infinity = never)
  duelWins: number;     // Spot-It duel: stars to win the match
  duelHintSecs: number; // Spot-It duel: sparkle hint delay for a kid trailing by >=2
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy', emoji: '😊',
    spotitRounds: 10, memoryPairs: 4,
    puzzleCols: 3, puzzleRows: 2,
    diffHint: true, timer: false,
    diffDraw: 3, hiddenDraw: 5,
    rulesRounds: 10, rulesTiles: 6, rulesRecallFrom: Infinity,
    duelWins: 3, duelHintSecs: 3,
  },
  medium: {
    label: 'Medium', emoji: '🌟',
    spotitRounds: 12, memoryPairs: 6,
    puzzleCols: 3, puzzleRows: 3,
    diffHint: false, timer: true,
    diffDraw: 4, hiddenDraw: 6,
    rulesRounds: 10, rulesTiles: 8, rulesRecallFrom: 6,
    duelWins: 5, duelHintSecs: 4,
  },
  hard: {
    label: 'Hard', emoji: '🔥',
    spotitRounds: 14, memoryPairs: 8,
    puzzleCols: 4, puzzleRows: 3,
    diffHint: false, timer: true,
    diffDraw: 4, hiddenDraw: 6,
    rulesRounds: 10, rulesTiles: 9, rulesRecallFrom: 3,
    duelWins: 7, duelHintSecs: 5,
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

const LEVEL_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

/** Sort scenes for the Next button: gentler levels first, harder later. */
export function byLevel<T extends { level?: Difficulty }>(scenes: T[]): T[] {
  return [...scenes].sort((a, b) => LEVEL_ORDER[a.level ?? 'medium'] - LEVEL_ORDER[b.level ?? 'medium']);
}

/** Next-scene progression: gentlest levels first, wrap around. */
export function nextSceneId<T extends { id: string; level?: Difficulty }>(
  all: T[], visible: T[], currentId: string,
): string {
  const pool = byLevel(visible.some((s) => s.id === currentId) ? visible : all);
  const ids = pool.map((s) => s.id);
  return ids[(ids.indexOf(currentId) + 1) % ids.length];
}

export function nextFilter(f: DifficultyFilter): DifficultyFilter {
  const order = FILTERS.map((x) => x.id);
  return order[(order.indexOf(f) + 1) % order.length];
}
