import { useCallback, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { Lang, LANGS } from "./lang";

const KEY = "kgb.lockdown.v1";

export interface LockdownState {
  hiddenGames: string[];
  hiddenLangs: string[];
}

const EMPTY: LockdownState = { hiddenGames: [], hiddenLangs: [] };

let memoryFallback: LockdownState = EMPTY;

function read(): LockdownState {
  if (Platform.OS !== "web" || typeof window === "undefined")
    return memoryFallback;
  if (memoryFallback !== EMPTY) return memoryFallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      hiddenGames: Array.isArray(parsed.hiddenGames) ? parsed.hiddenGames : [],
      hiddenLangs: Array.isArray(parsed.hiddenLangs) ? parsed.hiddenLangs : [],
    };
  } catch {
    return memoryFallback;
  }
}

function write(state: LockdownState): void {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    memoryFallback = state;
    return;
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    memoryFallback = EMPTY;
  } catch {
    memoryFallback = state;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notifyListeners() {
  for (const fn of listeners) fn();
}
function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let snapshotCache: LockdownState | null = null;
let snapshotSerial = 0;
let lastSerial = -1;

function getSnapshot(): LockdownState {
  if (lastSerial !== snapshotSerial) {
    snapshotCache = read();
    lastSerial = snapshotSerial;
  }
  return snapshotCache!;
}

function bump() {
  snapshotSerial++;
  snapshotCache = null;
  notifyListeners();
}

export function useLockdown(): {
  state: LockdownState;
  isActive: boolean;
  isGameHidden: (id: string) => boolean;
  isLangHidden: (lang: Lang) => boolean;
  setHiddenGames: (ids: string[]) => void;
  setHiddenLangs: (langs: string[]) => void;
  toggleGame: (id: string) => void;
  toggleLang: (lang: Lang) => boolean;
  allowedLangs: Lang[];
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const isActive = state.hiddenGames.length > 0 || state.hiddenLangs.length > 0;

  const isGameHidden = useCallback(
    (id: string) => state.hiddenGames.includes(id),
    [state.hiddenGames],
  );

  const isLangHidden = useCallback(
    (lang: Lang) => state.hiddenLangs.includes(lang),
    [state.hiddenLangs],
  );

  const setHiddenGames = useCallback((ids: string[]) => {
    const cur = read();
    write({ ...cur, hiddenGames: ids });
    bump();
  }, []);

  const setHiddenLangs = useCallback((langs: string[]) => {
    const cur = read();
    write({ ...cur, hiddenLangs: langs });
    bump();
  }, []);

  const toggleGame = useCallback((id: string) => {
    const cur = read();
    const hidden = cur.hiddenGames.includes(id)
      ? cur.hiddenGames.filter((g) => g !== id)
      : [...cur.hiddenGames, id];
    write({ ...cur, hiddenGames: hidden });
    bump();
  }, []);

  const toggleLang = useCallback((lang: Lang): boolean => {
    const cur = read();
    const allLangIds = LANGS.map((l) => l.id);
    if (cur.hiddenLangs.includes(lang)) {
      write({ ...cur, hiddenLangs: cur.hiddenLangs.filter((l) => l !== lang) });
      bump();
      return true;
    }
    const wouldHide = [...cur.hiddenLangs, lang];
    const remaining = allLangIds.filter((l) => !wouldHide.includes(l));
    if (remaining.length === 0) return false;
    write({ ...cur, hiddenLangs: wouldHide });
    bump();
    return true;
  }, []);

  const allowedLangs = LANGS.map((l) => l.id).filter(
    (l) => !state.hiddenLangs.includes(l),
  );

  return {
    state,
    isActive,
    isGameHidden,
    isLangHidden,
    setHiddenGames,
    setHiddenLangs,
    toggleGame,
    toggleLang,
    allowedLangs,
  };
}

export function effectiveLang(current: Lang, hiddenLangs: string[]): Lang {
  if (!hiddenLangs.includes(current)) return current;
  const allIds = LANGS.map((l) => l.id);
  const allowed = allIds.filter((l) => !hiddenLangs.includes(l));
  return allowed[0] ?? "en";
}

export function visibleCards<T extends { route: string }>(
  cards: T[],
  hiddenGames: string[],
): T[] {
  if (hiddenGames.length === 0) return cards;
  return cards.filter((c) => !hiddenGames.includes(c.route));
}

export const GATE_WORDS: Record<Lang, readonly string[]> = {
  en: [
    "bicycle",
    "giraffe",
    "kitchen",
    "purple",
    "bridge",
    "tunnel",
    "window",
    "garden",
    "orange",
    "basket",
    "dolphin",
    "volcano",
    "blanket",
    "crystal",
    "feather",
  ],
  ja: [
    "保護者",
    "設定",
    "確認",
    "台所",
    "自転車",
    "窓口",
    "庭園",
    "火山",
    "毛布",
    "結晶",
    "羽毛",
    "眼鏡",
    "階段",
    "図書館",
    "封筒",
  ],
  cmn: [
    "保护",
    "设置",
    "确认",
    "密码",
    "台灯",
    "厨房",
    "自行车",
    "窗户",
    "火山",
    "毛毯",
    "羽毛",
    "水饺",
    "眼镜",
    "楼梯",
    "日历",
  ],
  yue: [
    "保護",
    "設置",
    "確認",
    "密碼",
    "檯燈",
    "廚房",
    "單車",
    "窗戶",
    "火山",
    "毛氈",
    "羽毛",
    "水餃",
    "眼鏡",
    "樓梯",
    "日曆",
  ],
};

export function randomGateWord(lang: Lang = "en"): string {
  const pool = GATE_WORDS[lang] ?? GATE_WORDS.en;
  return pool[Math.floor(Math.random() * pool.length)];
}
