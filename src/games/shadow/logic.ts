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

export function makeShadowRound(rng: Rng, icons: string[], d: ShadowDifficulty): ShadowRound {
  const answer = icons[Math.floor(rng() * icons.length)];
  let pool: string[];
  if (d.categoryDistractors) {
    pool = sameCategory(answer).filter((i) => i !== answer && icons.includes(i));
    if (pool.length < d.choices - 1) {
      pool = pool.concat(shuffle(rng, icons.filter((i) => i !== answer && !pool.includes(i))));
    }
  } else {
    pool = icons.filter((i) => i !== answer);
  }
  const options = shuffle(rng, [answer, ...shuffle(rng, pool).slice(0, d.choices - 1)]);
  return {
    answer,
    options,
    rotation: d.transform ? Math.round((rng() - 0.5) * 2 * 70) : 0,
    mirrored: d.transform ? rng() > 0.5 : false,
  };
}
