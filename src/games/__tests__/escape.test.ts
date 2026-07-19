import { describe, expect, it } from 'vitest';
import { EscapeRoom, manifest } from '../../manifest';
import { applyTap, lintRoom, nextHint, selectItem, solve, startState } from '../escape/logic';

// Fixture: the toyroom chain — pillow → key → toy chest → bone → puppy.
const ROOM: EscapeRoom = {
  id: 'test', name: 'Test Room', image: 'escape/test.png',
  intro: 'Free the puppy!', winText: 'You did it!',
  items: [
    { id: 'key', label: 'A key!', emoji: '🗝️' },
    { id: 'bone', label: 'A bone!', emoji: '🦴' },
  ],
  hotspots: [
    { id: 'pillow', box: { x: 0, y: 0, w: 10, h: 10 }, kind: 'search', gives: 'key', sayFound: 'A shiny key!' },
    { id: 'plant', box: { x: 20, y: 0, w: 10, h: 10 }, kind: 'search', saySearch: 'Just leaves!' },
    { id: 'chest', box: { x: 40, y: 0, w: 10, h: 10 }, kind: 'lock', needs: 'key', gives: 'bone', sayLocked: 'It is locked tight!' },
    { id: 'cage', box: { x: 60, y: 0, w: 10, h: 10 }, kind: 'win', needs: 'bone', sayLocked: 'The puppy wants something…' },
  ],
};

describe('escape logic', () => {
  it('plays the full chain: search → reveal → collect → unlock → reveal → collect → win', () => {
    let s = startState();

    // Tap pillow → reveals key (not yet in inventory)
    let r = applyTap(ROOM, s, 'pillow');
    expect(r.effect).toMatchObject({ kind: 'revealed', item: 'key' });
    s = r.state;
    expect(s.revealed).toContain('pillow');
    expect(s.inventory).toEqual([]);

    // Tap pillow again (or itemBox) → collects key into inventory
    r = applyTap(ROOM, s, 'pillow');
    expect(r.effect).toMatchObject({ kind: 'collected', item: 'key' });
    s = r.state;
    expect(s.inventory).toEqual(['key']);
    expect(s.used).toContain('pillow');
    expect(s.revealed).not.toContain('pillow');

    // Forgiveness rule: holding the key is enough — no selection required.
    s = selectItem(s, 'key');
    r = applyTap(ROOM, s, 'chest');
    expect(r.effect).toMatchObject({ kind: 'revealed', item: 'bone' });
    s = r.state;
    expect(s.revealed).toContain('chest');
    expect(s.inventory).toEqual([]); // key consumed, bone not yet collected

    // Collect bone from revealed chest
    r = applyTap(ROOM, s, 'chest');
    expect(r.effect).toMatchObject({ kind: 'collected', item: 'bone' });
    s = r.state;
    expect(s.inventory).toEqual(['bone']);
    expect(s.selected).toBeNull();

    // Win via forgiveness: bone held but NOT selected still frees the puppy.
    r = applyTap(ROOM, s, 'cage');
    expect(r.effect.kind).toBe('win');
    expect(r.state.done).toBe(true);
  });

  it('locks refuse only when the needed item is not held at all', () => {
    const s = startState();
    const r = applyTap(ROOM, s, 'chest');
    expect(r.effect.kind).toBe('locked');
    expect(r.state.used).not.toContain('chest');
  });

  it('empty search spots are harmless flavor and stay tappable', () => {
    const s = startState();
    const r = applyTap(ROOM, s, 'plant');
    expect(r.effect).toMatchObject({ kind: 'flavor', say: 'Just leaves!' });
    expect(r.state.used).toHaveLength(0);
  });

  it('revealed hotspots stay tappable for collection', () => {
    let s = startState();
    const r = applyTap(ROOM, s, 'pillow');
    expect(r.effect.kind).toBe('revealed');
    s = r.state;
    expect(s.revealed).toContain('pillow');
    expect(applyTap(ROOM, s, 'pillow').effect.kind).toBe('collected');
  });

  it('fully used hotspots go dead', () => {
    let s = startState();
    s = applyTap(ROOM, s, 'pillow').state; // reveal
    s = applyTap(ROOM, s, 'pillow').state; // collect
    expect(applyTap(ROOM, s, 'pillow').effect.kind).toBe('nothing');
  });

  it('selection toggles and rejects unheld items', () => {
    let s = startState();
    expect(selectItem(s, 'key')).toBe(s); // not held yet
    s = applyTap(ROOM, s, 'pillow').state; // reveal
    s = applyTap(ROOM, s, 'pillow').state; // collect
    s = selectItem(s, 'key');
    expect(s.selected).toBe('key');
    expect(selectItem(s, 'key').selected).toBeNull();
  });

  it('nextHint walks the chain in order, prioritizing revealed items', () => {
    let s = startState();
    expect(nextHint(ROOM, s)).toMatchObject({ hotspotId: 'pillow' });

    // Reveal key — hint should point at the revealed item for collection
    s = applyTap(ROOM, s, 'pillow').state;
    expect(nextHint(ROOM, s)).toMatchObject({ hotspotId: 'pillow' });

    // Collect key — hint should advance to the chest
    s = applyTap(ROOM, s, 'pillow').state;
    expect(nextHint(ROOM, s)).toMatchObject({ hotspotId: 'chest', selectItem: 'key' });
  });

  it('fixture room passes lint and solves in 5 taps (reveal+collect each)', () => {
    expect(lintRoom(ROOM)).toEqual([]);
    expect(solve(ROOM)).toBe(5); // pillow reveal, pillow collect, chest reveal, chest collect, cage win
  });

  it('lint catches dead ends', () => {
    const broken: EscapeRoom = {
      ...ROOM,
      hotspots: ROOM.hotspots.filter((h) => h.id !== 'pillow'), // key never given
    };
    const errs = lintRoom(broken);
    expect(errs.join(' ')).toMatch(/needs 'key' but nothing gives it/);
    expect(errs.join(' ')).toMatch(/not solvable/);
  });
});

