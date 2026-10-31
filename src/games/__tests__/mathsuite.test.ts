import { describe, expect, it } from "vitest";
import { makeRng } from "../../rng";
import {
  applyTap,
  countSettings,
  gridFor,
  makeCountChoices,
  makeCountRound,
  scatterPositions,
  speechLines as countSpeechLines,
} from "../count/logic";
import { CURRICULUM } from "../../curriculum/content";
import {
  PLATE_PADDING,
  compareSettings,
  comparisonPhrase,
  isFairPair,
  makeCompareRound,
  plateAccessibilityLabel,
  plateCritterPos,
  plateCritterSize,
  roundComparisonPhrase,
  speechLines as compareSpeechLines,
} from "../compare/logic";
import {
  makeSumChoices,
  makeSumsRound,
  speechLines as sumsSpeechLines,
  sumsSettings,
} from "../sums/logic";

const DIFFS = ["easy", "medium", "hard"] as const;

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

describe("scatterPositions (shared)", () => {
  it("n items, all inside 0..100 bounds, minimum pair distance stays healthy (200 seeds × n=1..10)", () => {
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
        if (n >= 2)
          expect(minPairDistance(pos)).toBeGreaterThanOrEqual(MIN_SEP);
      }
    }
  });
});

describe("count with me", () => {
  for (const d of DIFFS) {
    it(`${d}: n in [min,max], positions non-overlapping, choices contain the answer (200 seeds)`, () => {
      const { min, max } = countSettings(d);
      for (let seed = 1; seed <= 200; seed++) {
        const round = makeCountRound(makeRng(seed), d);
        expect(round.n).toBeGreaterThanOrEqual(min);
        expect(round.n).toBeLessThanOrEqual(max);
        expect(round.positions).toHaveLength(round.n);
        if (round.n >= 2)
          expect(minPairDistance(round.positions)).toBeGreaterThanOrEqual(
            MIN_SEP,
          );
        expect(round.icon).toBeTruthy();
        expect(CURRICULUM.critters).toContain(round.icon);
        expect(round.choices).toHaveLength(3);
        expect(new Set(round.choices).size).toBe(3);
        expect(round.choices).toContain(round.answer);
        expect(round.answer).toBe(round.n);
      }
    });
  }

  it("scales minimum item count by difficulty", () => {
    expect(countSettings("easy").min).toBe(1);
    expect(countSettings("medium").min).toBeGreaterThanOrEqual(4);
    expect(countSettings("hard").min).toBeGreaterThanOrEqual(6);
  });

  it("makeCountChoices never returns duplicates even at the corners", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const [answer, max] of [
        [1, 1],
        [1, 3],
        [5, 5],
        [8, 8],
        [10, 10],
      ] as const) {
        const c = makeCountChoices(
          makeRng(seed * (answer + max + 1)),
          answer,
          max,
        );
        expect(c).toHaveLength(3);
        expect(new Set(c).size).toBe(3);
        expect(c).toContain(answer);
      }
    }
  });

  it("applyTap marks an uncounted item as tapped without mutating original", () => {
    const initial = [0, 0, 0];
    const next = applyTap(initial, 1);
    expect(next).toEqual([0, 1, 0]);
    expect(initial).toEqual([0, 0, 0]);
  });

  it("applyTap assigns sequential ordinal numbers based on tap count", () => {
    const first = applyTap([0, 0, 0], 2);
    expect(first).toEqual([0, 0, 1]);
    const second = applyTap(first, 0);
    expect(second).toEqual([2, 0, 1]);
    const third = applyTap(second, 1);
    expect(third).toEqual([2, 3, 1]);
  });

  it("applyTap returns original array reference when tapping already-tapped or out of bounds", () => {
    const tapped = [1, 0, 2];
    expect(applyTap(tapped, 0)).toBe(tapped);
    expect(applyTap(tapped, 2)).toBe(tapped);
    expect(applyTap(tapped, -1)).toBe(tapped);
    expect(applyTap(tapped, 3)).toBe(tapped);
  });
});

