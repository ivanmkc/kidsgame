// Pure escape-room state machine. Tap-select-tap (no drag): tap a search
// spot to find an item, tap the tray item to pick it up, tap the lock
// that needs it. UI-free so vitest can prove every shipped room solvable
// (the same trace the generator lint runs in Python before art is made).
import { EscapeHotspot, EscapeRoom } from '../../manifest';

export interface EscapeState {
  used: string[];      // consumed hotspot ids (searched empty spots stay tappable)
  inventory: string[]; // item ids held, in found order
  selected: string | null;
  done: boolean;
}

export type TapEffect =
  | { kind: 'found'; item: string; say?: string; pop?: string }     // item flies to tray
  | { kind: 'unlocked'; say?: string; pop?: string; item?: string } // lock opened (may reveal another item)
  | { kind: 'win'; say?: string; pop?: string }
  | { kind: 'locked'; say?: string }                                // needs an item the kid hasn't selected
  | { kind: 'flavor'; say?: string }                                // empty search spot — harmless fun
  | { kind: 'nothing' };

export function startState(): EscapeState {
  return { used: [], inventory: [], selected: null, done: false };
}

/** Tray capacity is 3 — rooms are linted to never need more in hand. */
export const TRAY_SIZE = 3;

export function selectItem(s: EscapeState, itemId: string): EscapeState {
  if (!s.inventory.includes(itemId)) return s;
  return { ...s, selected: s.selected === itemId ? null : itemId };
}

export function applyTap(room: EscapeRoom, s: EscapeState, hotspotId: string): { state: EscapeState; effect: TapEffect } {
  const h = room.hotspots.find((x) => x.id === hotspotId);
  if (!h || s.done || s.used.includes(h.id)) return { state: s, effect: { kind: 'nothing' } };

  if (h.kind === 'search') {
    if (!h.gives) return { state: s, effect: { kind: 'flavor', say: h.saySearch } };
    const state: EscapeState = {
      ...s,
      used: [...s.used, h.id],
      inventory: [...s.inventory, h.gives],
    };
    return { state, effect: { kind: 'found', item: h.gives, say: h.sayFound, pop: h.pop } };
  }

  // lock / win: an item requirement gates the tap.
  if (h.needs && s.selected !== h.needs) {
    return { state: s, effect: { kind: 'locked', say: h.sayLocked } };
  }
  const inventory = h.needs ? s.inventory.filter((i) => i !== h.needs) : s.inventory.slice();
  if (h.gives) inventory.push(h.gives);
  const state: EscapeState = {
    ...s,
    used: [...s.used, h.id],
    inventory,
    selected: null,
    done: h.kind === 'win',
  };
  if (h.kind === 'win') return { state, effect: { kind: 'win', say: h.sayFound, pop: h.pop } };
  return { state, effect: { kind: 'unlocked', say: h.sayFound, pop: h.pop, item: h.gives } };
}

/** What the idle-hint should point at: the next hotspot that advances the
 *  chain, plus the tray item to pick up first when a lock is next. */
export function nextHint(room: EscapeRoom, s: EscapeState): { hotspotId: string; selectItem?: string } | null {
  if (s.done) return null;
  for (const h of room.hotspots) {
    if (s.used.includes(h.id)) continue;
    if (h.kind === 'search' && h.gives) return { hotspotId: h.id };
    if ((h.kind === 'lock' || h.kind === 'win') && h.needs && s.inventory.includes(h.needs)) {
      return { hotspotId: h.id, selectItem: s.selected === h.needs ? undefined : h.needs };
    }
    if (h.kind === 'win' && !h.needs) return { hotspotId: h.id };
  }
  return null;
}

/** Play the room greedily to completion — the solvability oracle shared
 *  by tests. Returns the number of taps or null if the room dead-ends. */
export function solve(room: EscapeRoom): number | null {
  let s = startState();
  let taps = 0;
  for (let guard = 0; guard < 100; guard++) {
    if (s.done) return taps;
    const hint = nextHint(room, s);
    if (!hint) return null;
    if (hint.selectItem) s = selectItem(s, hint.selectItem);
    const r = applyTap(room, s, hint.hotspotId);
    if (r.effect.kind === 'nothing' || r.effect.kind === 'locked') return null; // hint lied — structural bug
    s = r.state;
    taps++;
  }
  return null;
}

/** Structural lint mirrored from tools/gen_escape.py — run in vitest over
 *  every shipped room so a hand-edited manifest can't break solvability. */
export function lintRoom(room: EscapeRoom): string[] {
  const errs: string[] = [];
  const gives = room.hotspots.filter((h) => h.gives).map((h) => h.gives!);
  const needs = room.hotspots.filter((h) => h.needs).map((h) => h.needs!);
  const itemIds = room.items.map((i) => i.id);
  for (const g of gives) if (!itemIds.includes(g)) errs.push(`gives unknown item '${g}'`);
  for (const n of needs) if (!gives.includes(n)) errs.push(`needs '${n}' but nothing gives it`);
  for (const i of itemIds) {
    if (!gives.includes(i)) errs.push(`item '${i}' is never given`);
    if (!needs.includes(i)) errs.push(`item '${i}' is never used (pod rule: every item used exactly once)`);
  }
  const dupGives = gives.filter((g, i) => gives.indexOf(g) !== i);
  if (dupGives.length) errs.push(`items given twice: ${dupGives.join(',')}`);
  if (!room.hotspots.some((h) => h.kind === 'win')) errs.push('no win hotspot');
  if (room.hotspots.filter((h) => h.kind === 'win').length > 1) errs.push('multiple win hotspots');
  if (solve(room) === null) errs.push('room is not solvable by greedy trace');
  // Tray pressure: greedy holds every unused item; cap at TRAY_SIZE.
  if (itemIds.length > TRAY_SIZE) errs.push(`room has ${itemIds.length} items (tray fits ${TRAY_SIZE})`);
  return errs;
}
