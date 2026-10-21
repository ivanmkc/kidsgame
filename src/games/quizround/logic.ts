// Shared prompt-round engine: spoken prompt -> tap the right tile.
// Powers Letter Hunt, Number Hunt, First Sounds/Words, Rhyme Time.
import { Rng } from "../../rng";

export interface QuizTile {
  key: string;
  label?: string;
  icon?: string;
}

export interface QuizRound<T> {
  target: T;
  tiles: QuizTile[];
  answerIdx: number;
}

/** Pick a target + distractors from a pool; no duplicate tiles; answer
 *  position uniformly random. `confusable` biases distractor choice
 *  (e.g. E/F/B/P letter shapes) — falls back to random pool fill. */
export function makeQuizRound<T>(
  rng: Rng,
  pool: T[],
  tileCount: number,
  toTile: (x: T) => QuizTile,
  keyOf: (x: T) => string,
  confusable?: (target: T, x: T) => boolean,
  avoidTargetKey?: string,
): QuizRound<T> {
  const uniqueKeys = new Set(pool.map(keyOf)).size;
  if (uniqueKeys < tileCount) {
    throw new Error(
      `pool smaller than tileCount (${uniqueKeys} < ${tileCount})`,
    );
  }
  const filtered = avoidTargetKey
    ? pool.filter((x) => keyOf(x) !== avoidTargetKey)
    : pool;
  const candidates = filtered.length > 0 ? filtered : pool;
  const target = candidates[Math.floor(rng() * candidates.length)];
  const others = pool.filter((x) => keyOf(x) !== keyOf(target));
  const preferred = confusable
    ? others.filter((x) => confusable(target, x))
    : [];
  const rest = others.filter((x) => !preferred.includes(x));
  const shuffle = <A>(a: A[]) =>
    a
      .map((v) => [rng(), v] as const)
      .sort((p, q) => p[0] - q[0])
      .map(([, v]) => v);
  const seenKeys = new Set<string>();
  const distractors: T[] = [];
  for (const item of [...shuffle(preferred), ...shuffle(rest)]) {
    if (distractors.length >= tileCount - 1) {
      break;
    }
    const key = keyOf(item);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      distractors.push(item);
    }
  }
  const tiles = shuffle([target, ...distractors]).map(toTile);
  const answerIdx = tiles.findIndex((t) => t.key === keyOf(target));
  return { target, tiles, answerIdx };
}

// Clamped sprite placement: positions are % of the stage, but a sprite has
// EXTENT — near an edge the center must pull in by half the sprite or the
// art clips outside the stage (landscape stages get very short). `inset`
// pulls inward from stage edges to clear rounded corners or badges.
export function spriteLT(
  pxPct: number,
  pyPct: number,
  size: number,
  stageW: number,
  stageH: number,
  inset = 0,
): { left: number; top: number } {
  const innerW = Math.max(0, stageW - inset * 2);
  const innerH = Math.max(0, stageH - inset * 2);
  const half = size / 2;
  const cx = Math.min(
    Math.max((pxPct / 100) * innerW, half),
    Math.max(half, innerW - half),
  );
  const cy = Math.min(
    Math.max((pyPct / 100) * innerH, half),
    Math.max(half, innerH - half),
  );
  return { left: cx - half + inset, top: cy - half + inset };
}
