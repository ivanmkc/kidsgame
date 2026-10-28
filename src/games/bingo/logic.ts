// Educational Bingo: pure game logic.
// Modes:
//   name    — "Find the banana!" (all 4 langs)
//   phonics — "Find something that starts with buh!" (EN only, 3x3)
//
// Board is constructed around the call list: every call has EXACTLY one
// correct tile — phonics boards carry distinct first-sounds (alternate
// child names included), name boards never show two icons a kid would
// call by the same word.
import { t } from "../../i18n";
import { Lang } from "../../lang";
import { Rng, shuffle } from "../../rng";
import { WORDS, WordEntry, soundsFor, wordFor } from "../../words";

export type BingoMode = "name" | "phonics";

export interface BingoCell {
  icon: string;
  label: string;
}

export interface BingoCall {
  mode: BingoMode;
  answerIdx: number;
  promptLines: string[];
  confirmLines: string[];
  sound?: string;
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

export interface BingoLayout {
  tileSize: number;
  gap: number;
  isLandscape: boolean;
}

export function bingoLayout(
  width: number,
  height: number,
  size: number,
): BingoLayout {
  const isLandscape = width > height;
  if (isLandscape) {
    // Landscape: prompt card is placed side-by-side with the grid, freeing
    // vertical height so tiles maintain child-accessible touch targets (>= 64px).
    const gap = size === 4 ? 8 : 10;
    const availH = height - 84 - 10;
    const availW = width - 32 - 20 - 220;
    const tileH = (availH - (size - 1) * gap) / size;
    const tileW = (availW - (size - 1) * gap) / size;
    const tileSize = Math.max(44, Math.floor(Math.min(tileH, tileW, 130)));
    return { tileSize, gap, isLandscape };
  }

  // Portrait: prompt stacked vertically above the grid.
  const gap = 10;
  const availW = Math.min(width - 32, 520);
  const availH = height - 84 - 140;
  const tileW = (availW - (size - 1) * gap) / size;
  const tileH = (availH - (size - 1) * gap) / size;
  const tileSize = Math.max(44, Math.floor(Math.min(tileW, tileH, 130)));
  return { tileSize, gap, isLandscape };
}

export function settingsForBingo(
  difficulty: "easy" | "medium" | "hard",
  lang: Lang,
): BingoSettings {
  if (lang === "en") {
    if (difficulty === "easy") return { gridSize: 3, mode: "name" };
    if (difficulty === "medium") return { gridSize: 4, mode: "name" };
    return { gridSize: 3, mode: "phonics" };
  }
  if (difficulty === "easy") return { gridSize: 3, mode: "name" };
  if (difficulty === "hard") return { gridSize: 5, mode: "name" };
  return { gridSize: 4, mode: "name" };
}

const NAME_ASK: Record<Lang, string> = {
  en: "",
  ja: "さがしてね",
  cmn: "找一找",
  yue: "搵一搵",
};

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function entryFor(icon: string): WordEntry | undefined {
  return WORDS.find((w) => w.icon === icon);
}

export function tileLabel(icon: string, lang: Lang): string {
  const entry = entryFor(icon);
  if (!entry) throw new Error(`Unknown bingo icon: ${icon}`);
  return wordFor(entry, lang).text;
}

function namePromptLines(icon: string, lang: Lang): string[] {
  const entry = entryFor(icon);
  if (lang === "en") {
    return [t("en", "bingo.prompt", { word: entry ? entry.en : icon })];
  }
  if (!entry) {
    return [t("en", "bingo.prompt", { word: icon })];
  }
  const w = wordFor(entry, lang);
  const ask = NAME_ASK[lang];
  return [ask, `${w.text}！`];
}

function nameConfirmLines(icon: string, lang: Lang): string[] {
  const entry = entryFor(icon);
  if (!entry) return [`${icon}!`];
  if (lang === "en") return [`${capitalize(entry.en)}!`];
  const w = wordFor(entry, lang);
  return [`${w.text}！`];
}

function phonicsVoiceSound(sound: string): string {
  // Pre-rendered phonics audio clips were generated using 'ah' for apple's
  // short-a /æ/ sound before words.ts differentiated apple ('aa') from
  // octopus ('ah'). Map 'aa' to 'ah' for voice playback so Bingo plays
  // the human pre-rendered clips instead of falling back to robotic TTS.
  return sound === "aa" ? "ah" : sound;
}

function phonicsSoundsFor(w: WordEntry): string[] {
  const sounds = soundsFor(w);
  const voiceSound = phonicsVoiceSound(w.sound);
  if (voiceSound !== w.sound && !sounds.includes(voiceSound)) {
    return [...sounds, voiceSound];
  }
  return sounds;
}

function phonicsPromptLines(sound: string): string[] {
  return [t("en", "bingo.promptPhonics", { sound: phonicsVoiceSound(sound) })];
}

function phonicsConfirmLines(icon: string): string[] {
  const entry = entryFor(icon);
  if (!entry) return [`${icon}!`];
  return [
    `${capitalize(entry.en)}!`,
    t("en", "bingo.confirmPhonics", {
      word: capitalize(entry.en),
      sound: phonicsVoiceSound(entry.sound),
    }),
  ];
}

function playablePool(icons: string[]): WordEntry[] {
  return WORDS.filter((w) => icons.includes(w.icon));
}

export function makeBoard(
  rng: Rng,
  icons: string[],
  size: number,
  mode: BingoMode,
  lang: Lang,
): BingoBoard {
  const cellCount = size * size;
  const pool = playablePool(icons);

  let selected: WordEntry[];
  if (mode === "phonics") {
    // Every cell becomes a call, so the whole BOARD has to be unambiguous:
    // no two icons may share a first-sound — counting the alternate names a
    // kid might use ("bunny" makes the rabbit a 'buh' answer next to the
    // butterfly). Icons that carry only their canonical sound go in first;
    // the alternate-carrying ones claim two sounds each and would starve a
    // 9-cell board if they went first.
    const claimed = new Set<string>();
    const byPickiness = [
      ...shuffle(
        rng,
        pool.filter((w) => soundsFor(w).length === 1),
      ),
      ...shuffle(
        rng,
        pool.filter((w) => soundsFor(w).length > 1),
      ),
    ];
    selected = [];
    for (const w of byPickiness) {
      if (selected.length >= cellCount) break;
      const sounds = phonicsSoundsFor(w);
      if (sounds.some((snd) => claimed.has(snd))) continue;
      sounds.forEach((snd) => claimed.add(snd));
      selected.push(w);
    }
    if (selected.length < cellCount) {
      // Pool too thin for a fully clean board: fall back to canonical-sound
      // uniqueness (the pre-existing guarantee) rather than shipping a
      // short board.
      const canonical = new Set(
        selected.map((w) => phonicsVoiceSound(w.sound)),
      );
      for (const w of shuffle(
        rng,
        pool.filter((w) => !selected.includes(w)),
      )) {
        if (selected.length >= cellCount) break;
        const sound = phonicsVoiceSound(w.sound);
        if (canonical.has(sound)) continue;
        canonical.add(sound);
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

  const boardIcons = shuffle(
    rng,
    selected.map((w) => w.icon),
  );
  const cells: BingoCell[] = boardIcons.map((icon) => ({
    icon,
    label: tileLabel(icon, lang),
  }));

  const callOrder = shuffle(
    rng,
    Array.from({ length: cellCount }, (_, i) => i),
  );
  const calls: BingoCall[] = callOrder.map((idx) => {
    const icon = cells[idx].icon;
    if (mode === "phonics") {
      const entry = entryFor(icon)!;
      return {
        mode,
        answerIdx: idx,
        sound: phonicsVoiceSound(entry.sound),
        promptLines: phonicsPromptLines(entry.sound),
        confirmLines: phonicsConfirmLines(icon),
      };
    }
    return {
      mode,
      answerIdx: idx,
      promptLines: namePromptLines(icon, lang),
      confirmLines: nameConfirmLines(icon, lang),
    };
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
  const diag2 = Array.from(
    { length: size },
    (_, i) => i * size + (size - 1 - i),
  );
  if (diag2.every((i) => marked[i])) return diag2;
  return null;
}

const BINGO_SHOUT: Record<Lang, string> = {
  en: "BINGO!",
  ja: "ビンゴ！",
  cmn: "宾果！",
  yue: "BINGO!",
};

export function bingoShout(lang: Lang): string {
  return BINGO_SHOUT[lang];
}

export function speechLines(): string[] {
  const s = new Set<string>();
  for (const lang of ["en", "ja", "cmn", "yue"] as const) {
    s.add(BINGO_SHOUT[lang]);
    if (lang !== "en") s.add(NAME_ASK[lang]);
    for (const w of WORDS) {
      for (const l of namePromptLines(w.icon, lang)) s.add(l);
      for (const l of nameConfirmLines(w.icon, lang)) s.add(l);
    }
  }
  const seenSound = new Set<string>();
  for (const w of WORDS) {
    const sound = phonicsVoiceSound(w.sound);
    if (!seenSound.has(sound)) {
      seenSound.add(sound);
      for (const l of phonicsPromptLines(sound)) s.add(l);
    }
    for (const l of phonicsConfirmLines(w.icon)) s.add(l);
  }
  return [...s];
}
