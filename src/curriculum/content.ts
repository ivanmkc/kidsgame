import { ICON_CATEGORIES } from '../games/iconCategories';
export * from './words';
export { default as WORD_LEVELS } from './wordLevels.json';

export const CURRICULUM = {
  categories: ICON_CATEGORIES,
  critters: [
    'dog',
    'cat',
    'frog',
    'rabbit',
    'fish',
    'butterfly',
    'apple',
    'strawberry',
    'star',
    'balloon',
  ],
  numbers: {
    count: {
      easy: { rounds: 5, min: 1, max: 5 },
      medium: { rounds: 6, min: 4, max: 8 },
      hard: { rounds: 8, min: 6, max: 10 },
    },
    compare: {
      easy: {
        rounds: 6,
        range: [1, 7] as [number, number],
        minGap: 3,
        minRatio: 1.25,
        fewerFraction: 0,
      },
      medium: {
        rounds: 8,
        range: [1, 9] as [number, number],
        minGap: 2,
        minRatio: 1.25,
        fewerFraction: 0,
      },
      hard: {
        rounds: 10,
        range: [3, 10] as [number, number],
        minGap: 1,
        minRatio: 1.25,
        fewerFraction: 0.3,
      },
    },
    balance: {
      easy: { rounds: 5, maxTotal: 5 },
      medium: { rounds: 6, maxTotal: 7 },
      hard: { rounds: 8, maxTotal: 10 },
    },
    sums: {
      easy: { rounds: 5, maxSum: 5 },
      medium: { rounds: 6, maxSum: 7 },
      hard: { rounds: 8, maxSum: 10 },
    },
    numbers: {
      easy: { rounds: 8, tiles: 5, max: 5 },
      medium: { rounds: 10, tiles: 7, max: 9 },
      hard: { rounds: 12, tiles: 9, max: 20 },
    },
  },
};
