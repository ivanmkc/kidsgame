// Pure music-box logic: which note a tap plays, octave offset from vertical
// position, and multi-finger harmony. Kept UI-free so vitest covers the note
// walk without a DOM. v2: no win state — melody loops seamlessly.
import { LANGS } from "../../lang";
import { t } from "../../i18n";
import { PENTATONIC, SONGS, Song } from "./songs";

export interface BoxState {
  song: Song | null; // null = free play
  idx: number; // cumulative tap count (wraps via modulo)
}

export function startState(song: Song | null): BoxState {
  return { song, idx: 0 };
}

/** The midi note this tap should play (before octave offset).
 *  Always wraps — the melody loops forever. */
export function noteForTap(s: BoxState): number {
  if (!s.song) {
    return PENTATONIC[(s.idx * 3) % PENTATONIC.length];
  }
  return s.song.notes[s.idx % s.song.notes.length].m;
}

/** Beats of the note this tap plays (drives spawned-object size). */
export function beatsForTap(s: BoxState): number {
  if (!s.song) return 1;
  return s.song.notes[s.idx % s.song.notes.length].b;
}

export function advance(s: BoxState): BoxState {
  return { ...s, idx: s.idx + 1 };
}

/** Whether the current tap count completes a full loop of the song melody. */
export function isSongLoopComplete(s: BoxState): boolean {
  if (!s.song || s.song.notes.length === 0) return false;
  return s.idx > 0 && s.idx % s.song.notes.length === 0;
}

/** Octave offset from vertical tap position.
 *  yFrac 0 = top of screen, 1 = bottom.
 *  Top third: +12 (one octave up). Middle third: 0. Bottom third: -12. */
export function octaveOffset(yFrac: number): number {
  if (yFrac < 0.33) return 12;
  if (yFrac > 0.66) return -12;
  return 0;
}

/** Diatonic intervals (third and fifth semitone offsets) above each pitch class in C Major.
 *  Scale degrees D (2), E (4), A (9), and B (11) use minor thirds (+3);
 *  C (0), F (5), and G (7) use major thirds (+4).
 *  B (11) uses a diminished fifth (+6); other degrees use a perfect fifth (+7). */
const DIATONIC_CHORD_OFFSETS: readonly [number, number][] = [
  /* 0: C */ [4, 7],
  /* 1: C# */ [4, 7],
  /* 2: D */ [3, 7],
  /* 3: D# */ [3, 7],
  /* 4: E */ [3, 7],
  /* 5: F */ [4, 7],
  /* 6: F# */ [4, 7],
  /* 7: G */ [4, 7],
  /* 8: G# */ [4, 7],
  /* 9: A */ [3, 7],
  /* 10: A# */ [3, 7],
  /* 11: B */ [3, 6],
];

/** Multi-finger harmony: diatonic semitone offsets in C Major for simultaneous taps.
 *  1 finger = [0] (melody only). 2 = diatonic third. 3+ = diatonic triad.
 *  When richChords is enabled (hard difficulty), single taps play a diatonic third
 *  dyad [0, third] and multi-finger taps play a full diatonic triad [0, third, fifth]. */
export function harmonyOffsets(
  fingerCount: number,
  midi: number,
  richChords: boolean = false,
): number[] {
  const pc = ((midi % 12) + 12) % 12;
  const [third, fifth] = DIATONIC_CHORD_OFFSETS[pc];
  if (richChords) {
    return fingerCount <= 1 ? [0, third] : [0, third, fifth];
  }
  if (fingerCount <= 1) return [0];
  if (fingerCount === 2) return [0, third];
  return [0, third, fifth];
}

/** Vertical zone determines which object pool to draw from.
 *  yFrac 0 = top, 1 = bottom. */
export type SpawnZone = "sky" | "mid" | "ground";
export const ZONE_PARALLAX_SPEEDS: Record<SpawnZone, number> = {
  sky: 0.2,
  mid: 0.5,
  ground: 1,
};
export function spawnZone(yFrac: number): SpawnZone {
  if (yFrac < 0.35) return "sky";
  if (yFrac > 0.65) return "ground";
  return "mid";
}

const UNIQUE_SPRITES = new Set([
  "obj_sky_sun_rays",
  "obj_sky_moon_crescent",
  "obj_sky_rocket",
  "obj_mid_rainbow",
]);

/** Pick a spawn sprite, skipping unique sprites already on screen. */
export function pickSpawnSprite(
  pool: string[],
  tapIndex: number,
  activeKeys: string[],
): string {
  const active = new Set(activeKeys);
  const first = pool[tapIndex % pool.length];
  if (!UNIQUE_SPRITES.has(first) || !active.has(first)) return first;
  for (let i = 1; i < pool.length; i++) {
    const candidate = pool[(tapIndex + i) % pool.length];
    if (!UNIQUE_SPRITES.has(candidate) || !active.has(candidate))
      return candidate;
  }
  return first;
}

export function songById(id: string | undefined): Song | null {
  return SONGS.find((x) => x.id === id) ?? null;
}

/** Voice-clip contract: every spoken line, all langs. */
export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, "musicbox.intro"));
    out.push(t(l.id, "musicbox.introFree"));
    out.push(t(l.id, "shell.musicbox.subPicker"));
    out.push(t(l.id, "shell.musicbox.subPlay"));
    for (const s of SONGS) {
      out.push(t(l.id, `song.${s.id}` as Parameters<typeof t>[1]));
    }
  }
  return [...new Set(out)];
}
