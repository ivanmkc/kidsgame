import { describe, expect, it } from 'vitest';
import { makeRng } from '../../rng';
import { CRITTER_ICONS, countSettings, makeCountChoices, makeCountRound, scatterPositions, speechLines as countSpeechLines } from '../count/logic';
import { compareSettings, makeCompareRound, speechLines as compareSpeechLines } from '../compare/logic';
import { makeSumChoices, makeSumsRound, speechLines as sumsSpeechLines, sumsSettings } from '../sums/logic';

const DIFFS = ['easy', 'medium', 'hard'] as const;

/** Any two positions in the 100×100 stage must sit at least this far apart
 *  — enough that critters never visually collapse into one blob. */
const MIN_SEP = 10;

function minPairDistance(pos: { x: number; y: number }[]): number {
  let m = Infinity;
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y);
      if (d < m) m = d;
    }
  }
  return m;
}

describe('scatterPositions (shared)', () => {
  it('n items, all inside 0..100 bounds, minimum pair distance stays healthy (200 seeds × n=1..10)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = makeRng(seed);
      for (let n = 1; n <= 10; n++) {
        const pos = scatterPositions(rng, n);
        expect(pos).toHaveLength(n);
        for (const p of pos) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(100);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(100);
        }
        if (n >= 2) expect(minPairDistance(pos)).toBeGreaterThanOrEqual(MIN_SEP);
      }
    }
  });
});

describe('count with me', () => {
  for (const d of DIFFS) {
    it(`${d}: n in [min,max], positions non-overlapping, choices contain the answer (200 seeds)`, () => {
      const { min, max } = countSettings(d);
      for (let seed = 1; seed <= 200; seed++) {
        const round = makeCountRound(makeRng(seed), d);
        expect(round.n).toBeGreaterThanOrEqual(min);
        expect(round.n).toBeLessThanOrEqual(max);
        expect(round.positions).toHaveLength(round.n);
        if (round.n >= 2) expect(minPairDistance(round.positions)).toBeGreaterThanOrEqual(MIN_SEP);
        expect(round.icon).toBeTruthy();
        expect(CRITTER_ICONS).toContain(round.icon);
        expect(round.choices).toHaveLength(3);
        expect(new Set(round.choices).size).toBe(3);
        expect(round.choices).toContain(round.answer);
        expect(round.answer).toBe(round.n);
      }
    });
  }

  it('makeCountChoices never returns duplicates even at the corners', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const [answer, max] of [[1, 1], [1, 3], [5, 5], [8, 8], [10, 10]] as const) {
        const c = makeCountChoices(makeRng(seed * (answer + max + 1)), answer, max);
        expect(c).toHaveLength(3);
        expect(new Set(c).size).toBe(3);
        expect(c).toContain(answer);
      }
    }
  });
});

describe('more or less', () => {
  for (const d of DIFFS) {
    const { minGap, range: [lo, hi], fewerFraction } = compareSettings(d);
    it(`${d}: counts differ by ≥ ${minGap}, in [${lo},${hi}], correct side flagged (200 seeds)`, () => {
      let fewerCount = 0;
      const seeds = 200;
      for (let seed = 1; seed <= seeds; seed++) {
        const r = makeCompareRound(makeRng(seed), d);
        expect(r.left.count).not.toBe(r.right.count);
        expect(Math.abs(r.left.count - r.right.count)).toBeGreaterThanOrEqual(minGap);
        for (const c of [r.left.count, r.right.count]) {
          expect(c).toBeGreaterThanOrEqual(lo);
          expect(c).toBeLessThanOrEqual(hi);
        }
        // correctSide is consistent with the ask
        const winner = r.ask === 'more'
          ? (r.left.count > r.right.count ? 'left' : 'right')
          : (r.left.count < r.right.count ? 'left' : 'right');
        expect(r.correctSide).toBe(winner);
        if (r.ask === 'fewer') fewerCount++;
        // per-side positions non-overlapping
        expect(r.left.positions).toHaveLength(r.left.count);
        expect(r.right.positions).toHaveLength(r.right.count);
        if (r.left.count >= 2) expect(minPairDistance(r.left.positions)).toBeGreaterThanOrEqual(MIN_SEP);
        if (r.right.count >= 2) expect(minPairDistance(r.right.positions)).toBeGreaterThanOrEqual(MIN_SEP);
        // icons distinct so left/right stay visually separable
        expect(r.left.icon).not.toBe(r.right.icon);
      }
      if (fewerFraction === 0) {
        expect(fewerCount).toBe(0);
      } else {
        // ≈ 30% of hard rounds ask FEWER — wide band avoids flake
        expect(fewerCount).toBeGreaterThan(seeds * 0.15);
        expect(fewerCount).toBeLessThan(seeds * 0.45);
      }
    });
  }
});

describe('little sums', () => {
  for (const d of DIFFS) {
    const { maxSum } = sumsSettings(d);
    it(`${d}: a+b within cap ${maxSum}, choices unique and contain the sum (200 seeds)`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const r = makeSumsRound(makeRng(seed), d);
        expect(r.a).toBeGreaterThanOrEqual(1);
        expect(r.b).toBeGreaterThanOrEqual(1);
        expect(r.a + r.b).toBe(r.sum);
        expect(r.sum).toBeLessThanOrEqual(maxSum);
        expect(r.sum).toBeGreaterThanOrEqual(2);
        expect(r.aPositions).toHaveLength(r.a);
        expect(r.bPositions).toHaveLength(r.b);
        const all = [...r.aPositions, ...r.bPositions];
        if (all.length >= 2) expect(minPairDistance(all)).toBeGreaterThanOrEqual(MIN_SEP);
        expect(r.choices).toHaveLength(3);
        expect(new Set(r.choices).size).toBe(3);
        expect(r.choices).toContain(r.sum);
        expect(CRITTER_ICONS).toContain(r.icon);
      }
    });
  }

  it('makeSumChoices holds up at extremes', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const [answer, cap] of [[2, 5], [5, 5], [7, 7], [10, 10]] as const) {
        const c = makeSumChoices(makeRng(seed * (answer + cap + 1)), answer, cap);
        expect(c).toHaveLength(3);
        expect(new Set(c).size).toBe(3);
        expect(c).toContain(answer);
      }
    }
  });
});

describe('speechLines()', () => {
  it('count: non-empty and unique', () => {
    const l = countSpeechLines();
    expect(l.length).toBeGreaterThan(0);
    expect(new Set(l).size).toBe(l.length);
    for (const s of l) expect(s.trim()).not.toBe('');
    // prompt + praise × 4 langs = 8 distinct lines
    expect(l.length).toBe(8);
  });
  it('compare: non-empty and unique', () => {
    const l = compareSpeechLines();
    expect(l.length).toBeGreaterThan(0);
    expect(new Set(l).size).toBe(l.length);
    // more + fewer + praise × 4 langs = 12
    expect(l.length).toBe(12);
  });
  it('sums: non-empty and unique', () => {
    const l = sumsSpeechLines();
    expect(l.length).toBeGreaterThan(0);
    expect(new Set(l).size).toBe(l.length);
    // plus + question + praise × 4 langs = 12, but 'plus' collides between cmn and yue ('加') → 11
    expect(l.length).toBeGreaterThanOrEqual(10);
  });
});
