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
  boing(volume = 0.6): void { play('boing', volume); },
  thunder(): void { play('thunder', 0.75); },
};

import { VOICE } from './assets/voice';

// Active speech language for pre-rendered clip lookup. Mandarin and
// Cantonese share written forms ('一' reads yi vs jat), so non-English
// clips are keyed 'lang|text'; English stays keyed by plain text.
let speechLang = 'en';
export function setSpeechLang(l: string): void { speechLang = l; }

// SINGLETON narration element. iOS Safari only lets play() succeed when
// the element has been unlocked by a play() inside a real user gesture.
// We prime a SHARED element on the first gesture and swap .src for every
// subsequent line — later async play()s (from useEffects) then work even
// though they don't happen inside a gesture themselves.
let narration: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function getNarration(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.Audio) return null;
  if (!narration) {
    narration = new window.Audio();
    narration.preload = 'auto';
    narration.volume = 0.85;
    // Clips were synthesized at a gentle read-aloud pace; kids process
    // fine and slow drags — one global knob brings it to natural speed
    // (pitch is preserved by default in modern browsers).
    narration.playbackRate = 1.15;
    // A tiny debug hook (e2e tests count 'playing' events) — free to keep
    // in production, easier than re-wiring instrumentation each debug pass.
    narration.addEventListener('playing', () => {
      const src = narration?.currentSrc ?? '';
      if (src.startsWith('data:')) return; // the silent unlock prime is not narration
      const w = window as unknown as { __kgbAudioDebug?: { playing: number; lastSrc: string } };
      const d = w.__kgbAudioDebug ?? (w.__kgbAudioDebug = { playing: 0, lastSrc: '' });
      d.playing += 1;
      d.lastSrc = src;
    });
  }
  return narration;
}

// Browsers block audio before the first user gesture, so a deep link's
// opening narration would die silently. Remember what we tried to say and
// replay it the moment the kid first touches the screen.
let audioUnlocked = false;
let pendingNarration: string[] | null = null;

// 44-byte silent WAV (mono, 8kHz, 0 samples). Loading a real (empty) src
// during the first gesture unlocks the singleton on iOS Safari — after
// that, .src can be swapped and .play() called from anywhere.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

function primeUnlock(): void {
  const a = getNarration();
  if (!a) return;
  try {
    a.src = SILENT_WAV;
    const p = a.play();
    if (p && typeof p.then === 'function') p.catch(() => { /* fine */ });
  } catch { /* fine */ }
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const onFirstGesture = () => {
    audioUnlocked = true;
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('touchstart', onFirstGesture, true);
    window.removeEventListener('keydown', onFirstGesture, true);
    // Unlock the singleton element WHILE we're inside the gesture. From
    // now on, .play() from a useEffect works even on iOS Safari.
    primeUnlock();
    if (pendingNarration) {
      const p = pendingNarration;
      pendingNarration = null;
      // Delay one frame so the prime play settles first — some browsers
      // interrupt the just-primed play if we re-set .src within the same
      // task, and swallow the second play() as well. Token-guarded: if the
      // same gesture also navigates (tap the back button, tap a hotspot),
      // the intervening stopNarration/say bumps the token and this stale
      // queue must NOT speak on the wrong screen.
      const t = ++currentToken;
      setTimeout(() => { if (t === currentToken) saySequence(p); }, 0);
    }
  };
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('touchstart', onFirstGesture, true);
  window.addEventListener('keydown', onFirstGesture, true);
}

// A monotonically-increasing token for say/saySequence calls. Because the
// same singleton element is reused across lines, we can't rely on element
// identity to tell a sequence continuation from a superseding call — we
// tag each call and skip stale continuations.
let currentToken = 0;

function fadeStop(a: HTMLAudioElement): void {
  if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
  const step = () => {
    if (a.volume > 0.08) {
      a.volume = Math.max(0, a.volume - 0.12);
      fadeTimer = setTimeout(step, 30);
    } else {
      try { a.pause(); } catch { /* ok */ }
      fadeTimer = null;
    }
  };
  step();
}

