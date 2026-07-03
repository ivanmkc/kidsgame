import { Rng, randInt, shuffle } from '../../rng';

export const SCENE_POOLS: { name: string; targets: string[]; fillers: string[] }[] = [
  {
    name: 'Toy Box',
    targets: ['🧸', '🪀', '🎲', '🪁', '🧩'],
    fillers: ['🚂', '🏀', '🎺', '🥁', '🪆', '🎨', '📚', '✏️', '🖍️', '🎯'],
  },
  {
    name: 'Jungle',
    targets: ['🦜', '🐍', '🦥', '🐆', '🦎'],
    fillers: ['🌴', '🌺', '🍃', '🦋', '🐒', '🌿', '🪲', '🍌', '🌳', '🐸'],
  },
  {
    name: 'Kitchen',
    targets: ['🥄', '🧀', '🍇', '🥕', '🍪'],
    fillers: ['🍞', '🥛', '🍳', '🥗', '🍅', '🧂', '🥔', '🍋', '🫖', '🥐'],
  },
];

export const HIDDEN_COLS = 5;
export const HIDDEN_ROWS = 7;

export interface HiddenCell {
  emoji: string;
  isTarget: boolean;
  jx: number;
  jy: number;
  scale: number;
  rot: number; // degrees, slight tilt makes targets harder to spot
}

export interface HiddenPuzzle {
  scene: string;
  targets: string[];
  cells: HiddenCell[];
}

// Each target appears exactly once; fillers may repeat but never collide with targets.
export function buildHiddenPuzzle(rng: Rng): HiddenPuzzle {
  const pool = SCENE_POOLS[randInt(rng, SCENE_POOLS.length)];
  const total = HIDDEN_COLS * HIDDEN_ROWS;
  const targetSlots = shuffle(rng, Array.from({ length: total }, (_, i) => i)).slice(
    0,
    pool.targets.length
  );

  const cells: HiddenCell[] = [];
  for (let i = 0; i < total; i++) {
    const t = targetSlots.indexOf(i);
    const emoji = t >= 0 ? pool.targets[t] : pool.fillers[randInt(rng, pool.fillers.length)];
    cells.push({
      emoji,
      isTarget: t >= 0,
      jx: 0.1 + rng() * 0.8,
      jy: 0.1 + rng() * 0.8,
      scale: 0.75 + rng() * 0.5,
      rot: Math.round((rng() - 0.5) * 40),
    });
  }

  return { scene: pool.name, targets: pool.targets.slice(), cells };
}
