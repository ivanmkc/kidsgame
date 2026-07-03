import { Difficulty } from './profile';

export interface DifficultySettings {
  label: string;
  emoji: string;
  spotitRounds: number;
  memoryPairs: number;
  puzzleCols: number;
  puzzleRows: number;
  diffHint: boolean; // easy players get a 💡 button that flashes one answer
  hiddenSilhouette: boolean; // hard players see shadow chips, not full cutouts
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy', emoji: '😊',
    spotitRounds: 3, memoryPairs: 4,
    puzzleCols: 3, puzzleRows: 2,
    diffHint: true, hiddenSilhouette: false,
  },
  medium: {
    label: 'Medium', emoji: '🌟',
    spotitRounds: 5, memoryPairs: 6,
    puzzleCols: 3, puzzleRows: 3,
    diffHint: false, hiddenSilhouette: false,
  },
  hard: {
    label: 'Hard', emoji: '🔥',
    spotitRounds: 7, memoryPairs: 8,
    puzzleCols: 4, puzzleRows: 3,
    diffHint: false, hiddenSilhouette: true,
  },
};

export function settingsFor(d: Difficulty | undefined): DifficultySettings {
  return DIFFICULTIES[d ?? 'easy'];
}
