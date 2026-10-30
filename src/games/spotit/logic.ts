import { Difficulty, settingsFor } from "../../difficulty";
import { Lang } from "../../lang";
import { Rng, randInt, shuffle } from "../../rng";
import { WORDS, wordFor } from "../../curriculum/content";
import { t } from "../../i18n";

// 31 distinct kid-friendly symbols — exactly n^2+n+1 for order n=5.
export const SYMBOLS = [
  "🐶",
  "🐱",
  "🦁",
  "🐸",
  "🐼",
  "🦊",
  "🐵",
  "🐷",
  "🐰",
  "🐨",
  "🦄",
  "🐙",
  "🦀",
  "🐠",
  "🦋",
  "🐞",
  "🌸",
  "🌻",
  "🍎",
  "🍌",
  "🍓",
  "🍕",
  "🍦",
  "🎈",
  "🚗",
  "✈️",
  "🚀",
  "⚽",
  "🌈",
  "⭐",
  "🎁",
] as const;

export type Card = number[]; // indices into SYMBOLS, n+1 per card

export function orderForDifficulty(difficulty?: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 2;
    case 'hard':
      return 5;
    case 'medium':
    case undefined:
      return 3;
    default: {
      const exhaustive: never = difficulty;
      throw new Error(`Unknown difficulty: ${exhaustive}`);
    }
  }
}

// Projective plane of order n (prime): n^2+n+1 cards, n+1 symbols each,
// any two cards share exactly one symbol.
export function buildDeck(n = 5): Card[] {
  const cards: Card[] = [];
  const first: Card = [];
  for (let i = 0; i <= n; i++) first.push(i);
  cards.push(first);
  for (let i = 0; i < n; i++) {
    const card: Card = [0];
    for (let j = 0; j < n; j++) card.push(n + 1 + n * i + j);
    cards.push(card);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const card: Card = [i + 1];
      for (let k = 0; k < n; k++) {
        card.push(n + 1 + n * k + ((i * k + j) % n));
      }
      cards.push(card);
    }
  }
  return cards;
}

export function sharedSymbol(a: Card, b: Card): number {
  const set = new Set(a);
  const shared = b.filter((s) => set.has(s));
  if (shared.length !== 1)
    throw new Error(`cards share ${shared.length} symbols`);
  return shared[0];
}

export interface SpotItRound {
  top: Card; // symbol order shuffled for display
  bottom: Card;
  answer: number; // the shared symbol index
}

export function dealRound(rng: Rng, deck: Card[]): SpotItRound {
  const i = randInt(rng, deck.length);
  let j = randInt(rng, deck.length - 1);
  if (j >= i) j += 1;
  const top = shuffle(rng, deck[i]);
  const bottom = shuffle(rng, deck[j]);
  return { top, bottom, answer: sharedSymbol(top, bottom) };
}

// --- Same-device duel -------------------------------------------------------

export interface DuelRound {
  center: Card; // shared card, shown once per zone
  a: Card; // player 0's own card
  b: Card; // player 1's own card
  answerA: number; // sharedSymbol(a, center)
  answerB: number; // sharedSymbol(b, center)
}

/** Three distinct cards; each kid hunts a different answer (no copy-sniping).
 *  If both answers collide, redraw b — bounded, then fall through (playable,
 *  just less ideal). */
export function dealDuelRound(rng: Rng, deck: Card[]): DuelRound {
  const i = randInt(rng, deck.length);
  let j = randInt(rng, deck.length - 1);
  if (j >= i) j += 1;
  const center = shuffle(rng, deck[i]);
  const a = shuffle(rng, deck[j]);
  const answerA = sharedSymbol(a, center);
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  let b = a;
  let answerB = answerA;
  for (let tries = 0; tries < 10; tries++) {
    let k = randInt(rng, deck.length - 2); // skip i and j: always 3 distinct cards
    if (k >= lo) k += 1;
    if (k >= hi) k += 1;
    b = shuffle(rng, deck[k]);
    answerB = sharedSymbol(b, center);
    if (answerB !== answerA) break;
  }
  return { center, a, b, answerA, answerB };
}

/** Rubber-band: a kid leading by >=2 waits a beat before her redeal. */
export function leaderDealDelayMs(myScore: number, otherScore: number): number {
  const lead = myScore - otherScore;
  if (lead < 2) return 0;
  return Math.min(400 * (lead - 1), 1200);
}

/** Rubber-band: a kid trailing by >=2 gets a sparkle hint after this long
 *  with no correct tap; Infinity = no hint. */
export function hintAfterMs(
  myScore: number,
  otherScore: number,
  baseSecs: number,
): number {
  const deficit = otherScore - myScore;
  if (deficit < 2) return Infinity;
  return baseSecs * 1000;
}

// --- Duel spoken prompts ----------------------------------------------------

export function duelCountdownPrompt(lang: Lang): string {
  return t(lang, "spotitDuel.countdown");
}

/** Localized screen-reader label for a card symbol. */
export function symbolLabel(iconName: string, lang: Lang): string {
  const entry = WORDS.find((w) => w.icon === iconName);
  if (!entry) throw new Error(`Unknown spotit icon: ${iconName}`);
  return wordFor(entry, lang).text;
}

export function computeSoloCardSize(width: number, height: number): number {
  const isLandscape = width > height;
  const availH = height - 84;
  return isLandscape
    ? Math.max(0, Math.min(availH - 24, (width - 3 * 24) / 2, 460))
    : Math.max(0, Math.min((availH - 60) / 2, width - 40, 400));
}

export function computeDuelCardSize(width: number, height: number): number {
  const isLandscape = width > height;
  const availH = height - 84;
  return isLandscape
    ? Math.max(0, Math.min(availH - 90, (width - 2 * 12) / 2 / 2 - 20, 320))
    : Math.max(0, Math.min((availH - 24) / 2 - 52, (width - 60) / 2, 320));
}

export const SOLO_HINT_WRONG_TAPS = 2;

/**
 * Inactivity delay in ms before revealing the matching symbol as a hint in Spot It Solo.
 * Mirrors difficulty settings (hiddenHintSecs), or Infinity if disabled.
 */
export function soloHintDelayMs(difficulty: Difficulty): number {
  const secs = settingsFor(difficulty).hiddenHintSecs;
  return Number.isFinite(secs) ? secs * 1000 : Infinity;
}

/** Whether the accumulated wrong taps should reveal the answer hint. */
export function shouldShowSoloHintOnWrong(wrongTaps: number): boolean {
  return wrongTaps >= SOLO_HINT_WRONG_TAPS;
}
