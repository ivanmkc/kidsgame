import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { manifest } from '../../manifest';
import { PlayerIx, nextTurn } from '../../multiplayer';
import { makeRng } from '../../rng';
import { Find, coopDrawCount, countFor } from '../hidden/coop';
import { HiddenGame } from '../hidden/HiddenGame';

describe('coopDrawCount', () => {
  it('is always even and never exceeds the pool', () => {
    for (let base = 1; base <= 12; base++) {
      for (let pool = 2; pool <= 12; pool++) {
        const n = coopDrawCount(base, pool);
        expect(n % 2).toBe(0);
        expect(n).toBeLessThanOrEqual(pool);
        expect(n).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('even-ifies upward: 5 → 6 with room in the pool', () => {
    expect(coopDrawCount(5, 10)).toBe(6);
  });

  it('clamps into a 7-pool and stays even', () => {
    expect(coopDrawCount(6, 7)).toBe(6);
    expect(coopDrawCount(7, 7)).toBe(6); // 7→8, clamp 7, still-odd → 6
    expect(coopDrawCount(8, 7)).toBe(6);
  });
});

describe('attribution-by-turn fairness', () => {
  it('|count0 − count1| ≤ 1 at every instant under any hit order', () => {
    // The turn holder is credited for ANY find and the turn then flips, so
    // whoever physically taps — in any order — credits alternate strictly.
    for (let seed = 1; seed <= 40; seed++) {
      const rng = makeRng(seed);
      const hits = 2 + Math.floor(rng() * 11);
      let turn: PlayerIx = rng() < 0.5 ? 0 : 1;
      const finds: Find[] = [];
      for (let i = 0; i < hits; i++) {
        finds.push({ id: `t${i}`, by: turn });
        turn = nextTurn(turn);
        expect(Math.abs(countFor(finds, 0) - countFor(finds, 1))).toBeLessThanOrEqual(1);
      }
      if (hits % 2 === 0) {
        expect(countFor(finds, 0)).toBe(countFor(finds, 1)); // completed even scene splits N/2
      }
    }
  });

  it('solo finds (by: null) credit neither player', () => {
    const finds: Find[] = [{ id: 'a', by: null }, { id: 'b', by: null }];
    expect(countFor(finds, 0)).toBe(0);
    expect(countFor(finds, 1)).toBe(0);
  });
});

describe('HiddenGame render with the 2P toggle OFF', () => {
  const noop = () => {};

  it('scene picker: no ModePicker, no 2P UI', () => {
    const html = renderToString(
      React.createElement(HiddenGame, {
        onHome: noop,
        difficulty: 'medium',
        twoPlayerEnabled: false,
        onPickScene: noop,
        onBackToPicker: noop,
      })
    );
    expect(html).not.toContain('mp-choose-1p');
    expect(html).not.toContain('mp-choose-2p');
    expect(html).not.toContain('hidden-turn-banner');
    expect(html).not.toContain('hidden-player-chip');
    expect(html).toContain('scene-surprise'); // the solo picker rendered normally
  });

  it('in a scene: no turn banner, no player chips, timer per difficulty', () => {
    const html = renderToString(
      React.createElement(HiddenGame, {
        onHome: noop,
        difficulty: 'medium',
        filter: 'medium', // pin: under 'all' the scene's own badge level governs (audit fix)
        twoPlayerEnabled: false,
        sceneId: manifest.hidden[0].id,
        onPickScene: noop,
        onBackToPicker: noop,
      })
    );
    expect(html).not.toContain('mp-choose-1p');
    expect(html).not.toContain('mp-choose-2p');
    expect(html).not.toContain('hidden-turn-banner');
    expect(html).not.toContain('hidden-player-chip');
    expect(html).toContain('hidden-checklist');
    expect(html).toContain('hidden-timer'); // medium shows the solo timer
  });
});
