import { Platform } from 'react-native';
import { isMuted } from './sound';

// Pitched note playback for the Music Box game — the app's first Web Audio
// surface (sound.ts is HTMLAudioElement-only). Notes are synthesized at
// runtime (no assets): a music-box tine is approximated by a fundamental
// sine plus two quiet high partials, sharp attack, exponential decay.
// Every call happens inside a user gesture (taps), so autoplay policy is
// satisfied; we still resume() defensively because iOS suspends contexts.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    // Headroom for kids hammering 10 notes/sec — per-note peaks ~0.5.
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Create/resume the AudioContext inside a user gesture (iOS suspends it). */
export function primeMusic(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume().catch(() => { /* fine */ });
}

/** Play one synthesized music-box note. midi 60 = middle C. */
export function playNote(midi: number, velocity = 1): void {
  if (isMuted()) return;
  const c = getCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume().catch(() => { /* fine */ });
  const t0 = c.currentTime;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  // partials: [multiple of f, peak gain, decay seconds]
  const partials: Array<[number, number, number]> = [
    [1, 0.5, 1.4],     // fundamental — the round body of the note
    [4, 0.12, 0.5],    // 2 octaves up — the bright tine "ping"
    [5.4, 0.04, 0.25], // slightly inharmonic shimmer, metallic edge
  ];
  for (const [mult, peak, decay] of partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak * velocity, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0004, t0 + decay);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
}
