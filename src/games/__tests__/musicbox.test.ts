import { describe, it, expect } from "vitest";
import {
  startState,
  advance,
  isSongLoopComplete,
  noteForTap,
  beatsForTap,
  octaveOffset,
  harmonyOffsets,
  spawnZone,
  pickSpawnSprite,
  songById,
  speechLines,
  ZONE_PARALLAX_SPEEDS,
} from "../musicbox/logic";
import { SONGS, PENTATONIC } from "../musicbox/songs";
import { SCENES, sceneById } from "../musicbox/scenes";

describe("musicbox v2 logic", () => {
  it("walks a song note-by-note and wraps around (no completion)", () => {
    const song = SONGS.find((s) => s.id === "twinkle")!;
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

  it("detects song loop completion at note multiples and rejects intermediate taps or free play", () => {
    const twinkle = SONGS.find((s) => s.id === "twinkle")!;
    expect(twinkle.notes.length).toBe(42);

    let s = startState(twinkle);
    expect(isSongLoopComplete(s)).toBe(false);

    // Taps 1 through 41 are intermediate notes
    for (let tap = 1; tap < 42; tap++) {
      s = advance(s);
      expect(isSongLoopComplete(s)).toBe(false);
    }

    // Tap 42 finishes the 42-note song loop
    s = advance(s);
    expect(s.idx).toBe(42);
    expect(isSongLoopComplete(s)).toBe(true);

    // Tap 43 begins loop 2, not a completion
    s = advance(s);
    expect(s.idx).toBe(43);
    expect(isSongLoopComplete(s)).toBe(false);

    // Advance to tap 84 (loop 2 completion)
    for (let tap = 44; tap <= 84; tap++) {
      s = advance(s);
      if (tap === 84) {
        expect(isSongLoopComplete(s)).toBe(true);
      } else {
        expect(isSongLoopComplete(s)).toBe(false);
      }
    }

    // Free play never completes a loop
    let free = startState(null);
    expect(isSongLoopComplete(free)).toBe(false);
    for (let tap = 1; tap <= 100; tap++) {
      free = advance(free);
      expect(isSongLoopComplete(free)).toBe(false);
    }
  });

  it("beatsForTap matches song note durations", () => {
    const song = SONGS[0];
    let s = startState(song);
    for (let i = 0; i < song.notes.length; i++) {
      expect(beatsForTap(s)).toBe(song.notes[i].b);
      s = advance(s);
    }
  });

  it("free play never ends, stays in PENTATONIC pool", () => {
    let s = startState(null);
    for (let i = 0; i < 200; i++) {
      expect(PENTATONIC).toContain(noteForTap(s));
      s = advance(s);
    }
  });

  it("free play visits every note in the pentatonic scale", () => {
    let s = startState(null);
    const seen = new Set<number>();
    for (let i = 0; i < PENTATONIC.length; i++) {
      seen.add(noteForTap(s));
      s = advance(s);
    }
    expect(seen.size).toBe(PENTATONIC.length);
    for (const note of PENTATONIC) {
      expect(seen.has(note)).toBe(true);
    }
  });

  it("octaveOffset returns correct offsets by vertical zone", () => {
    expect(octaveOffset(0.1)).toBe(12); // top third
    expect(octaveOffset(0.5)).toBe(0); // middle
    expect(octaveOffset(0.8)).toBe(-12); // bottom third
    expect(octaveOffset(0.33)).toBe(0); // boundary -> middle
    expect(octaveOffset(0.66)).toBe(0); // boundary -> middle
  });

  it("harmonyOffsets diatonically harmonizes C Major scale degrees", () => {
    // 1 finger is melody only across all degrees
    expect(harmonyOffsets(1, 60)).toEqual([0]);
    expect(harmonyOffsets(1, 62)).toEqual([0]);

    // 2 fingers: major thirds (+4) on C, F, G; minor thirds (+3) on D, E, A, B
    expect(harmonyOffsets(2, 60)).toEqual([0, 4]); // C + E
    expect(harmonyOffsets(2, 62)).toEqual([0, 3]); // D + F
    expect(harmonyOffsets(2, 64)).toEqual([0, 3]); // E + G
    expect(harmonyOffsets(2, 65)).toEqual([0, 4]); // F + A
    expect(harmonyOffsets(2, 67)).toEqual([0, 4]); // G + B
    expect(harmonyOffsets(2, 69)).toEqual([0, 3]); // A + C
    expect(harmonyOffsets(2, 71)).toEqual([0, 3]); // B + D

    // 3+ fingers: diatonic triads (diminished fifth +6 on B; perfect fifth +7 elsewhere)
    expect(harmonyOffsets(3, 60)).toEqual([0, 4, 7]); // C major: C, E, G
    expect(harmonyOffsets(3, 62)).toEqual([0, 3, 7]); // D minor: D, F, A
    expect(harmonyOffsets(3, 64)).toEqual([0, 3, 7]); // E minor: E, G, B
    expect(harmonyOffsets(3, 65)).toEqual([0, 4, 7]); // F major: F, A, C
    expect(harmonyOffsets(3, 67)).toEqual([0, 4, 7]); // G major: G, B, D
    expect(harmonyOffsets(3, 69)).toEqual([0, 3, 7]); // A minor: A, C, E
    expect(harmonyOffsets(3, 71)).toEqual([0, 3, 6]); // B diminished: B, D, F
    expect(harmonyOffsets(5, 60)).toEqual([0, 4, 7]); // capped at triad
  });

  it("harmonyOffsets diatonically harmonizes single-finger taps when richChords is enabled", () => {
    // 1 finger with richChords plays diatonic thirds [0, third]
    expect(harmonyOffsets(1, 60, true)).toEqual([0, 4]); // C + E
    expect(harmonyOffsets(1, 62, true)).toEqual([0, 3]); // D + F (minor third)
    expect(harmonyOffsets(1, 64, true)).toEqual([0, 3]); // E + G (minor third)
    expect(harmonyOffsets(1, 65, true)).toEqual([0, 4]); // F + A
    expect(harmonyOffsets(1, 67, true)).toEqual([0, 4]); // G + B
    expect(harmonyOffsets(1, 69, true)).toEqual([0, 3]); // A + C (minor third)
    expect(harmonyOffsets(1, 71, true)).toEqual([0, 3]); // B + D (minor third)

    // multi-finger with richChords plays diatonic triad [0, third, fifth]
    expect(harmonyOffsets(2, 60, true)).toEqual([0, 4, 7]);
    expect(harmonyOffsets(2, 71, true)).toEqual([0, 3, 6]);
  });

  it("produces zero non-diatonic notes across all songs for multi-finger taps and richChords", () => {
    const C_MAJOR_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const song of SONGS) {
      for (const note of song.notes) {
        for (const fingerCount of [1, 2, 3, 4]) {
          for (const richChords of [false, true]) {
            const offsets = harmonyOffsets(fingerCount, note.m, richChords);
            for (const offset of offsets) {
              const playedMidi = note.m + offset;
              const pitchClass = ((playedMidi % 12) + 12) % 12;
              expect(
                C_MAJOR_PITCH_CLASSES.has(pitchClass),
                `Song ${song.id} note ${note.m} with ${fingerCount} fingers (richChords=${richChords}) produced non-diatonic pitch class ${pitchClass}`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it("avoids previously dissonant intervals on nursery song notes", () => {
    // Twinkle 'lit-tle' (midi 69, A): 2-finger harmony plays A (69) + C (72), not C# (73)
    expect(harmonyOffsets(2, 69)).toEqual([0, 3]);
    // Twinkle 'won-der' / Jingle opening (midi 64, E): 2-finger plays E (64) + G (67), not G# (68)
    expect(harmonyOffsets(2, 64)).toEqual([0, 3]);
    // Row 'merrily' (midi 62, D): 2-finger plays D (62) + F (65), not F# (66)
    expect(harmonyOffsets(2, 62)).toEqual([0, 3]);
    // MacDonald (midi 71, B): 3-finger plays B (71) + D (74) + F (77), not D# (75) or F# (78)
    expect(harmonyOffsets(3, 71)).toEqual([0, 3, 6]);
  });

  it("spawnZone maps vertical position to object pool", () => {
    expect(spawnZone(0.1)).toBe("sky");
    expect(spawnZone(0.5)).toBe("mid");
    expect(spawnZone(0.9)).toBe("ground");
  });

  it("all songs have >= 20 notes, all midi in [55, 84]", () => {
    for (const s of SONGS) {
      expect(s.notes.length).toBeGreaterThanOrEqual(20);
      for (const n of s.notes) {
        expect(n.m).toBeGreaterThanOrEqual(55);
        expect(n.m).toBeLessThanOrEqual(84);
      }
    }
  });

  it("songById resolves known, returns null for unknown", () => {
    expect(songById("twinkle")?.id).toBe("twinkle");
    expect(songById("nope")).toBeNull();
    expect(songById(undefined)).toBeNull();
  });

  it("sceneById resolves known, returns undefined for unknown", () => {
    expect(sceneById("twinkle")?.id).toBe("twinkle");
    expect(sceneById("nope")).toBeUndefined();
  });

  it("every scene references a valid song", () => {
    for (const sc of SCENES) {
      const song = SONGS.find((s) => s.id === sc.songId);
      expect(
        song,
        `scene ${sc.id} references missing song ${sc.songId}`,
      ).toBeDefined();
    }
  });

  it("every scene has non-empty object pools for all zones", () => {
    for (const sc of SCENES) {
      expect(sc.objects.sky.length).toBeGreaterThan(0);
      expect(sc.objects.mid.length).toBeGreaterThan(0);
      expect(sc.objects.ground.length).toBeGreaterThan(0);
    }
  });

  it("pickSpawnSprite skips unique sprites already on screen", () => {
    const pool = [
      "obj_sky_sun_rays",
      "obj_sky_seagull",
      "obj_sky_cloud_fluffy",
      "obj_sky_pelican",
    ];

    // With no actives, sun spawns normally at tapIndex 0
    expect(pickSpawnSprite(pool, 0, [])).toBe("obj_sky_sun_rays");

    // With sun already active, it skips to seagull
    expect(pickSpawnSprite(pool, 0, ["obj_sky_sun_rays"])).toBe(
      "obj_sky_seagull",
    );

    // Non-unique sprites can duplicate freely
    expect(pickSpawnSprite(pool, 1, ["obj_sky_seagull"])).toBe(
      "obj_sky_seagull",
    );
  });

  it("pickSpawnSprite dedup covers moon and rocket across scenes", () => {
    const twinkleSky = [
      "obj_sky_star",
      "obj_sky_comet",
      "obj_sky_moon_crescent",
      "obj_sky_cloud_wispy",
      "obj_sky_rocket",
      "obj_sky_sparkle",
    ];

    // Moon at index 2 is unique; if already active, picks next non-unique
    expect(pickSpawnSprite(twinkleSky, 2, ["obj_sky_moon_crescent"])).toBe(
      "obj_sky_cloud_wispy",
    );

    // Rocket at index 4 is unique; if already active, picks next non-unique
    expect(pickSpawnSprite(twinkleSky, 4, ["obj_sky_rocket"])).toBe(
      "obj_sky_sparkle",
    );
  });

  it("speechLines covers intro, free-play intro, and picker prompts across all languages, no duplicates", () => {
    const lines = speechLines();
    expect(lines.length).toBe(42);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines).toContain("Pick a song to play!");
    expect(lines).toContain("うたを えらんでね！");
    expect(lines).toContain("选一首歌吧！");
    expect(lines).toContain("揀一首歌啦！");
    expect(lines).toContain("Tap, tap, tap anywhere to play the song!");
    expect(lines).toContain("Magic keys! Every tap makes a pretty note!");
    expect(lines).toContain(
      "まほうの けんばん！ タップすると きれいなおとが なるよ！",
    );
    expect(lines).toContain("Tap anywhere to play the next note!");
    expect(lines).toContain("Twinkle Twinkle Little Star");
    expect(lines).toContain("Jingle Bells");
  });

  it("defines parallax speeds for all spawn zones", () => {
    expect(ZONE_PARALLAX_SPEEDS.sky).toBe(0.2);
    expect(ZONE_PARALLAX_SPEEDS.mid).toBe(0.5);
    expect(ZONE_PARALLAX_SPEEDS.ground).toBe(1);
  });
});
