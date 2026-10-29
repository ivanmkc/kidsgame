import { Lang } from "../../lang";
import { Rng, shuffle } from "../../rng";
import { WORDS, wordFor } from "../../curriculum/content";
import { CATEGORY_CONFLICTS, CATEGORY_TEXT } from "../iconCategories";
import { CURRICULUM } from "../../curriculum/content";
import { t } from "../../i18n";

export interface Rule {
  category: string;
  label: string; // "Tap all the ANIMALS!"
}

export interface RulesRound {
  ruleNumber: number; // 1-based
  rule: Rule;
  isRecall: boolean; // hard mode: the rule text is hidden ("Do Rule #N!")
  tiles: { icon: string; isMatch: boolean }[];
  matchCount: number;
}

export function makeRules(rng: Rng, count: number): Rule[] {
  const cats = shuffle(rng, Object.keys(CATEGORY_TEXT));
  return Array.from({ length: count }, (_, i) => {
    const category = cats[i % cats.length];
    return { category, label: CATEGORY_TEXT[category].tap };
  });
}

export function makeRulesRound(
  rng: Rng,
  icons: string[],
  rules: Rule[],
  ruleIndex: number,
  tileCount: number,
  isRecall: boolean,
): RulesRound {
  const rule = rules[ruleIndex];
  const inCat = CURRICULUM.categories[rule.category].filter((m) =>
    icons.includes(m),
  );
  const confusable = (CATEGORY_CONFLICTS[rule.category] ?? []).flatMap(
    (c) => CURRICULUM.categories[c],
  );
  const outCat = icons.filter(
    (i) =>
      !CURRICULUM.categories[rule.category].includes(i) &&
      !confusable.includes(i),
  );
  const matchCount = Math.min(2 + Math.floor(rng() * 2), inCat.length); // 2-3 matches
  const matches = shuffle(rng, inCat).slice(0, matchCount);
  const fillers = shuffle(rng, outCat).slice(0, tileCount - matchCount);
  const tiles = shuffle(rng, [
    ...matches.map((icon) => ({ icon, isMatch: true })),
    ...fillers.map((icon) => ({ icon, isMatch: false })),
  ]);
  return { ruleNumber: ruleIndex + 1, rule, isRecall, tiles, matchCount };
}

function isRecallRound(idx: number, recallFrom: number): boolean {
  return idx >= recallFrom && idx % 3 === 2;
}

export function pickRuleIndex(
  rng: Rng,
  idx: number,
  recallFrom: number,
  rules: Rule[],
): { ruleIdx: number; isRecall: boolean } {
  const isRecall = isRecallRound(idx, recallFrom);
  let recallCount = 0;
  for (let k = 0; k < idx; k++) {
    if (isRecallRound(k, recallFrom)) recallCount++;
  }
  const introduced = idx - recallCount;
  if (!isRecall) {
    return { ruleIdx: introduced, isRecall: false };
  }

  const pool = Array.from({ length: introduced }, (_, i) => i);
  const nextCat = rules[introduced]?.category;
  const prevCat = introduced > 0 ? rules[introduced - 1]?.category : undefined;
  const filtered = pool.filter(
    (i) => rules[i].category !== nextCat && rules[i].category !== prevCat,
  );
  const validPool =
    filtered.length > 0
      ? filtered
      : pool.filter((i) => rules[i].category !== nextCat);
  const ruleIdx =
    validPool.length > 0
      ? validPool[Math.floor(rng() * validPool.length)]
      : Math.floor(rng() * introduced);
  return { ruleIdx, isRecall: true };
}

/** Localized screen-reader label for a rules tile icon. */
export function tileLabel(icon: string, lang: Lang = "en"): string {
  const entry = WORDS.find((w) => w.icon === icon);
  if (!entry) throw new Error(`Unknown rules icon: ${icon}`);
  return wordFor(entry, lang).text;
}

/** Localized spoken intro line for RulesGame. */
export function rulesIntroLine(lang: Lang = "en"): string {
  if (lang === "en") {
    return "Rule Time! Do what the rule says as fast as you can.";
  }
  return `${t(lang, "shell.rules.title")} ${t(lang, "shell.rules.sub")}`;
}

/** Localized spoken memory check line for RulesGame recall rounds. */
export function rulesRecallLine(ruleNumber: number, lang: Lang = "en"): string {
  return `${t(lang, "rules.memoryCheck")} ${t(lang, "rules.doAgain", { n: ruleNumber })}`;
}

export interface RulesLayout {
  tile: number;
  gap: number;
  cols: number;
  rows: number;
  isLandscape: boolean;
}

/**
 * Computes responsive tile and grid layout for RulesGame.
 * On landscape viewports, the rule card sits beside the grid rather than
 * stacked vertically, freeing vertical space so the grid fits without overflow.
 */
export function rulesLayout(
  width: number,
  height: number,
  tileCount: number,
): RulesLayout {
  const isLandscape = width > height;
  const cols = 3;
  const rows = Math.ceil(tileCount / cols);

  if (isLandscape) {
    const gap = 10;
    // Available height: screen height minus GameShell header (84px),
    // progress hint text & gap (~28px), and safety margins (~12px).
    const availH = height - 124;
    // Available width for grid: screen width minus outer padding (32px),
    // rule card column (220px), and horizontal gap (20px).
    const availW = width - 272;
    const tileH = (availH - (rows - 1) * gap) / rows;
    const tileW = (availW - (cols - 1) * gap) / cols;
    const tile = Math.max(44, Math.floor(Math.min(tileH, tileW, 120)));
    return { tile, gap, cols, rows, isLandscape };
  }

  const gap = 12;
  const availW = Math.min(width - 32, 520);
  const availH = height - 84 - 130;
  const tile = Math.max(
    44,
    Math.min(
      (availW - (cols - 1) * gap) / cols,
      (availH - (rows - 1) * gap) / rows,
      140,
    ),
  );
  return { tile, gap, cols, rows, isLandscape };
}
