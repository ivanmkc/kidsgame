import { Rng, randInt, shuffle } from '../../rng';

// Themed pools keep each scene coherent (a farm, a sea, a party...).
export const THEMES: { name: string; pool: string[] }[] = [
  { name: 'Farm', pool: ['🐄', '🐖', '🐓', '🐑', '🐴', '🦆', '🌽', '🚜', '🌻', '🐕', '🐈', '🐇'] },
  { name: 'Ocean', pool: ['🐠', '🐙', '🦀', '🐬', '🐢', '🦈', '🐡', '⛵', '🐚', '🌊', '🦞', '🐳'] },
  { name: 'Party', pool: ['🎈', '🎂', '🎁', '🎉', '🧁', '🍭', '🎀', '🪅', '🍰', '🎊', '🕯️', '🍬'] },
  { name: 'Space', pool: ['🚀', '🛸', '⭐', '🌙', '☄️', '🪐', '👽', '🌟', '🔭', '🛰️', '🌍', '💫'] },
];

export const GRID_COLS = 4;
export const GRID_ROWS = 3;
export const NUM_DIFFS = 4;

export interface SceneCell {
  emoji: string; // '' = empty cell
  jx: number; // jitter 0..1 within cell
  jy: number;
  scale: number; // 0.8..1.2
}

export interface DiffPuzzle {
  theme: string;
  left: SceneCell[]; // GRID_COLS*GRID_ROWS cells
  right: SceneCell[];
  diffs: number[]; // cell indices that differ
}

export function buildPuzzle(rng: Rng): DiffPuzzle {
  const theme = THEMES[randInt(rng, THEMES.length)];
  const total = GRID_COLS * GRID_ROWS;
  // Draw the scene from 9 of the 12 theme emoji so some stay unused,
  // keeping the "object swapped" difference type possible.
  const pool = shuffle(rng, theme.pool).slice(0, 9);

  const left: SceneCell[] = [];
  for (let i = 0; i < total; i++) {
    left.push({
      emoji: pool[i % pool.length],
      jx: 0.15 + rng() * 0.7,
      jy: 0.15 + rng() * 0.7,
      scale: 0.8 + rng() * 0.4,
    });
  }

  const right = left.map((c) => ({ ...c }));
  const diffCells = shuffle(rng, Array.from({ length: total }, (_, i) => i)).slice(0, NUM_DIFFS);
  const unused = theme.pool.filter((e) => !left.some((c) => c.emoji === e));

  for (const idx of diffCells) {
    const kind = randInt(rng, unused.length > 0 ? 2 : 1);
    if (kind === 1 && unused.length > 0) {
      right[idx].emoji = unused.pop()!; // swapped for a different object
    } else {
      right[idx].emoji = ''; // object disappeared
    }
  }

  return { theme: theme.name, left, right, diffs: diffCells.sort((a, b) => a - b) };
}
