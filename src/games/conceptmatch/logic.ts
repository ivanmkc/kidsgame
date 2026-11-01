import { Difficulty } from "../../difficulty";
import { t, UIKey } from "../../i18n";
import { hanNumeral, Lang, numberWord } from "../../lang";
import { type CardKey } from "../../menuCards";
import { Rng, shuffle } from "../../rng";
import { WORDS, WordEntry, wordFor } from "../../curriculum/content";

export type CardDisplay =
  | { type: "text"; text: string }
  | { type: "icon"; icon: string }
  | { type: "color"; color: string }
  | { type: "audio"; text?: string }
  | { type: "dots"; count: number };

export interface ConceptMatchCard {
  key: string;
  conceptId: string;
  display: CardDisplay;
  speech: string;
}

export type ConceptMatchDeck =
  | "letters"
  | "picture-word"
  | "picture-spoken"
  | "color-word"
  | "numerals-han"
  | "numerals-dots"
  | "shapes-objects"
  | "animals-sounds"
  | "mixed";

export const DECK_TO_CARD_KEY: Record<ConceptMatchDeck, CardKey> = {
  letters: "cm-letters",
  "picture-word": "cm-picword",
  "picture-spoken": "cm-picspeak",
  "color-word": "cm-colors",
  "numerals-han": "cm-numhan",
  "numerals-dots": "cm-numdots",
  "shapes-objects": "cm-shapes",
  "animals-sounds": "cm-animals",
  mixed: "cm-mixed",
};

export const ANIMALS: string[] = ["dog", "cat", "lion", "frog", "pig"];

export interface ShapePair {
  shape: string;
  object: string;
}

export const SHAPES: ShapePair[] = [
  { shape: "circle", object: "clock" },
  { shape: "square", object: "window" },
  { shape: "triangle", object: "pizza_slice" },
  { shape: "star", object: "starfish" },
];

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

const DECK_CAPACITIES: Partial<Record<ConceptMatchDeck, number>> = {
  "shapes-objects": SHAPES.length,
  "animals-sounds": ANIMALS.length,
  "numerals-dots": 9,
};

/**
 * Returns the target pair count for a given difficulty and deck.
 * Ramps across easy (2 pairs / 2x2 grid), medium (6 pairs / 3x4 grid),
 * and hard (8 pairs / 4x4 grid), capped by deck capacity (shapes-objects=4,
 * animals-sounds=5, numerals-dots=9).
 */
export function pairsForDifficulty(
  difficulty: Difficulty = "medium",
  deck?: ConceptMatchDeck,
): number {
  let target = 6;
  if (difficulty === "easy") {
    target = 2;
  } else if (difficulty === "hard") {
    target = 8;
  }

  if (deck && DECK_CAPACITIES[deck] !== undefined) {
    const cap = DECK_CAPACITIES[deck]!;
    if (difficulty === "medium") {
      if (cap === 4) target = 3;
      else if (cap === 5) target = 4;
    }
    return Math.min(target, cap);
  }
  return target;
}

export const CONFUSING_LETTER_GROUPS: string[][] = [
  ["B", "D", "P", "Q"],
  ["M", "N", "W"],
  ["O", "Q", "C", "G"],
  ["E", "F"],
  ["U", "V"],
];

export function rhymeKeyFor(entry: WordEntry, lang: Lang): string | undefined {
  if (lang === "en") return entry.rhymeKey;
  if (lang === "ja") return entry.jaRhyme;
  if (lang === "cmn") return entry.cmnRhyme;
  return entry.yueRhyme;
}

