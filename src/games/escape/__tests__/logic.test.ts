import { describe, expect, it } from 'vitest';
import { applyTap, startState, EscapeState, selectItem } from '../logic';
import { EscapeRoom } from '../../../manifest';

describe('escape game logic', () => {
  it('selecting wrong item prevents unlock, teaching causality', () => {
    // Room with one lock that needs 'key'.
    const room: EscapeRoom = {
      id: 'test_causality',
      name: 'test',
      image: '',
      intro: '',
      winText: '',
      hotspots: [
        {
          id: 'cage',
          kind: 'win',
          box: { x: 0, y: 0, w: 10, h: 10 },
          needs: 'key',
          sayLocked: 'I need the key.',
        },
      ],
      items: [
        { id: 'key', label: 'key', emoji: '🔑' },
        { id: 'bone', label: 'bone', emoji: '🦴' },
      ],
    };

    // Kid has both 'key' and 'bone' in inventory.
    let s: EscapeState = {
      ...startState(),
      inventory: ['key', 'bone'],
    };

    // If no item is explicitly selected, the forgiveness rule allows unlock
    // because 'key' is in the inventory.
    const resultUnselected = applyTap(room, s, 'cage');
    expect(resultUnselected.effect.kind).toBe('win');

    // If 'key' is explicitly selected, it also unlocks.
    s = selectItem(s, 'key');
    const resultSelectedRight = applyTap(room, s, 'cage');
    expect(resultSelectedRight.effect.kind).toBe('win');

    // BUT if 'bone' is actively selected, we must deny it,
    // so they don't learn that 'bone' opens a cage needing a 'key'.
    s = { ...startState(), inventory: ['key', 'bone'] };
    s = selectItem(s, 'bone');
    const resultSelectedWrong = applyTap(room, s, 'cage');
    expect(resultSelectedWrong.effect.kind).toBe('locked');
  });
});
