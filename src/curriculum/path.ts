import { CardKey } from "../menuCards";

/**
 * Progression mapping within each curriculum strand (docs/curriculum.md).
 * Maps games to their next progression in the learning path.
 */
export const CURRICULUM_PATH: Partial<Record<CardKey, CardKey>> = {
  // Early Literacy
  listenchoose: "sounds",
  sounds: "rhyme",
  rhyme: "letters",
  letters: "spell",
  spell: "bingo",
  bingo: "story",

  // Numeracy
  numbers: "count",
  count: "compare",
  compare: "sums",

  // Music and Rhythm
  musicbox: "bells",
  highlow: "bells",
  bells: "fastslow",
  fastslow: "echobeat",
  steadybeat: "echobeat",

  // Languages EN/JA/ZH
  carmode: "bingo",

  // Executive Function
  sticker: "samediff",
  samediff: "shadow",
  shadow: "diff",
  diff: "hidden",
  hidden: "oddone",
  oddone: "cm-mixed",
  "cm-mixed": "memory",
  memory: "puzzle",
  puzzle: "rules",
  rules: "spotit",
  spotit: "escape",
};
