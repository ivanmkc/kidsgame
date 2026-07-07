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

/** Shadow Match: medium+ turns on mental rotation and confusable same-category options. */
export function shadowSettings(d: Difficulty): { choices: number; categoryDistractors: boolean; transform: boolean } {
  if (d === 'hard') return { choices: 5, categoryDistractors: true, transform: true };
  if (d === 'medium') return { choices: 4, categoryDistractors: true, transform: true };
  return { choices: 3, categoryDistractors: false, transform: false };
}

/** Odd One Out: "which one does not belong?" — always categorical; harder = more items. */
export function oddSettings(d: Difficulty): { n: number } {
  if (d === 'hard') return { n: 9 };
  if (d === 'medium') return { n: 6 };
  return { n: 4 };
}

/**
 * Menu-card summary of what the selected difficulty means for one game,
 * derived from the same settings the game plays with (so it can't drift).
 * null = free play, difficulty doesn't apply.
 */
export function cardDetail(route: string, f: DifficultyFilter): string | null {
  const d = difficultyOf(f);
  const s = DIFFICULTIES[d];
  switch (route) {
    case 'spotit': return `${s.spotitRounds} rounds${s.timer ? ' · ⏱️' : ''}`;
    case 'diff': return `${s.diffDraw} differences${s.diffHint ? ' · 💡 hints' : ''}`;
    case 'hidden': return `${s.hiddenDraw} hidden things`;
    case 'memory': return `${s.memoryPairs} pairs`;
    case 'puzzle': return `${s.puzzleCols}×${s.puzzleRows} pieces`;
    case 'shadow': {
      const sh = shadowSettings(d);
      return `${sh.choices} shadows${sh.transform ? ' · spinning' : ''}`;
    }
    case 'oddone': return `${oddSettings(d).n} tiles`;
    case 'rules': return `${s.rulesTiles} tiles${s.rulesRecallFrom !== Infinity ? ' · memory check' : ''}`;
    default: return null;
  }
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
