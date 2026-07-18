// Every game speaks its win banner line — the same localized string the
// child sees. One spoken-key list feeds both the useWinLine hook and the
// voice-clip pipeline (speechLines), so screen text, spoken text and clip
// keys can never drift apart. Keys with {placeholders} are excluded
// (per-value clips are enumerated where bounded, e.g. spell).
import { useEffect } from 'react';
import { LANGS } from '../lang';
import { UIKey, t } from '../i18n';
import { say } from '../sound';
import { wordsPerGame } from './spell/logic';

export const SPOKEN_WIN_KEYS = [
  'win.diff', 'win.hidden', 'win.hiddenCoop', 'win.memory', 'win.shadow',
  'win.oddone', 'win.rules', 'win.puzzle', 'win.spotit',
  'win.letters', 'win.lettersKana', 'win.numbers',
  'win.sounds', 'win.soundsWords', 'win.rhyme',
  'win.count', 'win.compare', 'win.sums', 'win.bingo', 'win.musicbox',
  'win.highlow', 'win.bells', 'win.echobeat', 'win.steadybeat',
  'win.fastslow', 'win.samediff',
] as const satisfies readonly UIKey[];

/** Speak `line` exactly once when `won` flips true. */
export function useWinLine(won: boolean, line: string | null): void {
  useEffect(() => {
    if (won && line) say(line);
  }, [won]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** All spoken win lines across every lang (clip pre-render contract). */
export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    for (const k of SPOKEN_WIN_KEYS) out.push(t(l.id, k));
    for (const d of ['easy', 'medium', 'hard'] as const) {
      out.push(t(l.id, 'win.spell', { n: wordsPerGame(d) }));
    }
  }
  return [...new Set(out)];
}
