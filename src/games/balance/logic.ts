import { Difficulty } from '../../difficulty';
import { Rng, randInt, shuffle } from '../../rng';
import { CURRICULUM } from '../../curriculum/content';

export interface BalanceRound {
  total: number;
  leftCount: number;
  rightCount: number;
  missingSide: 'left' | 'right';
  answer: number;
  choices: number[];
  icon: string;
}

export function balanceSettings(d: Difficulty): {
  rounds: number;
  maxTotal: number;
} {
  return CURRICULUM.numbers.balance[d];
}

export function makeBalanceRound(rng: Rng, d: Difficulty): BalanceRound {
  const { maxTotal } = balanceSettings(d);
  const minTotal = 3;
  const total = minTotal + randInt(rng, Math.max(1, maxTotal - minTotal + 1));
  const leftCount = 1 + randInt(rng, total - 1);
  const rightCount = total - leftCount;

  const missingSide: 'left' | 'right' = rng() < 0.5 ? 'left' : 'right';
  const answer = missingSide === 'left' ? leftCount : rightCount;

  const choicesSet = new Set<number>([answer]);
  let guard = 0;
  while (choicesSet.size < 3 && guard++ < 100) {
    const cand = 1 + randInt(rng, Math.max(maxTotal, total));
    if (cand <= total) choicesSet.add(cand);
  }
  let fallback = 1;
  while (choicesSet.size < 3) {
    choicesSet.add(fallback++);
  }
  const choices = shuffle(rng, Array.from(choicesSet));

  const icons = ['apple', 'star', 'balloon', 'strawberry', 'fish'];
  const icon = icons[randInt(rng, icons.length)];

  return {
    total,
    leftCount,
    rightCount,
    missingSide,
    answer,
    choices,
    icon,
  };
}