/** Fade the current narration out fast (~250ms) — screen switches must
 *  not carry a voice from the previous game. Bump the token so any
 *  in-flight sequence continuation stops chaining. */
export function stopNarration(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  currentToken++;
  try { window.speechSynthesis?.cancel(); } catch { /* ok */ }
  const a = narration;
  if (!a || a.paused) return;
  fadeStop(a);
}

function playClip(text: string, token: number, onEnded?: () => void): void {
  if (muted || Platform.OS !== 'web' || typeof window === 'undefined') return;
  const spoken = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  const clip = (speechLang !== 'en' ? VOICE[`${speechLang}|${spoken}`] : undefined) ?? VOICE[spoken];
  try {
    window.speechSynthesis?.cancel();
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    const a = getNarration();
    if (a) {
      // Whatever plays next (clip OR Web Speech), the previous clip must
      // stop — the fallback path double-played over leftover audio before.
      a.onended = null;
      try { a.pause(); } catch { /* ok */ }
    }
    if (clip && a) {
      // Reuse the singleton: swap .src (already unlocked by the first
      // gesture) instead of new Audio() (which would need unlocking again).
      a.volume = 0.85;
      a.src = `voice/${clip}`;
      a.playbackRate = 1.15;
      if (onEnded) {
        a.onended = () => { if (token === currentToken) onEnded(); };
      }
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { audioUnlocked = true; }).catch(() => { /* pre-gesture: caller queued pendingNarration */ });
      }
      return;
    }
    // Web Speech fallback for lines the pre-render pipeline missed.
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = 1.0;
    u.pitch = 1.12;
    u.onstart = () => { audioUnlocked = true; if (pendingNarration?.[0] === text) pendingNarration = null; };
    if (onEnded) u.onend = () => { if (token === currentToken) onEnded(); };
    window.speechSynthesis.speak(u);
  } catch { /* audio unavailable: stay silent */ }
}

/** Speak several lines in order (story text, then the spoken choice menu).
 *  Any new say()/saySequence()/stopNarration() supersedes the queue. */
export function saySequence(texts: string[], onDone?: () => void): void {
  const rest = texts.filter(Boolean);
  if (!rest.length) { onDone?.(); return; }
  currentToken++;
  const myToken = currentToken;
  if (!audioUnlocked && Platform.OS === 'web' && typeof window !== 'undefined' && !muted) {
    pendingNarration = rest.slice();
  }
  const step = (i: number) => {
    if (myToken !== currentToken) return; // superseded — no onDone (caller's cap handles it)
    if (i >= rest.length) { onDone?.(); return; }
    playClip(rest[i], myToken, () => step(i + 1));
  };
  step(0);
}

/** Speak lines, then run `done` exactly once — for round advances that
 *  must WAIT for the celebration to finish (a fixed timeout races the
 *  speech and the next round's prompt cuts it off). Guards: muted or
 *  non-web fires after a short beat; a hard cap fires even if the clip
 *  stalls or the sequence is superseded mid-way. */
export function sayThen(texts: string[], done: () => void, capMs = 9000): void {
  let fired = false;
  const fire = () => { if (!fired) { fired = true; done(); } };
  if (muted || Platform.OS !== 'web' || typeof window === 'undefined') {
    setTimeout(fire, 600);
    return;
  }
  const cap = setTimeout(fire, capMs);
  saySequence(texts, () => { clearTimeout(cap); fire(); });
}

/** Read instructions aloud for pre-readers. Pre-rendered SoTA clips
 *  (Gemini TTS, generated offline) play when available; Web Speech only
 *  covers strings that slipped the generator. */
export function say(text: string, sequence?: string[]): void {
  if (muted || Platform.OS !== 'web' || typeof window === 'undefined') return;
  currentToken++;
  if (!audioUnlocked) pendingNarration = sequence ?? [text];
  playClip(text, currentToken);
}

import React from 'react';

/** Speak `text` whenever it changes; pass null to stay silent. One home
 *  for the narration concern (mute, cadence, future voice tuning). */
export function useSay(text: string | null): void {
  React.useEffect(() => {
    if (text) say(text);
  }, [text]);
}
