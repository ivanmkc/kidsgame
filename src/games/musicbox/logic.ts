// Pure music-box logic: which note a tap plays and how far the song has
// come. Kept UI-free so vitest covers the note walk and the free-play
// pentatonic picker without a DOM.
import { LANGS } from '../../lang';
import { t } from '../../i18n';
import { PENTATONIC, SONGS, Song } from './songs';

export interface BoxState {
  song: Song | null; // null = free play
  idx: number;       // next note to play (0-based)
}

export function startState(song: Song | null): BoxState {
  return { song, idx: 0 };
}

/** The midi note this tap should play. Free play walks a gentle random
 *  pentatonic ramble (seeded by idx so tests are deterministic). */
export function noteForTap(s: BoxState): number {
  if (!s.song) {
    // Deterministic "random": a fixed stride through the pentatonic pool
    // gives musical-feeling motion without a real RNG dependency.
    return PENTATONIC[(s.idx * 3 + (s.idx % 2 ? 1 : 0)) % PENTATONIC.length];
  }
  return s.song.notes[s.idx % s.song.notes.length].m;
}

/** Beats of the note this tap plays (drives glyph size only). */
export function beatsForTap(s: BoxState): number {
  if (!s.song) return 1;
  return s.song.notes[s.idx % s.song.notes.length].b;
}

export function advance(s: BoxState): BoxState {
  return { ...s, idx: s.idx + 1 };
}

/** 0..1 song progress; free play never completes. */
export function progress(s: BoxState): number {
  if (!s.song) return 0;
  return Math.min(1, s.idx / s.song.notes.length);
}

export function isComplete(s: BoxState): boolean {
  return !!s.song && s.idx >= s.song.notes.length;
}

export function songById(id: string | undefined): Song | null {
  return SONGS.find((x) => x.id === id) ?? null;
}

/** Voice-clip contract: every spoken line, all langs (win line rides the
 *  shared winlines list via the 'win.musicbox' key added there). */
export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, 'musicbox.intro'));
    out.push(t(l.id, 'musicbox.introFree'));
  }
  return [...new Set(out)];
}
