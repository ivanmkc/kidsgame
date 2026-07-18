import { describe, it, expect } from 'vitest';
import {
  startState,
  advance,
  noteForTap,
  beatsForTap,
  octaveOffset,
  harmonyOffsets,
  spawnZone,
  pickSpawnSprite,
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

  it('pickSpawnSprite skips unique sprites already on screen', () => {
    const pool = ['obj_sky_sun_rays', 'obj_sky_seagull', 'obj_sky_cloud_fluffy', 'obj_sky_pelican'];

    // With no actives, sun spawns normally at tapIndex 0
    expect(pickSpawnSprite(pool, 0, [])).toBe('obj_sky_sun_rays');

    // With sun already active, it skips to seagull
    expect(pickSpawnSprite(pool, 0, ['obj_sky_sun_rays'])).toBe('obj_sky_seagull');

    // Non-unique sprites can duplicate freely
    expect(pickSpawnSprite(pool, 1, ['obj_sky_seagull'])).toBe('obj_sky_seagull');
  });

  it('pickSpawnSprite dedup covers moon and rocket across scenes', () => {
    const twinkleSky = ['obj_sky_star', 'obj_sky_comet', 'obj_sky_moon_crescent', 'obj_sky_cloud_wispy', 'obj_sky_rocket', 'obj_sky_sparkle'];

    // Moon at index 2 is unique; if already active, picks next non-unique
    expect(pickSpawnSprite(twinkleSky, 2, ['obj_sky_moon_crescent'])).toBe('obj_sky_cloud_wispy');

    // Rocket at index 4 is unique; if already active, picks next non-unique
    expect(pickSpawnSprite(twinkleSky, 4, ['obj_sky_rocket'])).toBe('obj_sky_sparkle');
  });

  it('speechLines covers at least 4 langs, no duplicates', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(new Set(lines).size).toBe(lines.length);
  });
});
