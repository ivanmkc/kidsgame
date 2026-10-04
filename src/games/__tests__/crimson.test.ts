import { describe, expect, it } from 'vitest';
import {
  applyStep, applyTap, enterCode, nextHint, selectItem, startState,
  CrimsonState, SAFE_CODE, SOLUTION,
} from '../crimson/logic';
import { HINT, ITEM, MSG, WALL_NAME } from '../crimson/text';
import { LANGS } from '../../lang';

function solveUpTo(n: number): CrimsonState {
  let s = startState();
  for (const step of SOLUTION.slice(0, n)) s = applyStep(s, step).state;
  return s;
}

describe('crimson logic — golden path', () => {
  it('SOLUTION escapes the room', () => {
    let s = startState();
    for (const step of SOLUTION) {
      const r = applyStep(s, step);
      // No step of the published solution may bounce off a gate.
      expect(r.msg === 'codeWrong').toBe(false);
      s = r.state;
    }
    expect(s.won).toBe(true);
    expect(s.inventory).not.toContain('doorKey'); // spent on the door
  });

  it('every item earns its keep: tray drains to note + flashlight at the end', () => {
    const s = solveUpTo(SOLUTION.length);
    // note (clue) and the lit flashlight are keepsakes; all else consumed.
    expect([...s.inventory].sort()).toEqual(['flashlightLit', 'note']);
  });

  it('nextHint is defined and advances at every golden-path state', () => {
    let s = startState();
    const seen: string[] = [];
    for (const step of SOLUTION) {
      seen.push(nextHint(s));
      s = applyStep(s, step).state;
    }
    expect(seen.every(Boolean)).toBe(true);
    expect(nextHint(s)).toBe('hint.won');
  });
});

describe('crimson logic — gates hold', () => {
  it('under-bed is useless without the LIT flashlight selected', () => {
    let s = solveUpTo(4); // has dead flashlight + battery, not combined
    expect(applyTap(s, 'underBed').msg).toBe('underBedDark');
    s = selectItem(s, 'flashlight').state; // dead one selected
    const r = applyTap(s, 'underBed');
    expect(r.msg).toBe('underBedDark');
    expect(r.state.inventory).not.toContain('powerCord');
  });

  it('windowsill hides nothing until the curtains open', () => {
    const s = startState();
    expect(applyTap(s, 'sill').msg).toBe('sillBlocked');
  });

  it('top drawer stays locked without the brass key selected', () => {
    const s = solveUpTo(2); // brass key in tray but not selected
    const r = applyTap(s, 'topDrawer');
    expect(r.msg).toBe('topDrawerLocked');
    expect(r.state.inventory).not.toContain('usbDrive');
  });

  it('projector needs cord AND usb before it plays', () => {
    let s = solveUpTo(9); // usb+note in tray, cord in tray, nothing attached
    expect(applyTap(s, 'projector').msg).toBe('projectorNoPower');
    s = selectItem(s, 'powerCord').state;
    s = applyTap(s, 'projector').state; // plugged
    expect(applyTap(s, 'projector').msg).toBe('projectorNoUsb');
    s = selectItem(s, 'usbDrive').state;
    s = applyTap(s, 'projector').state; // inserted
    const r = applyTap(s, 'projector');
    expect(r.playClip).toBe(true);
    expect(r.state.flags.clipPlayed).toBe(true);
  });

  it('painting refuses to budge before the clip, slides after', () => {
    const before = solveUpTo(13); // clip not yet played
    expect(applyTap(before, 'painting').msg).toBe('paintingStuck');
    const after = solveUpTo(14);
    expect(applyTap(after, 'painting').msg).toBe('paintingSlid');
  });

  it('safe: wrong code bounces, right code pays out once', () => {
    const s = solveUpTo(16); // painting moved, keypad reachable
    expect(enterCode(s, '1994').msg).toBe('codeWrong');
    const opened = enterCode(s, SAFE_CODE);
    expect(opened.msg).toBe('codeRight');
    expect(opened.state.inventory).toContain('doorKey');
    expect(enterCode(opened.state, SAFE_CODE).msg).toBe('safeEmpty');
  });

  it('keypad is inert before the safe is revealed', () => {
    const s = startState();
    const r = enterCode(s, SAFE_CODE);
    expect(r.state.inventory).not.toContain('doorKey');
  });

  it('door needs the golden key selected', () => {
    const s = solveUpTo(17); // doorKey in tray, not selected
    expect(applyTap(s, 'door').msg).toBe('doorLocked');
    expect(applyTap(s, 'door').state.won).toBe(false);
  });
});

describe('crimson logic — combining', () => {
  it('battery + flashlight combine in either order', () => {
    for (const order of [['battery', 'flashlight'], ['flashlight', 'battery']] as const) {
      let s = solveUpTo(4);
      s = selectItem(s, order[0]).state;
      const r = selectItem(s, order[1]);
      expect(r.msg).toBe('combineLit');
      expect(r.state.inventory).toContain('flashlightLit');
      expect(r.state.inventory).not.toContain('battery');
      expect(r.state.inventory).not.toContain('flashlight');
      expect(r.state.selected).toBe('flashlightLit');
    }
  });

  it('non-combinable pair just switches selection, re-tap deselects', () => {
    let s = solveUpTo(2); // brassKey + flashlight
    s = selectItem(s, 'brassKey').state;
    const switched = selectItem(s, 'flashlight');
    expect(switched.state.selected).toBe('flashlight');
    expect(selectItem(switched.state, 'flashlight').state.selected).toBe(null);
  });
});

describe('crimson text — every key exists in all four languages', () => {
  it('MSG / HINT / ITEM / WALL_NAME cover en, ja, cmn, yue with no empty strings', () => {
    const langs = LANGS.map((l) => l.id);
    expect(langs.sort()).toEqual(['cmn', 'en', 'ja', 'yue']);
    for (const table of [MSG, HINT, ITEM]) {
      const enKeys = Object.keys(table.en).sort();
      for (const lang of langs) {
        expect(Object.keys(table[lang]).sort()).toEqual(enKeys);
        for (const v of Object.values(table[lang])) expect(String(v).length).toBeGreaterThan(0);
      }
    }
    for (const lang of langs) expect(WALL_NAME[lang]).toHaveLength(4);
  });
});
