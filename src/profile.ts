import { Platform } from 'react-native';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Player {
  id: string;
  name: string;
  avatar: string; // spot-it icon name
  difficulty: Difficulty;
}

export const AVATAR_CHOICES = [
  'unicorn', 'blossom', 'rainbow', 'star', 'butterfly', 'cat',
  'dog', 'fox', 'panda', 'rocket', 'soccer', 'frog',
];

export const MAX_PLAYERS = 6;

const DEFAULT_PLAYERS: Player[] = [
  { id: 'p1', name: 'Unicorn', avatar: 'unicorn', difficulty: 'easy' },
  { id: 'p2', name: 'Blossom', avatar: 'blossom', difficulty: 'easy' },
];

const KEY = 'kgb.players.v2';
const OLD_KEY = 'kgb.players.v1';

function storage(): Storage | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function loadPlayers(): Player[] {
  const s = storage();
  if (s) {
    try {
      const raw = s.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Player[];
        if (Array.isArray(parsed) && parsed.length >= 1) return parsed;
      }
      // migrate v1 (pre-difficulty) profiles, keeping names/avatars
      const old = s.getItem(OLD_KEY);
      if (old) {
        const parsed = JSON.parse(old) as Omit<Player, 'difficulty'>[];
        if (Array.isArray(parsed) && parsed.length >= 1) {
          const migrated = parsed.map((p) => ({ ...p, difficulty: 'easy' as Difficulty }));
          s.setItem(KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch {
      // fall through to defaults
    }
  }
  return DEFAULT_PLAYERS.map((p) => ({ ...p }));
}

export function savePlayers(players: Player[]): void {
  const s = storage();
  if (s) {
    try {
      s.setItem(KEY, JSON.stringify(players));
    } catch {
      // storage full/blocked — non-fatal
    }
  }
}

export function newPlayer(existing: Player[]): Player {
  const used = new Set(existing.map((p) => p.avatar));
  const avatar = AVATAR_CHOICES.find((a) => !used.has(a)) ?? AVATAR_CHOICES[0];
  return {
    id: `p${Date.now().toString(36)}`,
    name: `Player ${existing.length + 1}`,
    avatar,
    difficulty: 'easy',
  };
}
