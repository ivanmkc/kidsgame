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

export interface DiffScene {
  id: string;
  name: string;
  flagged?: boolean;
  level?: 'easy' | 'medium' | 'hard';
  imageA: string;
  imageB: string;
  w: number;
  h: number;
  diffs: DiffRegion[];
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

export interface Manifest {
  spotit: { icons: string[] };
  diff: DiffScene[];
  hidden: HiddenScene[];
}

export const manifest = raw as Manifest;

export function pickScene<T>(scenes: T[], avoidIndex?: number): { scene: T; index: number } {
  let index = Math.floor(Math.random() * scenes.length);
  if (scenes.length > 1 && index === avoidIndex) {
    index = (index + 1) % scenes.length;
  }
  return { scene: scenes[index], index };
}
