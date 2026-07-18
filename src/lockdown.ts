import { useState, useCallback, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { Lang, LANGS } from './lang';

const KEY = 'kgb.lockdown.v1';

export interface LockdownState {
  hiddenGames: string[];
  hiddenLangs: string[];
}

const EMPTY: LockdownState = { hiddenGames: [], hiddenLangs: [] };

function read(): LockdownState {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      hiddenGames: Array.isArray(parsed.hiddenGames) ? parsed.hiddenGames : [],
      hiddenLangs: Array.isArray(parsed.hiddenLangs) ? parsed.hiddenLangs : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(state: LockdownState): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* quota or private browsing */ }
  notifyListeners();
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notifyListeners() {
  for (const fn of listeners) fn();
}
function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
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

  const allowedLangs = LANGS
    .map((l) => l.id)
    .filter((l) => !state.hiddenLangs.includes(l));

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
  return allowed[0] ?? 'en';
}

export function visibleCards<T extends { route: string }>(
  cards: T[],
  hiddenGames: string[],
): T[] {
  if (hiddenGames.length === 0) return cards;
  return cards.filter((c) => !hiddenGames.includes(c.route));
}

export const GATE_WORDS = [
  'bicycle', 'giraffe', 'kitchen', 'purple', 'rocket',
  'seven', 'window', 'garden', 'orange', 'basket',
  'dolphin', 'volcano', 'blanket', 'crystal', 'feather',
];

export function randomGateWord(): string {
  return GATE_WORDS[Math.floor(Math.random() * GATE_WORDS.length)];
}
