import { t, UIKey } from "../../i18n";
import { Lang } from "../../lang";
import { Rng, shuffle } from "../../rng";
import { WORDS, WordEntry, wordFor } from "../../words";

export type CardDisplay =
  | { type: "text"; text: string }
  | { type: "icon"; icon: string }
  | { type: "color"; color: string }
  | { type: "audio"; text?: string };

export interface ConceptMatchCard {
  key: string;
  conceptId: string;
  display: CardDisplay;
  speech: string;
}

export type ConceptMatchDeck =
  "letters" | "picture-word" | "picture-spoken" | "color-word";

export interface ColorEntry {
  id: string;
  hex: string;
}

export const COLORS: ColorEntry[] = [
  { id: "red", hex: "#E53935" },
  { id: "blue", hex: "#1E88E5" },
  { id: "green", hex: "#43A047" },
  { id: "yellow", hex: "#FDD835" },
  { id: "purple", hex: "#8E24AA" },
  { id: "orange", hex: "#FB8C00" },
  { id: "black", hex: "#212121" },
  { id: "white", hex: "#FFFFFF" },
  { id: "pink", hex: "#F06292" },
  { id: "brown", hex: "#6D4C41" },
  { id: "gray", hex: "#757575" },
];

export const ALPHABET: string[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
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
  I: "L",
  L: "I",
};

export function buildBoard(
  rng: Rng,
  deck: ConceptMatchDeck = "letters",
  lang: Lang = "en",
  pairs = 2,
): ConceptMatchCard[] {
  if (deck === "letters") {
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
        display: { type: "text", text: letter },
        speech: letter,
      },
      {
        key: `${letter}-lower`,
        conceptId: letter,
        display: { type: "text", text: letter.toLowerCase() },
        speech: letter,
      },
    ]);
    return shuffle(rng, cards);
  }

  if (deck === "picture-word" || deck === "picture-spoken") {
    const pool = shuffle(
      rng,
      WORDS.filter((entry) => Boolean(wordFor(entry, lang).text)),
    );
    const chosen: WordEntry[] = [];
    const excludedIcons = new Set<string>();
    const excludedWords = new Set<string>();

    for (const entry of pool) {
      if (chosen.length >= pairs) {
        break;
      }
      const text = wordFor(entry, lang).text;
      if (excludedIcons.has(entry.icon) || excludedWords.has(text)) {
        continue;
      }
      chosen.push(entry);
      excludedIcons.add(entry.icon);
      excludedWords.add(text);
      for (const twin of entry.nameTwins ?? []) {
        excludedIcons.add(twin);
      }
    }

    const isPictureWord = deck === "picture-word";
    const cards: ConceptMatchCard[] = chosen.flatMap((entry) => {
      const word = wordFor(entry, lang).text;
      return [
        {
          key: `${entry.icon}-icon`,
          conceptId: entry.icon,
          display: { type: "icon", icon: entry.icon },
          speech: word,
        },
        {
          key: isPictureWord ? `${entry.icon}-word` : `${entry.icon}-audio`,
          conceptId: entry.icon,
          display: isPictureWord
            ? { type: "text", text: word }
            : { type: "audio" },
          speech: word,
        },
      ];
    });
    return shuffle(rng, cards);
  }

  if (deck === "color-word") {
    const pool = shuffle(rng, COLORS);
    const chosen = pool.slice(0, pairs);
    const cards: ConceptMatchCard[] = chosen.flatMap((entry) => {
      const word = t(lang, `color.${entry.id}` as UIKey);
      return [
        {
          key: `${entry.id}-color`,
          conceptId: entry.id,
          display: { type: "color", color: entry.hex },
          speech: word,
        },
        {
          key: `${entry.id}-word`,
          conceptId: entry.id,
          display: { type: "text", text: word },
          speech: word,
        },
      ];
    });
    return shuffle(rng, cards);
  }

  throw new Error(`Unsupported deck: ${deck}`);
}