export function buildBoard(
  rng: Rng,
  deck: ConceptMatchDeck = "letters",
  lang: Lang = "en",
  pairs = 2,
  excludedConcepts?: ReadonlySet<string>,
  groupSimilar = false,
): ConceptMatchCard[] {
  if (deck === "letters") {
    const chosen: string[] = [];
    const excluded = new Set<string>();

    const isAvailable = (letter: string) =>
      !chosen.includes(letter) &&
      !excluded.has(letter) &&
      !excludedConcepts?.has(letter);

    const addLetter = (letter: string) => {
      chosen.push(letter);
      const twin = GLYPH_TWINS[letter];
      if (twin) {
        excluded.add(twin);
      }
    };

    if (groupSimilar) {
      const shuffledGroups = shuffle(rng, CONFUSING_LETTER_GROUPS);
      for (const group of shuffledGroups) {
        if (chosen.length >= pairs) {
          break;
        }
        const available = group.filter(isAvailable);
        if (available.length === 0) {
          continue;
        }
        if (available.length < 2 && pairs - chosen.length >= 2) {
          continue;
        }
        const shuffledGroup = shuffle(rng, available);
        for (const letter of shuffledGroup) {
          if (chosen.length >= pairs) {
            break;
          }
          if (!isAvailable(letter)) {
            continue;
          }
          addLetter(letter);
        }
      }
    }

    if (chosen.length < pairs) {
      const pool = shuffle(rng, ALPHABET);
      for (const letter of pool) {
        if (chosen.length >= pairs) {
          break;
        }
        if (!isAvailable(letter)) {
          continue;
        }
        addLetter(letter);
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
    const validWords = WORDS.filter((entry) =>
      Boolean(wordFor(entry, lang).text),
    );
    const chosen: WordEntry[] = [];
    const excludedIcons = new Set<string>();
    const excludedWords = new Set<string>();

    const isAvailable = (entry: WordEntry) => {
      const text = wordFor(entry, lang).text;
      return (
        !excludedIcons.has(entry.icon) &&
        !excludedWords.has(text) &&
        !excludedConcepts?.has(entry.icon)
      );
    };

    const addWord = (entry: WordEntry) => {
      chosen.push(entry);
      excludedIcons.add(entry.icon);
      excludedWords.add(wordFor(entry, lang).text);
      for (const twin of entry.nameTwins ?? []) {
        excludedIcons.add(twin);
      }
    };

    if (groupSimilar) {
      const rhymeGroups = new Map<string, WordEntry[]>();
      for (const entry of validWords) {
        const key = rhymeKeyFor(entry, lang);
        if (key) {
          const list = rhymeGroups.get(key) ?? [];
          list.push(entry);
          rhymeGroups.set(key, list);
        }
      }

      const multiWordGroups = Array.from(rhymeGroups.values()).filter(
        (group) => group.length >= 2,
      );
      const shuffledGroups = shuffle(rng, multiWordGroups);

      for (const group of shuffledGroups) {
        if (chosen.length >= pairs) {
          break;
        }
        const available = group.filter(isAvailable);
        if (available.length === 0) {
          continue;
        }
        if (available.length < 2 && pairs - chosen.length >= 2) {
          continue;
        }
        const shuffledGroup = shuffle(rng, available);
        for (const entry of shuffledGroup) {
          if (chosen.length >= pairs) {
            break;
          }
          if (!isAvailable(entry)) {
            continue;
          }
          addWord(entry);
        }
      }
    }

    if (chosen.length < pairs) {
      const pool = shuffle(rng, validWords);
      for (const entry of pool) {
        if (chosen.length >= pairs) {
          break;
        }
        if (!isAvailable(entry)) {
          continue;
        }
        addWord(entry);
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
    const chosen = pool
      .filter((entry) => !excludedConcepts?.has(entry.id))
      .slice(0, pairs);
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

  if (deck === "numerals-han") {
    const pool = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const chosen = pool.slice(0, pairs);
    const cards: ConceptMatchCard[] = chosen.flatMap((n) => {
      const speech = numberWord(lang, n).t;
      return [
        {
          key: `${n}-arabic`,
          conceptId: String(n),
          display: { type: "text", text: String(n) },
          speech,
        },
        {
          key: `${n}-han`,
          conceptId: String(n),
          display: { type: "text", text: hanNumeral(n) },
          speech,
        },
      ];
    });
    return shuffle(rng, cards);
  }

  if (deck === "numerals-dots") {
    const pool = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const chosen = pool.slice(0, pairs);
    const cards: ConceptMatchCard[] = chosen.flatMap((n) => {
      const speech = numberWord(lang, n).t;
      return [
        {
          key: `${n}-arabic`,
          conceptId: String(n),
          display: { type: "text", text: String(n) },
          speech,
        },
        {
          key: `${n}-dots`,
          conceptId: String(n),
          display: { type: "dots", count: n },
          speech,
        },
      ];
    });
    return shuffle(rng, cards);
  }

  if (deck === "shapes-objects") {
    const pool = shuffle(rng, SHAPES);
    const chosen = pool.slice(0, pairs);
    const cards: ConceptMatchCard[] = chosen.flatMap((entry) => {
      const speech = t(lang, `shape.${entry.shape}` as UIKey);
      return [
        {
          key: `${entry.shape}-shape`,
          conceptId: entry.shape,
          display: { type: "icon", icon: entry.shape },
          speech,
        },
        {
          key: `${entry.shape}-object`,
          conceptId: entry.shape,
          display: { type: "icon", icon: entry.object },
          speech,
        },
      ];
    });
    return shuffle(rng, cards);
  }

  if (deck === "animals-sounds") {
    const pool = shuffle(rng, ANIMALS);
    const chosen = pool.slice(0, pairs);
    const cards: ConceptMatchCard[] = chosen.flatMap((animal) => {
      const entry = WORDS.find((w) => w.icon === animal);
      if (!entry) {
        throw new Error(`Unknown animal: ${animal}`);
      }
      const speech = wordFor(entry, lang).text;
      const sound = t(lang, `sound.${animal}` as UIKey);
      return [
        {
          key: `${animal}-icon`,
          conceptId: animal,
          display: { type: "icon", icon: animal },
          speech,
        },
        {
          key: `${animal}-sound`,
          conceptId: animal,
          display: { type: "audio", text: sound },
          speech: sound,
        },
      ];
    });
    return shuffle(rng, cards);
  }

  if (deck === "mixed") {
    const availableDecks: ConceptMatchDeck[] = [
      "letters",
      "picture-word",
      "picture-spoken",
      "color-word",
    ];
    const shuffledDecks = shuffle(rng, availableDecks);
    const numDecks = shuffledDecks.length;
    const base = Math.floor(pairs / numDecks);
    const remainder = pairs % numDecks;
    const cards: ConceptMatchCard[] = [];
    const usedConcepts = new Set<string>(excludedConcepts);

    for (let i = 0; i < numDecks; i++) {
      const count = base + (i < remainder ? 1 : 0);
      if (count > 0) {
        const deckCards = buildBoard(
          rng,
          shuffledDecks[i],
          lang,
          count,
          usedConcepts,
          groupSimilar,
        );
        cards.push(...deckCards);
        for (const card of deckCards) {
          usedConcepts.add(card.conceptId);
          const glyphTwin = GLYPH_TWINS[card.conceptId];
          if (glyphTwin) {
            usedConcepts.add(glyphTwin);
          }
          const wordEntry = WORDS.find((w) => w.icon === card.conceptId);
          for (const nameTwin of wordEntry?.nameTwins ?? []) {
            usedConcepts.add(nameTwin);
          }
        }
      }
    }
    return shuffle(rng, cards);
  }

  throw new Error(`Unsupported deck: ${deck}`);
}

export function updateCardLang(
  card: ConceptMatchCard,
  deck: ConceptMatchDeck,
  lang: Lang,
): ConceptMatchCard {
  if (deck === "color-word") {
    const word = t(lang, `color.${card.conceptId}` as UIKey);
    return {
      ...card,
      display:
        card.display.type === "text"
          ? { type: "text", text: word }
          : card.display,
      speech: word,
    };
  }

  if (deck === "picture-word" || deck === "picture-spoken") {
    const entry = WORDS.find((w) => w.icon === card.conceptId);
    if (!entry) {
      throw new Error(`Word entry not found for concept: ${card.conceptId}`);
    }
    const word = wordFor(entry, lang).text;
    return {
      ...card,
      display:
        card.display.type === "text"
          ? { type: "text", text: word }
          : card.display,
      speech: word,
    };
  }

  if (deck === "numerals-han" || deck === "numerals-dots") {
    const n = Number(card.conceptId);
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid numeral concept ID: ${card.conceptId}`);
    }
    const speech = numberWord(lang, n).t;
    return {
      ...card,
      speech,
    };
  }

  if (deck === "shapes-objects") {
    const speech = t(lang, `shape.${card.conceptId}` as UIKey);
    return {
      ...card,
      speech,
    };
  }

  if (deck === "animals-sounds") {
    if (card.key.endsWith("-sound") || card.display.type === "audio") {
      const sound = t(lang, `sound.${card.conceptId}` as UIKey);
      return {
        ...card,
        display: { type: "audio", text: sound },
        speech: sound,
      };
    }
    const entry = WORDS.find((w) => w.icon === card.conceptId);
    if (!entry) {
      throw new Error(
        `Word entry not found for animal concept: ${card.conceptId}`,
      );
    }
    const speech = wordFor(entry, lang).text;
    return {
      ...card,
      speech,
    };
  }

  if (deck === "mixed") {
    if (COLORS.some((c) => c.id === card.conceptId)) {
      return updateCardLang(card, "color-word", lang);
    }
    if (WORDS.some((w) => w.icon === card.conceptId)) {
      return updateCardLang(card, "picture-word", lang);
    }
    return card;
  }

  return card;
}

export function updateBoardLang(
  board: ConceptMatchCard[],
  deck: ConceptMatchDeck,
  lang: Lang,
): ConceptMatchCard[] {
  return board.map((card) => updateCardLang(card, deck, lang));
}
