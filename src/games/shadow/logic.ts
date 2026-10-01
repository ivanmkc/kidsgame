import { Rng, shuffle } from '../../rng';
import { sameCategory } from '../iconCategories';

export interface ShadowRound {
  answer: string;
  options: string[]; // includes answer, shuffled
  rotation: number; // degrees applied to the shadow (mental rotation)
  mirrored: boolean;
}

export interface ShadowDifficulty {
  choices: number;
  categoryDistractors: boolean; // pick confusable same-category options
  transform: boolean; // rotate/mirror the shadow
}

// Icons whose SILHOUETTES are the same shape, so nothing in the shadow can
// tell them apart — the pig and the panda are both a round head with two
// small rounded ears, scoring 0.93 IoU against each other with no rotation
// at all, where the 99th percentile across all 930 icon pairs is 0.89. They
// are in the same category, so they would otherwise meet on every tier.
// Measured (and re-checked when the art regenerates) by
// tools/shadow_confusability.py.
export const SHADOW_TWINS: Record<string, string[]> = {
  pig: ['panda'],
  panda: ['pig'],
};

export function makeShadowRound(rng: Rng, icons: string[], d: ShadowDifficulty): ShadowRound {
  const answer = icons[Math.floor(rng() * icons.length)];
  const twins = new Set(SHADOW_TWINS[answer] ?? []);
  const eligible = (i: string) => i !== answer && !twins.has(i);
  let pool: string[];
  if (d.categoryDistractors) {
    pool = sameCategory(answer).filter((i) => eligible(i) && icons.includes(i));
    if (pool.length < d.choices - 1) {
      pool = pool.concat(shuffle(rng, icons.filter((i) => eligible(i) && !pool.includes(i))));
    }
  } else {
    pool = icons.filter(eligible);
  }
  const options = shuffle(rng, [answer, ...shuffle(rng, pool).slice(0, d.choices - 1)]);
  return {
    answer,
    options,
    rotation: d.transform ? Math.round((rng() - 0.5) * 2 * 70) : 0,
    mirrored: d.transform ? rng() > 0.5 : false,
  };
}
