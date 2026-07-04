import { Rng } from '../../rng';
import { sameCategory } from '../iconCategories';

export type OddKind = 'different' | 'category' | 'mirrored';

export interface OddOneRound {
  kind: OddKind;
  common: string;
  odd: string; // for 'mirrored' this equals common (the twin is flipped)
  items: { icon: string; mirrored: boolean }[];
  oddIndex: number;
}

// Mirroring a symmetric sticker (soccer ball, star) is invisible — the
// mirrored mode only ever uses clearly asymmetric icons.
export const ASYMMETRIC_ICONS = ['banana', 'fish', 'car', 'plane', 'unicorn', 'rocket'];

// easy: a clearly different icon. medium: a same-category icon (subtler).
// hard: the SAME icon, but the odd one is mirrored — pure visual scrutiny.
export function makeOddOneRound(rng: Rng, icons: string[], n: number, kind: OddKind): OddOneRound {
  const source = kind === 'mirrored' ? ASYMMETRIC_ICONS.filter((i) => icons.includes(i)) : icons;
  const common = source[Math.floor(rng() * source.length)];
  let odd: string;
  if (kind === 'mirrored') {
    odd = common;
  } else if (kind === 'category') {
    const pool = sameCategory(common).filter((i) => i !== common && icons.includes(i));
    odd = pool.length > 0
      ? pool[Math.floor(rng() * pool.length)]
      : icons.filter((i) => i !== common)[Math.floor(rng() * (icons.length - 1))];
  } else {
    const pool = icons.filter((i) => i !== common && !sameCategory(common).includes(i));
    odd = (pool.length > 0 ? pool : icons.filter((i) => i !== common))[
      Math.floor(rng() * Math.max(1, pool.length))
    ];
  }

  const items = Array.from({ length: n }, () => ({ icon: common, mirrored: false }));
  const oddIndex = Math.floor(rng() * n);
  items[oddIndex] = kind === 'mirrored' ? { icon: common, mirrored: true } : { icon: odd, mirrored: false };
  // shuffle-free: oddIndex already random; keep array order stable
  return { kind, common, odd, items, oddIndex };
}
