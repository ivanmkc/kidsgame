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
  next: string;
  icon?: string; // illustrated button — pre-readers pick by picture
}

export interface StoryScare extends Box {
  pop: string;        // transparent sprite that springs from the region
  sting: 'boing' | 'thunder';
  reveal: string;     // spoken after the pop (delay controls the beat)
  delay: number;      // ms between pop and reveal (0 = instant comfort)
}

export interface StoryNode {
  image: string;
  text: string;
  choices?: StoryChoice[];
  scare?: StoryScare;
}

export interface Story {
  id: string;
  title: string;
  nodes: Record<string, StoryNode>;
}

export interface Manifest {
  spotit: { icons: string[] };
  dressup?: string[];
  stories?: Story[];
  diff: DiffScene[];
  hidden: HiddenScene[];
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
