import { Rng, shuffle } from '../../rng';

export interface ConceptMatchCard {
  key: string;
  conceptId: string;
  display: string;
  speech: string;
}

export const ALPHABET: string[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

export function isMatch(a: ConceptMatchCard, b: ConceptMatchCard): boolean {
  return a.conceptId === b.conceptId;
}

/**
 * In the display font (Baloo 2), capital 'I' and lowercase 'l' both render as
 * an identical bare vertical bar. To satisfy R6 (unambiguous visual responses
 * with sound off), a single board must never include both 'I' and 'L'.
 */
export const GLYPH_TWINS: Record<string, string> = {
  I: 'L',
  L: 'I',
};

export function buildBoard(rng: Rng, pairs = 2): ConceptMatchCard[] {
  const pool = shuffle(rng, ALPHABET);
  const chosen: string[] = [];
  const excluded = new Set<string>();

  for (const letter of pool) {
    if (chosen.length >= pairs) {
      break;
    }
    if (excluded.has(letter)) {
      continue;
    }
    chosen.push(letter);
    const twin = GLYPH_TWINS[letter];
    if (twin) {
      excluded.add(twin);
    }
  }
  const cards: ConceptMatchCard[] = chosen.flatMap((letter) => [
    {
      key: `${letter}-upper`,
      conceptId: letter,
      display: letter,
      speech: letter,
    },
    {
      key: `${letter}-lower`,
      conceptId: letter,
      display: letter.toLowerCase(),
      speech: letter,
    },
  ]);
  return shuffle(rng, cards);
}
