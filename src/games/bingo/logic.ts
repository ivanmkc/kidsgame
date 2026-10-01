// Educational Bingo: pure game logic.
// Modes:
//   name    — "Find the banana!" (all 4 langs)
//   phonics — "Find something that starts with buh!" (EN only, 3x3)
//
// Board is constructed around the call list: every call has EXACTLY one
// correct tile — phonics boards carry distinct first-sounds (alternate
// child names included), name boards never show two icons a kid would
// call by the same word.
import { Lang } from '../../lang';
import { Rng, shuffle } from '../../rng';
import { WORDS, WordEntry, soundsFor, wordFor } from '../language/words';

export type BingoMode = 'name' | 'phonics';

export interface BingoCell {
  icon: string;
}

export interface BingoCall {
  mode: BingoMode;
  answerIdx: number;
  promptLines: string[];
  displayPrompt: string;
  confirmLines: string[];
}

export interface BingoBoard {
  size: number;
  cells: BingoCell[];
  calls: BingoCall[];
}

export interface BingoSettings {
  gridSize: number;
  mode: BingoMode;
}

export function settingsForBingo(difficulty: 'easy' | 'medium' | 'hard', lang: Lang): BingoSettings {
  if (difficulty === 'easy') return { gridSize: 3, mode: 'name' };
  if (difficulty === 'hard') return { gridSize: 4, mode: 'name' };
  return { gridSize: 3, mode: lang === 'en' ? 'phonics' : 'name' };
}

const NAME_ASK: Record<Lang, string> = {
  en: '',
  ja: 'さがしてね',
  cmn: '找一找',
  yue: '搵一搵',
};

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function entryFor(icon: string): WordEntry | undefined {
  return WORDS.find((w) => w.icon === icon);
}

function namePromptLines(icon: string, lang: Lang): { prompt: string[]; display: string } {
  const entry = entryFor(icon);
  if (!entry) {
    const line = `Find the ${icon}!`;
    return { prompt: [line], display: line };
  }
  if (lang === 'en') {
    const line = `Find the ${entry.en}!`;
    return { prompt: [line], display: line };
  }
  const w = wordFor(entry, lang);
  const ask = NAME_ASK[lang];
  return { prompt: [ask, `${w.text}！`], display: `${ask} ${w.text}！` };
}

function nameConfirmLines(icon: string, lang: Lang): string[] {
  const entry = entryFor(icon);
  if (!entry) return [`${icon}!`];
  if (lang === 'en') return [`${capitalize(entry.en)}!`];
  const w = wordFor(entry, lang);
  return [`${w.text}！`];
}

function phonicsPromptLines(sound: string): { prompt: string[]; display: string } {
  const line = `Find something that starts with ${sound}!`;
  return { prompt: [line], display: line };
}

function phonicsConfirmLines(icon: string): string[] {
  const entry = entryFor(icon);
  if (!entry) return [`${icon}!`];
  return [
    `${capitalize(entry.en)}!`,
    `${capitalize(entry.en)} starts with ${entry.sound}!`,
  ];
}

function playablePool(icons: string[]): WordEntry[] {
  return WORDS.filter((w) => icons.includes(w.icon));
}

