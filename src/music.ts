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
  scheduleNote(c, master, midi, c.currentTime, velocity);
}

function scheduleNote(c: AudioContext, dest: GainNode, midi: number, t0: number, velocity: number): void {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const partials: Array<[number, number, number]> = [
    [1, 0.5, 1.4],
    [4, 0.12, 0.5],
    [5.4, 0.04, 0.25],
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
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
}

export interface SeqNote {
  m: number;  // midi
  b: number;  // beats (duration in beats)
}

let seqCancel: (() => void) | null = null;

/** Stop any playing sequence immediately. */
export function stopSequence(): void {
  if (seqCancel) { seqCancel(); seqCancel = null; }
}

/**
 * Play a sequence of notes with precise AudioContext-clock scheduling.
 * Lookahead scheduling guarantees rhythm-accurate playback — this is a
 * training app, so timing must be tight.
 *
 * `onNote(index)` fires when each note begins (for visual sync).
 * `onDone()` fires after the last note has played.
 * Returns a cancel function.
 */
export function playSequence(
  notes: SeqNote[],
  bpm: number,
  onNote?: (index: number) => void,
  onDone?: () => void,
): () => void {
  if (isMuted() || !notes.length) { onDone?.(); return () => {}; }
  const c = getCtx();
  if (!c || !master) { onDone?.(); return () => {}; }
  if (c.state === 'suspended') void c.resume().catch(() => { /* fine */ });

  const beatSec = 60 / bpm;
  const startTime = c.currentTime + 0.05;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  let offset = 0;
  for (let i = 0; i < notes.length; i++) {
    const noteTime = startTime + offset;
    scheduleNote(c, master, notes[i].m, noteTime, 0.8);
    if (onNote) {
      const idx = i;
      const ms = Math.max(0, (noteTime - c.currentTime) * 1000);
      timers.push(setTimeout(() => { if (!cancelled) onNote(idx); }, ms));
    }
    offset += notes[i].b * beatSec;
  }

  if (onDone) {
    const endMs = Math.max(0, (startTime + offset - c.currentTime) * 1000);
    timers.push(setTimeout(() => { if (!cancelled) onDone(); }, endMs));
  }

  const cancel = () => {
    cancelled = true;
    for (const t of timers) clearTimeout(t);
  };
  seqCancel = cancel;
  return cancel;
}

/**
 * Play a percussive drum tick — short noise burst + low sine thump.
 * Used by rhythm games (echobeat, steadybeat).
 */
export function playDrum(velocity = 0.7): void {
  if (isMuted()) return;
  const c = getCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume().catch(() => { /* fine */ });
  scheduleDrum(c, master, c.currentTime, velocity);
}

export function scheduleDrum(c: AudioContext, dest: GainNode, t0: number, velocity: number): void {
  const noiseLen = 0.04;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * noiseLen), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const nGain = c.createGain();
  nGain.gain.setValueAtTime(0.35 * velocity, t0);
  nGain.gain.exponentialRampToValueAtTime(0.001, t0 + noiseLen);
  noise.connect(nGain);
  nGain.connect(dest);
  noise.start(t0);
  noise.stop(t0 + noiseLen + 0.01);

  const osc = c.createOscillator();
  const oGain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t0);
  osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.08);
  oGain.gain.setValueAtTime(0.5 * velocity, t0);
  oGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  osc.connect(oGain);
  oGain.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.15);
}

/**
 * Play a sequence of drum hits with AudioContext-clock scheduling.
 * `gaps` is an array of inter-onset intervals in seconds.
 * Returns a cancel function.
 */
export function playDrumSequence(
  gaps: number[],
  onHit?: (index: number) => void,
  onDone?: () => void,
): () => void {
  if (isMuted() || !gaps.length) { onDone?.(); return () => {}; }
  const c = getCtx();
  if (!c || !master) { onDone?.(); return () => {}; }
  if (c.state === 'suspended') void c.resume().catch(() => { /* fine */ });

  const startTime = c.currentTime + 0.05;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const hitCount = gaps.length + 1;

  let offset = 0;
  for (let i = 0; i < hitCount; i++) {
    const hitTime = startTime + offset;
    scheduleDrum(c, master, hitTime, 0.7);
    if (onHit) {
      const idx = i;
      const ms = Math.max(0, (hitTime - c.currentTime) * 1000);
      timers.push(setTimeout(() => { if (!cancelled) onHit(idx); }, ms));
    }
    if (i < gaps.length) offset += gaps[i];
  }

  if (onDone) {
    const endMs = Math.max(0, (startTime + offset + 0.3 - c.currentTime) * 1000);
    timers.push(setTimeout(() => { if (!cancelled) onDone(); }, endMs));
  }

  const cancel = () => {
    cancelled = true;
    for (const t of timers) clearTimeout(t);
  };
  seqCancel = cancel;
  return cancel;
}
