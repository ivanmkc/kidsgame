import { Platform } from 'react-native';

export interface Player {
  id: string;
  name: string;
  avatar: string; // spot-it icon name
}

export const AVATAR_CHOICES = ['unicorn', 'blossom', 'rainbow', 'star', 'butterfly', 'cat'];

const DEFAULT_PLAYERS: Player[] = [
  { id: 'p1', name: 'Big Sis', avatar: 'unicorn' },
  { id: 'p2', name: 'Little Sis', avatar: 'blossom' },
];

const KEY = 'kgb.players.v1';

export function loadPlayers(): Player[] {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Player[];
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      }
    } catch {
      // fall through to defaults
    }
  }
  return DEFAULT_PLAYERS.map((p) => ({ ...p }));
}

export function savePlayers(players: Player[]): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(players));
    } catch {
      // storage full/blocked — non-fatal
    }
  }
}
