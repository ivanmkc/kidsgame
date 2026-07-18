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

describe('shipped escape rooms', () => {
  const rooms = manifest.escape ?? [];
  it.skipIf(rooms.length === 0)('every shipped room is lint-clean and solvable', () => {
    for (const room of rooms) {
      const errs = lintRoom(room);
      expect(errs, `${room.id}: ${errs.join('; ')}`).toEqual([]);
    }
  });
});
