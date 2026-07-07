// Shared prompt-round engine: spoken prompt -> tap the right tile.
// Powers Letter Hunt, Number Hunt, First Sounds/Words, Rhyme Time.
import { Rng } from '../../rng';

export interface QuizTile { key: string; label?: string; icon?: string }

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
  const candidates = avoidTargetKey ? pool.filter((x) => keyOf(x) !== avoidTargetKey) : pool;
  const target = candidates[Math.floor(rng() * candidates.length)];
  const others = pool.filter((x) => keyOf(x) !== keyOf(target));
  const preferred = confusable ? others.filter((x) => confusable(target, x)) : [];
  const rest = others.filter((x) => !preferred.includes(x));
  const shuffle = <A,>(a: A[]) => a.map((v) => [rng(), v] as const).sort((p, q) => p[0] - q[0]).map(([, v]) => v);
  const distractors = [...shuffle(preferred), ...shuffle(rest)].slice(0, tileCount - 1);
  const tiles = shuffle([target, ...distractors]).map(toTile);
  const answerIdx = tiles.findIndex((t) => t.key === keyOf(target));
  return { target, tiles, answerIdx };
}
