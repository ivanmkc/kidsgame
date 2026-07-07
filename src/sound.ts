import { Platform } from 'react-native';

// Public-domain SFX (Kenney, CC0 — see public/sfx/CREDITS.txt) served as
// static files next to the app. Every trigger is a user gesture, so
// browser autoplay policy is satisfied. Native builds no-op (the web app
// is the shipped surface).

const KEY = 'kgb.sound.v1';
let muted = false;
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  muted = window.localStorage.getItem(KEY) === 'muted';
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(KEY, m ? 'muted' : 'on'); } catch { /* non-fatal */ }
  }
}

type Name = 'tap' | 'good' | 'wrong' | 'flip' | 'win' | 'boing' | 'thunder';
const cache: Partial<Record<Name, HTMLAudioElement>> = {};

function play(name: Name, volume = 0.5): void {
  if (muted || Platform.OS !== 'web' || typeof window === 'undefined' || !window.Audio) return;
  try {
    // sfx/ resolves against the page URL, so it works at / and /kidsgame/
    let a = cache[name];
    if (!a) {
      a = new window.Audio(`sfx/${name}.mp3`);
      a.preload = 'auto';
      cache[name] = a;
    }
    // cloneNode so rapid taps overlap instead of restarting
    const node = a.cloneNode(true) as HTMLAudioElement;
    node.volume = volume;
    void node.play().catch(() => { /* pre-gesture play: ignore */ });
  } catch { /* audio unavailable: stay silent */ }
}

export const sfx = {
  tap(): void { play('tap', 0.35); },
  good(): void { play('good', 0.5); },
  wrong(volume = 0.4): void { play('wrong', volume); },
  flip(): void { play('flip', 0.35); },
  win(): void { play('win', 0.6); },
  boing(): void { play('boing', 0.6); },
  thunder(): void { play('thunder', 0.75); },
};

import { VOICE } from './assets/voice';

let narration: HTMLAudioElement | null = null;

// Browsers block audio before the first user gesture, so a deep link's
// opening narration would die silently. Remember what we tried to say and
// replay it the moment the kid first touches the screen.
let audioUnlocked = false;
let pendingNarration: string[] | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const onFirstGesture = () => {
    audioUnlocked = true;
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('touchstart', onFirstGesture, true);
    window.removeEventListener('keydown', onFirstGesture, true);
    if (pendingNarration) {
      const p = pendingNarration;
      pendingNarration = null;
      saySequence(p);
    }
  };
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('touchstart', onFirstGesture, true);
  window.addEventListener('keydown', onFirstGesture, true);
}

/** Fade the current narration out fast (~250ms) — screen switches must
 *  not carry a voice from the previous game. */
export function stopNarration(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try { window.speechSynthesis?.cancel(); } catch { /* ok */ }
  const a = narration;
  if (!a) return;
  narration = null;
  const step = () => {
    if (a.volume > 0.08) { a.volume = Math.max(0, a.volume - 0.12); setTimeout(step, 30); }
    else { a.pause(); }
  };
  step();
}

/** Speak several lines in order (story text, then the spoken choice menu).
 *  Uses clip 'ended' chaining; any new say()/stopNarration() cancels. */
export function saySequence(texts: string[]): void {
  const rest = texts.filter(Boolean);
  if (!rest.length) return;
  say(rest[0], rest);
  if (rest.length > 1 && narration) {
    const cur = narration;
    cur.addEventListener('ended', () => {
      // only continue if nothing replaced us meanwhile
      if (narration === cur) saySequence(rest.slice(1));
    }, { once: true });
  }
}

/** Read instructions aloud for pre-readers. Pre-rendered SoTA clips
 *  (Gemini TTS, generated offline) play when available; Web Speech only
 *  covers strings that slipped the generator. */
export function say(text: string, sequence?: string[]): void {
  if (muted || Platform.OS !== 'web' || typeof window === 'undefined') return;
  const spoken = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  try {
    window.speechSynthesis?.cancel();
    if (narration) { narration.pause(); narration = null; }
    const clip = VOICE[spoken];
    if (clip && window.Audio) {
      narration = new window.Audio(`voice/${clip}`);
      narration.volume = 0.85;
      narration.play().then(() => { audioUnlocked = true; }).catch(() => {
        // blocked pre-gesture: replay the whole line-up on first touch
        if (!audioUnlocked) pendingNarration = sequence ?? [text];
      });
      return;
    }
    if (!window.speechSynthesis) return;
    if (!audioUnlocked) pendingNarration = sequence ?? [text];
    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = 0.92;
    u.pitch = 1.12;
    u.onstart = () => { audioUnlocked = true; if (pendingNarration?.[0] === text) pendingNarration = null; };
    window.speechSynthesis.speak(u);
  } catch { /* audio unavailable: stay silent */ }
}

import React from 'react';

/** Speak `text` whenever it changes; pass null to stay silent. One home
 *  for the narration concern (mute, cadence, future voice tuning). */
export function useSay(text: string | null): void {
  React.useEffect(() => {
    if (text) say(text);
  }, [text]);
}
