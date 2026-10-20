import { LANGS, Lang } from '../../lang';
import { Rng, shuffle } from '../../rng';
import { CATEGORY_CONFLICTS, CATEGORY_TEXT, ICON_CATEGORIES } from '../iconCategories';

export const INTRO_PROMPTS: Record<Lang, string> = {
  en: 'Rule Time! Do what the rule says as fast as you can.',
  ja: 'ルールタイム！ ルールどおりに はやく タップ！',
  cmn: '规则时间！按规则尽快点对的图！',
  yue: '規則時間！跟住規則盡快撳啱嘅圖！',
};

export function introPrompt(lang: Lang): string {
  return INTRO_PROMPTS[lang] ?? INTRO_PROMPTS.en;
}

export function recallPrompt(lang: Lang, ruleNumber: number): string {
  switch (lang) {
    case 'ja':
      return `きおくクイズ！ ルール ${ruleNumber}ばん を もういちど。 おぼえてる？`;
    case 'cmn':
      return `记忆挑战！再做一次第${ruleNumber}条规则。还记得吗？`;
    case 'yue':
      return `記憶挑戰！再做一次第${ruleNumber}條規則。仲記得嗎？`;
    case 'en':
    default:
      return `Memory check! Do rule number ${ruleNumber} again. Do you remember it?`;
  }
}

/** Voice-clip contract: every spoken line across all supported languages. */
export function speechLines(): string[] {
  const lines: string[] = [];
  for (const l of LANGS) {
    lines.push(introPrompt(l.id));
    for (let n = 1; n <= 10; n++) {
      lines.push(recallPrompt(l.id, n));
    }
  }
  return [...new Set(lines)];
}

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
  const inCat = ICON_CATEGORIES[rule.category].filter((m) => icons.includes(m));
  const confusable = (CATEGORY_CONFLICTS[rule.category] ?? []).flatMap((c) => ICON_CATEGORIES[c]);
  const outCat = icons.filter(
    (i) => !ICON_CATEGORIES[rule.category].includes(i) && !confusable.includes(i),
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
): { ruleIdx: number; isRecall: boolean } {
  const isRecall = isRecallRound(idx, recallFrom);
  let recallCount = 0;
  for (let k = 0; k < idx; k++) {
    if (isRecallRound(k, recallFrom)) recallCount++;
  }
  const introduced = idx - recallCount;
  const ruleIdx = isRecall ? Math.floor(rng() * introduced) : introduced;
  return { ruleIdx, isRecall };
}
