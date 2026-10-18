import { Rng } from '../../rng';
import { LEVEL_1_WORDS, Word } from './data';

export interface Round {
  target: Word;
  distractor: Word;
  choices: Word[];
}

export interface GameState {
  currentRound: Round;
  streak: number;
  wrongGuesses: number;
  highlightCorrect: boolean;
  level: number;
}

/**
 * Generate a round with one target and one distractor chosen from Level 1 words.
 * The choices array contains both words in randomized order.
 */
export function generateRound(rng: Rng = Math.random, words: Word[] = LEVEL_1_WORDS, avoidIcon?: string): Round {
  if (words.length < 2) {
    throw new Error('words pool must have at least 2 words');
  }
  const targetPool = avoidIcon && words.length > 2 ? words.filter((w) => w.icon !== avoidIcon) : words;
  const target = targetPool[Math.floor(rng() * targetPool.length)];
  const distractors = words.filter((w) => w.icon !== target.icon && !target.nameTwins?.includes(w.icon));
  if (distractors.length === 0) {
    throw new Error('no valid distractor found for target');
  }
  const distractor = distractors[Math.floor(rng() * distractors.length)];
  const choices = rng() < 0.5 ? [target, distractor] : [distractor, target];
  return { target, distractor, choices };
}

/**
 * Initialize game state with a valid round from Level 1.
 */
export function initGameState(rng: Rng = Math.random, words: Word[] = LEVEL_1_WORDS): GameState {
  return {
    currentRound: generateRound(rng, words),
    streak: 0,
    wrongGuesses: 0,
    highlightCorrect: false,
    level: 1,
  };
}

/**
 * Evaluate whether the guess matches the current round's target word.
 */
export function evaluateGuess(round: Round, guessIcon: string): boolean {
  return round.target.icon === guessIcon;
}

/**
 * Return updated game state after evaluating a guess.
 * - Correct: increments streak, resets wrongGuesses and highlightCorrect, advances to a new round.
 * - Incorrect: resets streak, increments wrongGuesses, sets highlightCorrect if wrongGuesses >= 2, keeps round.
 */
export function updateGameState(
  state: GameState,
  guessIcon: string,
  rng: Rng = Math.random,
  words: Word[] = LEVEL_1_WORDS,
): GameState {
  const isCorrect = evaluateGuess(state.currentRound, guessIcon);
  if (isCorrect) {
    return {
      ...state,
      streak: state.streak + 1,
      wrongGuesses: 0,
      highlightCorrect: false,
      currentRound: generateRound(rng, words, state.currentRound.target.icon),
    };
  }
  const nextWrong = state.wrongGuesses + 1;
  return {
    ...state,
    streak: 0,
    wrongGuesses: nextWrong,
    highlightCorrect: nextWrong >= 2,
  };
}