describe("more or less", () => {
  for (const d of DIFFS) {
    const {
      minGap,
      minRatio,
      range: [lo, hi],
      fewerFraction,
    } = compareSettings(d);
    it(`${d}: counts differ by ≥ ${minGap} and ≥ ${minRatio}×, in [${lo},${hi}], correct side flagged (200 seeds)`, () => {
      let fewerCount = 0;
      const seeds = 200;
      for (let seed = 1; seed <= seeds; seed++) {
        const r = makeCompareRound(makeRng(seed), d);
        expect(r.left.count).not.toBe(r.right.count);
        expect(Math.abs(r.left.count - r.right.count)).toBeGreaterThanOrEqual(
          minGap,
        );
        // and far enough apart in PROPORTION: 9 vs 10 is one apart like
        // 3 vs 4, but no four-year-old can see it.
        expect(Math.max(r.left.count, r.right.count)).toBeGreaterThanOrEqual(
          Math.min(r.left.count, r.right.count) * minRatio,
        );
        for (const c of [r.left.count, r.right.count]) {
          expect(c).toBeGreaterThanOrEqual(lo);
          expect(c).toBeLessThanOrEqual(hi);
        }
        // correctSide is consistent with the ask
        const winner =
          r.ask === "more"
            ? r.left.count > r.right.count
              ? "left"
              : "right"
            : r.left.count < r.right.count
              ? "left"
              : "right";
        expect(r.correctSide).toBe(winner);
        if (r.ask === "fewer") fewerCount++;
        // per-side positions non-overlapping
        expect(r.left.positions).toHaveLength(r.left.count);
        expect(r.right.positions).toHaveLength(r.right.count);
        if (r.left.count >= 2)
          expect(minPairDistance(r.left.positions)).toBeGreaterThanOrEqual(
            MIN_SEP,
          );
        if (r.right.count >= 2)
          expect(minPairDistance(r.right.positions)).toBeGreaterThanOrEqual(
            MIN_SEP,
          );
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

describe("more or less: the hard tier stays hard without being unfair", () => {
  it("keeps one-apart pairs at small counts and drops them at big ones", () => {
    const { minGap, minRatio } = compareSettings("hard");
    const seen = new Set<string>();
    for (let seed = 1; seed <= 5000; seed++) {
      const r = makeCompareRound(makeRng(seed), "hard");
      const lo = Math.min(r.left.count, r.right.count);
      const hi = Math.max(r.left.count, r.right.count);
      expect(isFairPair(lo, hi, minGap, minRatio)).toBe(true);
      seen.add(`${lo}v${hi}`);
    }
    // small counts: one apart is still fair game, so the tier keeps its bite
    expect(seen.has("3v4")).toBe(true);
    expect(seen.has("4v5")).toBe(true);
    // big counts: one apart means counting both sides perfectly to win a
    // question the kid already understood
    for (const unfair of ["5v6", "6v7", "7v8", "8v9", "9v10"]) {
      expect(seen.has(unfair), unfair).toBe(false);
    }
    // ...but a wider gap at the top of the range is still offered
    expect(seen.has("8v10")).toBe(true);
  });

  it("easy and medium are untouched — their gaps already clear the ratio", () => {
    for (const d of ["easy", "medium"] as const) {
      const {
        minGap,
        minRatio,
        range: [lo, hi],
      } = compareSettings(d);
      for (let a = lo; a <= hi; a++) {
        for (let b = a + minGap; b <= hi; b++) {
          // every pair the old gap-only rule allowed is still allowed
          expect(isFairPair(a, b, minGap, minRatio), `${d} ${a}v${b}`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe("more or less: plate critter sizing and placement", () => {
  it("plateCritterSize factors vertical row height and never exceeds row height on landscape", () => {
    // Mobile landscape (screen 844x390): plate is 300x126
    const plateW = 300;
    const plateH = 126;
    expect(PLATE_PADDING).toBeGreaterThanOrEqual(10);
    for (let count = 1; count <= 10; count++) {
      const { rows } = gridFor(count);
      const innerRowHeight = (plateH - 2 * PLATE_PADDING) / rows;
      const size = plateCritterSize(count, plateW, plateH);
      expect(size).toBeLessThan(innerRowHeight);
    }

    // On hard mode count=10 (3 rows = 42px row height), old code yielded 50.4px (exceeding row height).
    const hardSize = plateCritterSize(10, plateW, plateH);
    const hardRowHeight = (plateH - 2 * PLATE_PADDING) / 3;
    expect(hardSize).toBeLessThan(hardRowHeight);
    expect(hardSize).toBeGreaterThanOrEqual(25);
  });

  it("plateCritterSize maintains lower bounds per count on mobile portrait", () => {
    // Mobile portrait (screen 390x844): totalW = 358, plateW = 169, plateH = 177.45
    const plateW = (Math.min(390 - 32, 620) - 20) / 2;
    const plateH = Math.min(844 - 84 - 180, plateW * 1.05);

    // Every count maintains the sensible 28px floor, with small counts scaling up
    for (let count = 1; count <= 2; count++) {
      expect(plateCritterSize(count, plateW, plateH)).toBeGreaterThanOrEqual(
        48,
      );
    }
    for (let count = 3; count <= 6; count++) {
      expect(plateCritterSize(count, plateW, plateH)).toBeGreaterThanOrEqual(
        35,
      );
    }
    for (let count = 7; count <= 10; count++) {
      expect(plateCritterSize(count, plateW, plateH)).toBeGreaterThanOrEqual(
        28,
      );
    }
  });

  it("plate critters never overlap on mobile screens (1000 rounds portrait and landscape)", () => {
    const screens = [
      { screenW: 390, screenH: 844 },
      { screenW: 844, screenH: 390 },
    ];

    for (const { screenW, screenH } of screens) {
      const totalW = Math.min(screenW - 32, 620);
      const plateW = (totalW - 20) / 2;
      const plateH = Math.min(screenH - 84 - 180, plateW * 1.05);

      let overlapCount = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const rng = makeRng(seed);
        const round = makeCompareRound(rng, "hard");

        for (const side of [round.left, round.right]) {
          const size = plateCritterSize(side.count, plateW, plateH);
          const boxes = side.positions.map((p) => {
            const { left, top } = plateCritterPos(p, size, plateW, plateH);
            return { left, top, right: left + size, bottom: top + size };
          });

          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const b1 = boxes[i];
              const b2 = boxes[j];
              const interW = Math.max(
                0,
                Math.min(b1.right, b2.right) - Math.max(b1.left, b2.left),
              );
              const interH = Math.max(
                0,
                Math.min(b1.bottom, b2.bottom) - Math.max(b1.top, b2.top),
              );
              if (interW * interH > 0) overlapCount++;
            }
          }
        }
      }
      expect(overlapCount).toBe(0);
    }
  });

  it("plate critters never clip into borders or rounded corners (1000 rounds)", () => {
    const screens = [
      { screenW: 390, screenH: 844 },
      { screenW: 844, screenH: 390 },
    ];
    const border = 4;
    const cornerRadius = 24;
    const innerRadiusSq = (cornerRadius - border) ** 2;

    for (const { screenW, screenH } of screens) {
      const totalW = Math.min(screenW - 32, 620);
      const plateW = (totalW - 20) / 2;
      const plateH = Math.min(screenH - 84 - 180, plateW * 1.05);

      for (let seed = 1; seed <= 1000; seed++) {
        const rng = makeRng(seed);
        const round = makeCompareRound(rng, "hard");

        for (const side of [round.left, round.right]) {
          const size = plateCritterSize(side.count, plateW, plateH);
          for (const pos of side.positions) {
            const { left, top } = plateCritterPos(pos, size, plateW, plateH);
            const right = left + size;
            const bottom = top + size;

            expect(left).toBeGreaterThanOrEqual(border);
            expect(top).toBeGreaterThanOrEqual(border);
            expect(right).toBeLessThanOrEqual(plateW - border);
            expect(bottom).toBeLessThanOrEqual(plateH - border);

            const corners = [
              [left, top],
              [right, top],
              [left, bottom],
              [right, bottom],
            ];
            for (const [cx, cy] of corners) {
              if (cx < cornerRadius && cy < cornerRadius) {
                const distSq =
                  (cx - cornerRadius) ** 2 + (cy - cornerRadius) ** 2;
                expect(distSq).toBeLessThanOrEqual(innerRadiusSq);
              }
              if (cx > plateW - cornerRadius && cy < cornerRadius) {
                const distSq =
                  (cx - (plateW - cornerRadius)) ** 2 +
                  (cy - cornerRadius) ** 2;
                expect(distSq).toBeLessThanOrEqual(innerRadiusSq);
              }
              if (cx < cornerRadius && cy > plateH - cornerRadius) {
                const distSq =
                  (cx - cornerRadius) ** 2 +
                  (cy - (plateH - cornerRadius)) ** 2;
                expect(distSq).toBeLessThanOrEqual(innerRadiusSq);
              }
              if (cx > plateW - cornerRadius && cy > plateH - cornerRadius) {
                const distSq =
                  (cx - (plateW - cornerRadius)) ** 2 +
                  (cy - (plateH - cornerRadius)) ** 2;
                expect(distSq).toBeLessThanOrEqual(innerRadiusSq);
              }
            }
          }
        }
      }
    }
  });

  it("plate critters never overlap revealed count badges positioned outside the plate (1000 rounds)", () => {
    const screens = [
      { screenW: 390, screenH: 844 },
      { screenW: 844, screenH: 390 },
    ];

    for (const { screenW, screenH } of screens) {
      const totalW = Math.min(screenW - 32, 620);
      const plateW = (totalW - 20) / 2;
      const plateH = Math.min(screenH - 84 - 180, plateW * 1.05);

      let overlapCount = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const rng = makeRng(seed);
        const round = makeCompareRound(rng, "hard");

        for (const side of [round.left, round.right]) {
          const size = plateCritterSize(side.count, plateW, plateH);
          for (const pos of side.positions) {
            const { top } = plateCritterPos(pos, size, plateW, plateH);
            const critterBottom = top + size;
            // The badge is positioned in badgeSlot outside the plate area (y >= plateH)
            if (critterBottom > plateH) {
              overlapCount++;
            }
          }
        }
      }
      expect(overlapCount).toBe(0);
    }
  });
});

describe("more or less: comparative feedback", () => {
  it("formats comparisonPhrase across all supported languages for more and fewer", () => {
    // English
    expect(comparisonPhrase("en", "more", 5, 2)).toBe("5 is more than 2");
    expect(comparisonPhrase("en", "fewer", 2, 5)).toBe("2 is fewer than 5");

    // Japanese
    expect(comparisonPhrase("ja", "more", 5, 2)).toBe("5 は 2 より おおい");
    expect(comparisonPhrase("ja", "fewer", 2, 5)).toBe("2 は 5 より すくない");

    // Mandarin
    expect(comparisonPhrase("cmn", "more", 5, 2)).toBe("5比2多");
    expect(comparisonPhrase("cmn", "fewer", 2, 5)).toBe("2比5少");

    // Cantonese
    expect(comparisonPhrase("yue", "more", 5, 2)).toBe("5多過2");
    expect(comparisonPhrase("yue", "fewer", 2, 5)).toBe("2少過5");
  });

  it("roundComparisonPhrase returns correct relation for both winning sides and ask conditions", () => {
    const roundMoreLeft = {
      left: { icon: "dog", count: 5, positions: [] },
      right: { icon: "cat", count: 2, positions: [] },
      ask: "more" as const,
      correctSide: "left" as const,
    };
    expect(roundComparisonPhrase("en", roundMoreLeft)).toBe("5 is more than 2");

    const roundMoreRight = {
      left: { icon: "dog", count: 2, positions: [] },
      right: { icon: "cat", count: 5, positions: [] },
      ask: "more" as const,
      correctSide: "right" as const,
    };
    expect(roundComparisonPhrase("en", roundMoreRight)).toBe(
      "5 is more than 2",
    );

    const roundFewerLeft = {
      left: { icon: "dog", count: 3, positions: [] },
      right: { icon: "cat", count: 7, positions: [] },
      ask: "fewer" as const,
      correctSide: "left" as const,
    };
    expect(roundComparisonPhrase("en", roundFewerLeft)).toBe(
      "3 is fewer than 7",
    );

    const roundFewerRight = {
      left: { icon: "dog", count: 7, positions: [] },
      right: { icon: "cat", count: 3, positions: [] },
      ask: "fewer" as const,
      correctSide: "right" as const,
    };
    expect(roundComparisonPhrase("en", roundFewerRight)).toBe(
      "3 is fewer than 7",
    );
  });

  it("every line roundComparisonPhrase can emit across all difficulties and langs is contained in speechLines()", () => {
    const lines = new Set(compareSpeechLines());
    for (const d of ["easy", "medium", "hard"] as const) {
      for (let seed = 1; seed <= 500; seed++) {
        const round = makeCompareRound(makeRng(seed), d);
        for (const lang of ["en", "ja", "cmn", "yue"] as const) {
          const spoken = roundComparisonPhrase(lang, round);
          expect(lines.has(spoken)).toBe(true);
        }
      }
    }
  });

  describe("plateAccessibilityLabel", () => {
    it("formats localized count and critter name for all languages", () => {
      expect(plateAccessibilityLabel(5, "dog", "en")).toBe("5 dog");
      expect(plateAccessibilityLabel(5, "dog", "ja")).toBe("5 いぬ");
      expect(plateAccessibilityLabel(5, "dog", "cmn")).toBe("5 狗");
      expect(plateAccessibilityLabel(5, "dog", "yue")).toBe("5 狗");
      expect(plateAccessibilityLabel(7, "butterfly", "en")).toBe("7 butterfly");
      expect(plateAccessibilityLabel(7, "butterfly", "ja")).toBe(
        "7 ちょうちょ",
      );
      expect(plateAccessibilityLabel(7, "butterfly", "cmn")).toBe("7 蝴蝶");
      expect(plateAccessibilityLabel(7, "butterfly", "yue")).toBe("7 蝴蝶");
    });

    it("resolves all CURRICULUM.critters across all 4 supported languages", () => {
      for (const icon of CURRICULUM.critters) {
        for (const lang of ["en", "ja", "cmn", "yue"] as const) {
          const label = plateAccessibilityLabel(3, icon, lang);
          expect(label).toMatch(/^3 \S+/);
        }
      }
    });

    it("throws loudly on unknown icon", () => {
      expect(() => plateAccessibilityLabel(1, "unicorn_pegasus", "en")).toThrow(
        /Unknown compare icon: unicorn_pegasus/,
      );
    });
  });
});

describe("little sums", () => {
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
        if (all.length >= 2)
          expect(minPairDistance(all)).toBeGreaterThanOrEqual(MIN_SEP);
        expect(r.choices).toHaveLength(3);
        expect(new Set(r.choices).size).toBe(3);
        expect(r.choices).toContain(r.sum);
        for (const choice of r.choices) {
          expect(choice).toBeGreaterThanOrEqual(2);
          expect(choice).toBeLessThanOrEqual(maxSum);
        }
        expect(CURRICULUM.critters).toContain(r.icon);
        expect(CURRICULUM.critters).toContain(r.bIcon);
        expect(r.bIcon).not.toBe(r.icon);
        const maxAx = Math.max(...r.aPositions.map((p) => p.x));
        const minBx = Math.min(...r.bPositions.map((p) => p.x));
        expect(maxAx).toBeLessThanOrEqual(minBx);
      }
    });
  }

  it("makeSumChoices holds up at extremes", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const [answer, cap] of [
        [2, 5],
        [5, 5],
        [7, 7],
        [10, 10],
      ] as const) {
        const c = makeSumChoices(
          makeRng(seed * (answer + cap + 1)),
          answer,
          cap,
        );
        expect(c).toHaveLength(3);
        expect(new Set(c).size).toBe(3);
        expect(c).toContain(answer);
        for (const choice of c) {
          expect(choice).toBeGreaterThanOrEqual(2);
          expect(choice).toBeLessThanOrEqual(cap);
        }
      }
    }
  });
});

describe("speechLines()", () => {
  it("count: non-empty and unique", () => {
    const l = countSpeechLines();
    expect(l.length).toBeGreaterThan(0);
    expect(new Set(l).size).toBe(l.length);
    for (const s of l) expect(s.trim()).not.toBe("");
    // instruction + prompt + praise × 4 langs = 12 distinct lines
    expect(l.length).toBe(12);
  });
  it("compare: non-empty and unique", () => {
    const l = compareSpeechLines();
    expect(l.length).toBeGreaterThan(0);
    expect(new Set(l).size).toBe(l.length);
    // (more + fewer + praise + 45 more-phrases + 45 fewer-phrases) × 4 langs = 372
    expect(l.length).toBe(372);
  });
  it("sums: non-empty and unique", () => {
    const l = sumsSpeechLines();
    expect(l.length).toBeGreaterThan(0);
    expect(new Set(l).size).toBe(l.length);
    // plus + question + praise × 4 langs = 12, but 'plus' collides between cmn and yue ('加') → 11
    expect(l.length).toBeGreaterThanOrEqual(10);
  });
});
