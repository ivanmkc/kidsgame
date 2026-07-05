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

type Name = 'tap' | 'good' | 'wrong' | 'flip' | 'win';
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
  wrong(): void { play('wrong', 0.4); },
  flip(): void { play('flip', 0.35); },
  win(): void { play('win', 0.6); },
};
