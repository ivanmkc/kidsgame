import { describe, it, expect } from 'vitest';
import {
  startState,
  advance,
  noteForTap,
  beatsForTap,
  octaveOffset,
  harmonyOffsets,
  spawnZone,
  songById,
  speechLines,
} from '../musicbox/logic';
import { SONGS, PENTATONIC } from '../musicbox/songs';
import { SCENES, sceneById } from '../musicbox/scenes';

describe('musicbox v2 logic', () => {
  it('walks a song note-by-note and wraps around (no completion)', () => {
    const song = SONGS.find((s) => s.id === 'twinkle')!;
    let s = startState(song);
    const firstPass: number[] = [];
    for (let i = 0; i < song.notes.length; i++) {
      firstPass.push(noteForTap(s));
      s = advance(s);
    }
    expect(firstPass).toEqual(song.notes.map((n) => n.m));

    // Second pass should repeat identically (seamless loop)
    const secondPass: number[] = [];
    for (let i = 0; i < song.notes.length; i++) {
      secondPass.push(noteForTap(s));
      s = advance(s);
    }
    expect(secondPass).toEqual(firstPass);
  });

  it('beatsForTap matches song note durations', () => {
    const song = SONGS[0];
    let s = startState(song);
    for (let i = 0; i < song.notes.length; i++) {
      expect(beatsForTap(s)).toBe(song.notes[i].b);
      s = advance(s);
    }
  });

  it('free play never ends, stays in PENTATONIC pool', () => {
    let s = startState(null);
    for (let i = 0; i < 200; i++) {
      expect(PENTATONIC).toContain(noteForTap(s));
      s = advance(s);
    }
  });

  it('octaveOffset returns correct offsets by vertical zone', () => {
    expect(octaveOffset(0.1)).toBe(12);   // top third
    expect(octaveOffset(0.5)).toBe(0);    // middle
    expect(octaveOffset(0.8)).toBe(-12);  // bottom third
    expect(octaveOffset(0.33)).toBe(0);   // boundary -> middle
    expect(octaveOffset(0.66)).toBe(0);   // boundary -> middle
  });

  it('harmonyOffsets layers notes for multi-finger taps', () => {
    expect(harmonyOffsets(1)).toEqual([0]);
    expect(harmonyOffsets(2)).toEqual([0, 4]);
    expect(harmonyOffsets(3)).toEqual([0, 4, 7]);
    expect(harmonyOffsets(5)).toEqual([0, 4, 7]); // capped at triad
  });

  it('spawnZone maps vertical position to object pool', () => {
    expect(spawnZone(0.1)).toBe('sky');
    expect(spawnZone(0.5)).toBe('mid');
    expect(spawnZone(0.9)).toBe('ground');
  });

  it('all songs have >= 20 notes, all midi in [55, 84]', () => {
    for (const s of SONGS) {
      expect(s.notes.length).toBeGreaterThanOrEqual(20);
      for (const n of s.notes) {
        expect(n.m).toBeGreaterThanOrEqual(55);
        expect(n.m).toBeLessThanOrEqual(84);
      }
    }
  });

  it('songById resolves known, returns null for unknown', () => {
    expect(songById('twinkle')?.id).toBe('twinkle');
    expect(songById('nope')).toBeNull();
    expect(songById(undefined)).toBeNull();
  });

  it('sceneById resolves known, returns undefined for unknown', () => {
    expect(sceneById('twinkle')?.id).toBe('twinkle');
    expect(sceneById('nope')).toBeUndefined();
  });

  it('every scene references a valid song', () => {
    for (const sc of SCENES) {
      const song = SONGS.find((s) => s.id === sc.songId);
      expect(song, `scene ${sc.id} references missing song ${sc.songId}`).toBeDefined();
    }
  });

  it('every scene has non-empty object pools for all zones', () => {
    for (const sc of SCENES) {
      expect(sc.objects.sky.length).toBeGreaterThan(0);
      expect(sc.objects.mid.length).toBeGreaterThan(0);
      expect(sc.objects.ground.length).toBeGreaterThan(0);
    }
  });

  it('speechLines covers at least 4 langs, no duplicates', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(new Set(lines).size).toBe(lines.length);
  });
});
