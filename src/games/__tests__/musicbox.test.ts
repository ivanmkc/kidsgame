import { describe, expect, it } from 'vitest';
import { advance, beatsForTap, isComplete, noteForTap, progress, songById, speechLines, startState } from '../musicbox/logic';
import { PENTATONIC, SONGS } from '../musicbox/songs';

describe('musicbox logic', () => {
  it('walks a song note by note and completes at the end', () => {
    const song = SONGS[0];
    let s = startState(song);
    const played: number[] = [];
    for (let i = 0; i < song.notes.length; i++) {
      expect(isComplete(s)).toBe(false);
      played.push(noteForTap(s));
      s = advance(s);
    }
    expect(played).toEqual(song.notes.map((n) => n.m));
    expect(isComplete(s)).toBe(true);
    expect(progress(s)).toBe(1);
  });

  it('reports beats for glyph sizing', () => {
    const song = SONGS[0];
    let s = startState(song);
    const beats = song.notes.map(() => {
      const b = beatsForTap(s);
      s = advance(s);
      return b;
    });
    expect(beats).toEqual(song.notes.map((n) => n.b));
  });

  it('free play never completes and stays inside the pentatonic pool', () => {
    let s = startState(null);
    for (let i = 0; i < 200; i++) {
      expect(PENTATONIC).toContain(noteForTap(s));
      s = advance(s);
    }
    expect(isComplete(s)).toBe(false);
    expect(progress(s)).toBe(0);
  });

  it('every song is non-trivial and in a singable range', () => {
    for (const song of SONGS) {
      expect(song.notes.length).toBeGreaterThanOrEqual(20);
      for (const n of song.notes) {
        expect(n.m).toBeGreaterThanOrEqual(55);
        expect(n.m).toBeLessThanOrEqual(84);
      }
    }
  });

  it('songById resolves ids and rejects unknowns', () => {
    expect(songById('twinkle')?.id).toBe('twinkle');
    expect(songById('nope')).toBeNull();
    expect(songById(undefined)).toBeNull();
  });

  it('speechLines covers every lang without duplicates', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThanOrEqual(8); // 2 lines x 4 langs
    expect(new Set(lines).size).toBe(lines.length);
  });
});