export function makeBoard(
  rng: Rng, icons: string[], size: number, mode: BingoMode, lang: Lang,
): BingoBoard {
  const cellCount = size * size;
  const pool = playablePool(icons);

  let selected: WordEntry[];
  if (mode === 'phonics') {
    // Every cell becomes a call, so the whole BOARD has to be unambiguous:
    // no two icons may share a first-sound — counting the alternate names a
    // kid might use ("bunny" makes the rabbit a 'buh' answer next to the
    // butterfly). Icons that carry only their canonical sound go in first;
    // the alternate-carrying ones claim two sounds each and would starve a
    // 9-cell board if they went first.
    const claimed = new Set<string>();
    const byPickiness = [
      ...shuffle(rng, pool.filter((w) => soundsFor(w).length === 1)),
      ...shuffle(rng, pool.filter((w) => soundsFor(w).length > 1)),
    ];
    selected = [];
    for (const w of byPickiness) {
      if (selected.length >= cellCount) break;
      const sounds = soundsFor(w);
      if (sounds.some((snd) => claimed.has(snd))) continue;
      sounds.forEach((snd) => claimed.add(snd));
      selected.push(w);
    }
    if (selected.length < cellCount) {
      // Pool too thin for a fully clean board: fall back to canonical-sound
      // uniqueness (the pre-existing guarantee) rather than shipping a
      // short board.
      const canonical = new Set(selected.map((w) => w.sound));
      for (const w of shuffle(rng, pool.filter((w) => !selected.includes(w)))) {
        if (selected.length >= cellCount) break;
        if (canonical.has(w.sound)) continue;
        canonical.add(w.sound);
        selected.push(w);
      }
    }
  } else {
    // Name mode: "Find the flower!" must not have both the blossom and the
    // sunflower to choose from.
    const twinned = new Set<string>();
    selected = [];
    for (const w of shuffle(rng, [...pool])) {
      if (selected.length >= cellCount) break;
      if (twinned.has(w.icon)) continue;
      (w.nameTwins ?? []).forEach((t) => twinned.add(t));
      selected.push(w);
    }
  }

  const boardIcons = shuffle(rng, selected.map((w) => w.icon));
  const cells: BingoCell[] = boardIcons.map((icon) => ({ icon }));

  const callOrder = shuffle(rng, Array.from({ length: cellCount }, (_, i) => i));
  const calls: BingoCall[] = callOrder.map((idx) => {
    const icon = cells[idx].icon;
    if (mode === 'phonics') {
      const entry = entryFor(icon)!;
      const { prompt, display } = phonicsPromptLines(entry.sound);
      return { mode, answerIdx: idx, promptLines: prompt, displayPrompt: display, confirmLines: phonicsConfirmLines(icon) };
    }
    const { prompt, display } = namePromptLines(icon, lang);
    return { mode, answerIdx: idx, promptLines: prompt, displayPrompt: display, confirmLines: nameConfirmLines(icon, lang) };
  });

  return { size, cells, calls };
}

export function checkBingo(marked: boolean[], size: number): number[] | null {
  for (let r = 0; r < size; r++) {
    const row = Array.from({ length: size }, (_, c) => r * size + c);
    if (row.every((i) => marked[i])) return row;
  }
  for (let c = 0; c < size; c++) {
    const col = Array.from({ length: size }, (_, r) => r * size + c);
    if (col.every((i) => marked[i])) return col;
  }
  const diag1 = Array.from({ length: size }, (_, i) => i * size + i);
  if (diag1.every((i) => marked[i])) return diag1;
  const diag2 = Array.from({ length: size }, (_, i) => i * size + (size - 1 - i));
  if (diag2.every((i) => marked[i])) return diag2;
  return null;
}

const BINGO_SHOUT: Record<Lang, string> = {
  en: 'BINGO!',
  ja: 'ビンゴ！',
  cmn: '宾果！',
  yue: 'BINGO！',
};

export function bingoShout(lang: Lang): string {
  return BINGO_SHOUT[lang];
}

export function speechLines(): string[] {
  const s = new Set<string>();
  for (const lang of ['en', 'ja', 'cmn', 'yue'] as const) {
    s.add(BINGO_SHOUT[lang]);
    if (lang !== 'en') s.add(NAME_ASK[lang]);
    for (const w of WORDS) {
      const { prompt } = namePromptLines(w.icon, lang);
      for (const l of prompt) s.add(l);
      for (const l of nameConfirmLines(w.icon, lang)) s.add(l);
    }
  }
  const seenSound = new Set<string>();
  for (const w of WORDS) {
    if (!seenSound.has(w.sound)) {
      seenSound.add(w.sound);
      const { prompt } = phonicsPromptLines(w.sound);
      for (const l of prompt) s.add(l);
    }
    for (const l of phonicsConfirmLines(w.icon)) s.add(l);
  }
  return [...s];
}
