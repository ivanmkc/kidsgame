import raw from './assets/manifest.json';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DiffRegion extends Box {
  what: string;
}

export interface PoolEntry extends Box {
  name: string;
  patch: string; // changed-state crop composited over the base
  kind: 'remove' | 'recolor';
}

export interface DiffScene {
  id: string;
  name: string;
  flagged?: boolean;
  level?: 'easy' | 'medium' | 'hard';
  // legacy flat pair
  imageA?: string;
  imageB?: string;
  diffs?: DiffRegion[];
  // pooled schema: one base + a pool of composable differences
  image?: string;
  pool?: PoolEntry[];
  w: number;
  h: number;
}

export interface HiddenTarget extends Box {
  id: string;
  label: string;
  thumb: string;
}

export interface HiddenScene {
  id: string;
  name: string;
  flagged?: boolean;
  level?: 'easy' | 'medium' | 'hard';
  image: string;
  w: number;
  h: number;
  targets: HiddenTarget[];
}

export interface StoryChoice {
  label: string;
  t?: Record<string, string>; // ja/cmn/yue label — falls back to label
  next: string;
  icon?: string; // illustrated button — pre-readers pick by picture
  hot?: Box; // in-scene hotspot — the kid taps the door itself
  video?: string; // Veo action clip played on tap (public/story-video/)
}

export interface StoryScare extends Box {
  t?: Record<string, string>; // ja/cmn/yue reveal — falls back to reveal
  video?: string; // Veo clip of the surprise bursting out (plays on tap)
  pop: string;        // transparent sprite that springs from the region
  sting: 'boing' | 'thunder';
  reveal: string;     // spoken after the pop (delay controls the beat)
  delay: number;      // ms between pop and reveal (0 = instant comfort)
}

// Non-nav surprise spot: tap augments the scene (wiggle/sparkle/sfx +
// optional spoken line) without navigating. Subtler shimmer than a scare.
export interface StoryFx extends Box {
  sting?: 'boing' | 'tap' | 'flip';
  line?: string; // short spoken reaction (must have a voice clip)
}

export interface StoryNode {
  image: string;
  text: string;
  t?: Record<string, string>; // ja/cmn/yue narration — falls back to text
  choices?: StoryChoice[];
  fx?: StoryFx[];
  scare?: StoryScare;
  bad?: boolean; // oopsie ending — no confetti, offer 'try another way'
  video?: string; // ending nodes: gentle ambient Veo clip of the final scene
}

export interface Story {
  id: string;
  title: string;
  titleT?: Record<string, string>; // ja/cmn/yue title — falls back to title
  nodes: Record<string, StoryNode>;
}

// ── Escape rooms ─────────────────────────────────────────────────
// Kid-simplified escape: tap objects to search them, collect up to 3
// items into a tray, tap a tray item then tap the lock that needs it.
// Puzzle chains are 2-4 steps and statically verified solvable by the
// generator lint (every `needs` obtainable, win reachable).

export interface EscapeItem {
  id: string;
  label: string;   // spoken when found ("A shiny key!")
  emoji: string;   // tray icon — big and readable for age 3
}

export interface EscapeAfter extends Box {
  patch: string;       // changed-state crop composited over the base
}

export interface EscapeHotspot {
  id: string;
  box: Box;
  /** search: reveals/gives on tap. lock: needs an item. win: final goal (may need an item). */
  kind: 'search' | 'lock' | 'win';
  gives?: string;      // item id granted on successful tap
  needs?: string;      // item id that must be SELECTED in the tray
  pop?: string;        // transparent sprite that springs out (reveal beat)
  after?: EscapeAfter; // visual state after use (e.g. open chest) — composited + crossfaded
  sayFound?: string;   // spoken on success
  saySearch?: string;  // spoken on plain search with nothing there (flavor)
  sayLocked?: string;  // spoken when tapped without the needed item
}

export interface EscapeRoom {
  id: string;
  name: string;
  nameT?: Record<string, string>;
  level?: 'easy' | 'medium' | 'hard';
  image: string;
  intro: string;    // spoken once on entry — the mission
  winText: string;  // spoken on completion
  items: EscapeItem[];
  hotspots: EscapeHotspot[];
}

export interface Manifest {
  spotit: { icons: string[] };
  dressup?: string[];
  stories?: Story[];
  diff: DiffScene[];
  hidden: HiddenScene[];
  escape?: EscapeRoom[];
}

export const manifest = raw as unknown as Manifest;

export function pickScene<T>(scenes: T[], avoidIndex?: number): { scene: T; index: number } {
  let index = Math.floor(Math.random() * scenes.length);
  if (scenes.length > 1 && index === avoidIndex) {
    index = (index + 1) % scenes.length;
  }
  return { scene: scenes[index], index };
}

export const SCENE_AR = 16 / 9;

/** The one place that knows both diff schemas (pooled base vs legacy A/B). */
export function baseImage(s: DiffScene): string {
  return (s.image ?? s.imageA)!;
}
