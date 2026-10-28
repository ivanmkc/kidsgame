import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";
import { Rng, shuffle, sample } from "../../rng";
import {
  LEVEL_1_WORDS,
  LEVEL_2_WORDS,
  LEVEL_3_WORDS,
  Word,
  getLevelConfig,
} from "./data";

/**
 * Return the localized spoken text for a word, falling back to English.
 */
export function getWordText(word: Word, lang: Lang): string {
  if (lang === "ja" && word.ja) return word.ja;
  if (lang === "cmn" && word.cmn) return word.cmn;
  if (lang === "yue" && word.yue) return word.yue;
  return word.en;
}

/**
 * Return all speech lines that can be spoken in Listen and Choose.
 * Pre-rendered by the offline TTS pipeline.
 */
export function speechLines(
  words: Word[] = Array.from(
    new Set([...LEVEL_1_WORDS, ...LEVEL_2_WORDS, ...LEVEL_3_WORDS]),
  ),
): string[] {
  const lines = new Set<string>();
  for (const w of words) {
    for (const lang of ["en", "ja", "cmn", "yue"] as const) {
      lines.add(getWordText(w, lang));
    }
  }
  return [...lines];
}

export interface ListenChooseLayout {
  shortH: boolean;
  speakerSize: number;
  speakerIconSize: number;
  cardWidth: number;
  cardHeight: number;
  cardImageSize: number;
  gap: number;
}

export function listenChooseLayout(
  width: number,
  height: number,
  numChoices: number = 2,
): ListenChooseLayout {
  const shortH = height < 500;
  if (shortH) {
    const gap = 10;
    const maxCardByWidth =
      (Math.min(width - 32, 600) - (numChoices - 1) * gap) /
      Math.max(1, numChoices);
    const cardWidth = Math.max(72, Math.min(120, Math.floor(maxCardByWidth)));
    return {
      shortH: true,
      speakerSize: 56,
      speakerIconSize: 26,
      cardWidth,
      cardHeight: 120,
      cardImageSize: 56,
      gap,
    };
  }

  return {
    shortH: false,
    speakerSize: 88,
    speakerIconSize: 42,
    cardWidth: 150,
    cardHeight: 170,
    cardImageSize: 96,
    gap: 20,
  };
}

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
  won: boolean;
}

/**
 * Generate a round with one target and one distractor chosen from Level 1 words.
 * The choices array contains both words in randomized order.
 */
export function generateRound(
  rng: Rng = Math.random,
  words: Word[] = LEVEL_1_WORDS,
  numChoices: number = 2,
  avoidIcon?: string,
  prioritizeRhymes: boolean = false,
): Round {
  if (words.length < 2) {
    throw new Error("words pool must have at least 2 words");
  }

  const targetPool =
    avoidIcon && words.length > numChoices
      ? words.filter((w) => w.icon !== avoidIcon)
      : words;
  const target = targetPool[Math.floor(rng() * targetPool.length)];

  const allDistractors = words.filter(
    (w) =>
      w.icon !== target.icon &&
      !target.nameTwins?.includes(w.icon) &&
      !w.nameTwins?.includes(target.icon),
  );

  let distractors: Word[] = [];

  if (prioritizeRhymes) {
    const priorityDistractors = allDistractors.filter(
      (w) => target.rhymeKey && w.rhymeKey === target.rhymeKey,
    );
    const regularDistractors = allDistractors.filter(
      (w) => !priorityDistractors.includes(w),
    );

    const shuffledPriority = shuffle(rng, priorityDistractors);
    const shuffledRegular = shuffle(rng, regularDistractors);

    const combined = [...shuffledPriority, ...shuffledRegular];
    if (combined.length < numChoices - 1) {
      throw new Error("no valid distractor found for target");
    }
    distractors = combined.slice(0, numChoices - 1);
  } else {
    if (allDistractors.length < numChoices - 1) {
      throw new Error("no valid distractor found for target");
    }
    distractors = sample(rng, allDistractors, numChoices - 1);
  }

  const choices = shuffle(rng, [target, ...distractors]);

  return { target, distractor: distractors[0], choices };
}

/**
 * Initialize game state with a valid round from Level 1, or higher based on difficulty.
 */
export function initGameState(
  rng: Rng = Math.random,
  difficulty: Difficulty = "easy",
  lang: Lang = "en",
): GameState {
  const baseLevel = difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1;
  const config = getLevelConfig(baseLevel, lang);
  return {
    currentRound: generateRound(
      rng,
      config.words,
      config.numChoices,
      undefined,
      config.prioritizeRhymes,
    ),
    streak: 0,
    wrongGuesses: 0,
    highlightCorrect: false,
    level: baseLevel,
    won: false,
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
 * - Incorrect: keeps streak, increments wrongGuesses, sets highlightCorrect if wrongGuesses >= 2, keeps round.
 */
export function updateGameState(
  state: GameState,
  guessIcon: string,
  rng: Rng = Math.random,
  difficulty: Difficulty = "easy",
  lang: Lang = "en",
): GameState {
  const isCorrect = evaluateGuess(state.currentRound, guessIcon);
  if (isCorrect) {
    const nextStreak = state.streak + 1;
    let nextLevel = difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1;
    if (nextStreak >= 20) {
      nextLevel = 3;
    } else if (nextStreak >= 10) {
      nextLevel = Math.max(nextLevel, 2);
    }

    const won = nextStreak >= 30;
    const config = getLevelConfig(nextLevel, lang);

    return {
      ...state,
      streak: nextStreak,
      wrongGuesses: 0,
      highlightCorrect: false,
      level: nextLevel,
      won,
      currentRound: won
        ? state.currentRound
        : generateRound(
            rng,
            config.words,
            config.numChoices,
            state.currentRound.target.icon,
            config.prioritizeRhymes,
          ),
    };
  }
  const nextWrong = state.wrongGuesses + 1;
  return {
    ...state,
    wrongGuesses: nextWrong,
    highlightCorrect: nextWrong >= 2,
  };
}
