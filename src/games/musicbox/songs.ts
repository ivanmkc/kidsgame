// Public-domain nursery melodies as MIDI note runs. Every tap plays the
// NEXT note, so rhythm belongs to the kid — `b` (beats) only scales the
// floating note glyph so long notes look bigger. All traditional tunes,
// long out of copyright.

export interface SongNote { m: number; b: number }
export interface Song {
  id: string;
  emoji: string;
  /** i18n key suffix — titles live in i18n.ts as `song.<id>.title` */
  notes: SongNote[];
}

const q = (m: number): SongNote => ({ m, b: 1 });
const h = (m: number): SongNote => ({ m, b: 2 });

// C major throughout; middle C = 60.
export const SONGS: Song[] = [
  {
    id: 'twinkle', emoji: '⭐',
    notes: [
      q(60), q(60), q(67), q(67), q(69), q(69), h(67),
      q(65), q(65), q(64), q(64), q(62), q(62), h(60),
      q(67), q(67), q(65), q(65), q(64), q(64), h(62),
      q(67), q(67), q(65), q(65), q(64), q(64), h(62),
      q(60), q(60), q(67), q(67), q(69), q(69), h(67),
      q(65), q(65), q(64), q(64), q(62), q(62), h(60),
    ],
  },
  {
    id: 'mary', emoji: '🐑',
    notes: [
      q(64), q(62), q(60), q(62), q(64), q(64), h(64),
      q(62), q(62), h(62), q(64), q(67), h(67),
      q(64), q(62), q(60), q(62), q(64), q(64), q(64), q(64),
      q(62), q(62), q(64), q(62), h(60),
    ],
  },
  {
    id: 'row', emoji: '🚣',
    notes: [
      q(60), q(60), q(60), q(62), h(64),
      q(64), q(62), q(64), q(65), h(67),
      q(72), q(72), q(72), q(67), q(67), q(67), q(64), q(64), q(64), q(60), q(60), q(60),
      q(67), q(65), q(64), q(62), h(60),
    ],
  },
  {
    id: 'london', emoji: '🌉',
    notes: [
      q(67), q(69), q(67), q(65), q(64), q(65), h(67),
      q(62), q(64), h(65), q(64), q(65), h(67),
      q(67), q(69), q(67), q(65), q(64), q(65), h(67),
      h(62), q(67), q(64), h(60),
    ],
  },
  {
    id: 'spider', emoji: '🕷️',
    notes: [
      q(67), q(60), q(60), q(60), q(62), q(64), h(64),
      q(64), q(62), q(60), q(62), q(64), h(60),
      q(64), q(64), q(65), h(67), q(67), q(65), q(64), q(65), h(67),
      q(60), q(60), q(62), h(64), q(64), q(62), q(60), q(62), h(64),
      q(67), q(67), q(60), q(60), q(60), q(62), q(64), h(64),
      q(64), q(62), q(60), q(62), q(64), h(60),
    ],
  },
  {
    id: 'macdonald', emoji: '🐮',
    notes: [
      q(67), q(67), q(67), q(62), q(64), q(64), h(62),
      q(71), q(71), q(69), q(69), h(67),
      q(62), q(67), q(67), q(67), q(62), q(64), q(64), h(62),
      q(71), q(71), q(69), q(69), h(67),
    ],
  },
];

/** Gentle pentatonic pool for free play — any order sounds nice. */
export const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76];
