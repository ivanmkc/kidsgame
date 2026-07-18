// Pure music-box logic: which note a tap plays, octave offset from vertical
// position, and multi-finger harmony. Kept UI-free so vitest covers the note
// walk without a DOM. v2: no win state — melody loops seamlessly.
import { LANGS } from '../../lang';
import { t } from '../../i18n';
import { PENTATONIC, SONGS, Song } from './songs';

export interface BoxState {
  song: Song | null; // null = free play
  idx: number;       // cumulative tap count (wraps via modulo)
}

export function startState(song: Song | null): BoxState {
  return { song, idx: 0 };
}

/** The midi note this tap should play (before octave offset).
 *  Always wraps — the melody loops forever. */
export function noteForTap(s: BoxState): number {
  if (!s.song) {
    return PENTATONIC[(s.idx * 3 + (s.idx % 2 ? 1 : 0)) % PENTATONIC.length];
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

/** Octave offset from vertical tap position.
 *  yFrac 0 = top of screen, 1 = bottom.
 *  Top third: +12 (one octave up). Middle third: 0. Bottom third: -12. */
export function octaveOffset(yFrac: number): number {
  if (yFrac < 0.33) return 12;
  if (yFrac > 0.66) return -12;
  return 0;
}

/** Multi-finger harmony: additional semitone offsets for simultaneous taps.
 *  1 finger = [0] (melody only). 2 = major third. 3+ = triad. */
export function harmonyOffsets(fingerCount: number): number[] {
  if (fingerCount <= 1) return [0];
  if (fingerCount === 2) return [0, 4];
  return [0, 4, 7];
}

/** Vertical zone determines which object pool to draw from.
 *  yFrac 0 = top, 1 = bottom. */
export type SpawnZone = 'sky' | 'mid' | 'ground';
export function spawnZone(yFrac: number): SpawnZone {
  if (yFrac < 0.35) return 'sky';
  if (yFrac > 0.65) return 'ground';
  return 'mid';
}

export function songById(id: string | undefined): Song | null {
  return SONGS.find((x) => x.id === id) ?? null;
}

/** Voice-clip contract: every spoken line, all langs. */
export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, 'musicbox.intro'));
  }
  return [...new Set(out)];
}