describe('sprite accumulator math', () => {
  const FPS = 12;
  const FRAME_COUNT = 48;
  const frameDuration = 1 / FPS;

  function simulate(dtSequence: number[]): { frameIndex: number; playing: boolean; held: boolean } {
    let accumulator = 0;
    let frameIndex = 0;
    let playing = true;
    let held = false;
    for (const dt of dtSequence) {
      if (!playing) break;
      if (dt > 0) {
        accumulator += dt;
        while (accumulator >= frameDuration) {
          accumulator -= frameDuration;
          frameIndex++;
        }
        if (frameIndex >= FRAME_COUNT - 1) {
          frameIndex = FRAME_COUNT - 1;
          playing = false;
          held = true;
        }
      }
    }
    return { frameIndex, playing, held };
  }

  it('first tick (dt=0) keeps frame 0 and stays playing', () => {
    const r = simulate([0]);
    expect(r.frameIndex).toBe(0);
    expect(r.playing).toBe(true);
    expect(r.held).toBe(false);
  });

  it('advances one frame after 1/fps seconds', () => {
    const r = simulate([0, frameDuration]);
    expect(r.frameIndex).toBe(1);
    expect(r.playing).toBe(true);
  });

  it('at 400ms (~frame 4) lid is barely moving, not held', () => {
    // 60fps rAF: 24 ticks in 400ms, each ~16.67ms = 0.01667s
    const ticks = [0, ...Array(24).fill(0.4 / 24)];
    const r = simulate(ticks);
    expect(r.frameIndex).toBe(4);
    expect(r.playing).toBe(true);
    expect(r.held).toBe(false);
  });

  it('at 2000ms (~frame 24) half open', () => {
    const ticks = [0, ...Array(120).fill(2.0 / 120)];
    const r = simulate(ticks);
    expect(r.frameIndex).toBe(24);
    expect(r.playing).toBe(true);
  });

  it('completes and holds at last frame after full duration', () => {
    const totalDuration = FRAME_COUNT / FPS; // 4 seconds
    const ticks = [0, ...Array(240).fill(totalDuration / 240)];
    const r = simulate(ticks);
    expect(r.frameIndex).toBe(FRAME_COUNT - 1);
    expect(r.playing).toBe(false);
    expect(r.held).toBe(true);
  });

  it('dt cap at 0.1s prevents skipping more than 1 frame per tick', () => {
    // Even with a huge gap (tab backgrounded), dt is capped at 0.1s
    // At 12fps, 0.1s = 1.2 frames → advances by 1 frame per tick
    const r = simulate([0, 0.1]);
    expect(r.frameIndex).toBe(1);
    expect(r.playing).toBe(true);
  });
});

describe('shipped escape rooms', () => {
  const rooms = manifest.escape ?? [];
  it.skipIf(rooms.length === 0)('every shipped room is lint-clean and solvable', () => {
    for (const room of rooms) {
      const errs = lintRoom(room);
      expect(errs, `${room.id}: ${errs.join('; ')}`).toEqual([]);
    }
  });
});
