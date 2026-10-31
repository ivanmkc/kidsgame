import { expect, test } from 'vitest';
import { makeRng } from '../../../rng';
import { makeBalanceRound, balanceSettings } from '../logic';

test('balanceSettings returns valid settings for difficulties', () => {
  expect(balanceSettings('easy').rounds).toBe(5);
  expect(balanceSettings('medium').rounds).toBe(6);
  expect(balanceSettings('hard').rounds).toBe(8);
});

test('makeBalanceRound generates valid round structure across seeds and difficulties', () => {
  const difficulties = ['easy', 'medium', 'hard'] as const;
  for (const diff of difficulties) {
    const { maxTotal } = balanceSettings(diff);
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed * 999);
      const round = makeBalanceRound(rng, diff);

      expect(round.total).toBeGreaterThanOrEqual(3);
      expect(round.total).toBeLessThanOrEqual(maxTotal);
      expect(round.leftCount).toBeGreaterThanOrEqual(1);
      expect(round.rightCount).toBeGreaterThanOrEqual(1);
      expect(round.leftCount + round.rightCount).toBe(round.total);

      const expectedAnswer = round.missingSide === 'left' ? round.leftCount : round.rightCount;
      expect(round.answer).toBe(expectedAnswer);

      expect(round.choices.length).toBe(3);
      expect(round.choices).toContain(round.answer);

      // Check all choices are unique, in 1..total (or valid positive integers)
      const uniqueChoices = new Set(round.choices);
      expect(uniqueChoices.size).toBe(3);
      for (const choice of round.choices) {
        expect(choice).toBeGreaterThanOrEqual(1);
        expect(choice).toBeLessThanOrEqual(Math.max(maxTotal, round.total));
      }
    }
  }
});
