// Crimson Escape — pure state machine (no React). Homage to Toshimitsu
// Takagi's Crimson Room (2004). The room must stay provably solvable:
// crimson.test.ts plays SOLUTION end-to-end, so any edit here that breaks
// the golden path fails CI.

export type ItemId =
  | 'brassKey'
  | 'flashlight'      // dead — needs the battery
  | 'flashlightLit'
  | 'battery'
  | 'powerCord'
  | 'usbDrive'
  | 'note'
  | 'doorKey';

export type HotspotId =
  | 'pillow' | 'underBed'
  | 'curtains' | 'sill' | 'calendar'
  | 'topDrawer' | 'bottomDrawer' | 'projector'
  | 'painting' | 'safe' | 'door';

export type Flag =
  | 'pillowLooted' | 'curtainsOpen' | 'sillLooted' | 'bottomDrawerLooted'
  | 'topDrawerOpen' | 'cordTaken' | 'cordPlugged' | 'usbInserted'
  | 'clipPlayed' | 'paintingMoved' | 'safeOpen';

export interface CrimsonState {
  flags: Partial<Record<Flag, true>>;
  inventory: ItemId[];
  selected: ItemId | null;
  won: boolean;
}

// Message keys resolve to 4-language strings in text.ts.
export type MsgKey =
  | 'intro'
  | 'lookPillow' | 'pillowEmpty'
  | 'underBedDark' | 'underBedLit' | 'underBedEmpty'
  | 'curtainsOpened' | 'curtainsAlready'
  | 'sillBlocked' | 'sillBattery' | 'sillEmpty'
  | 'calendarDim' | 'calendarRead'
  | 'topDrawerLocked' | 'topDrawerUnlock' | 'topDrawerEmpty'
  | 'bottomDrawerFind' | 'bottomDrawerEmpty'
  | 'projectorNoPower' | 'projectorPlug' | 'projectorNoUsb' | 'projectorUsb'
  | 'projectorPlay' | 'clipDone' | 'projectorAgain'
  | 'paintingStuck' | 'paintingSlid' | 'safeEmpty'
  | 'codeWrong' | 'codeRight'
  | 'doorLocked' | 'doorOpened'
  | 'combineLit';

export type SfxKind = 'tap' | 'flip' | 'good' | 'wrong' | 'win';

export interface Result {
  state: CrimsonState;
  msg?: MsgKey;
  sfx?: SfxKind;
  /** UI side-effects the pure layer can't perform. */
  openKeypad?: boolean;
  playClip?: boolean;
}

export const SAFE_CODE = '2004'; // the year Crimson Room was born

export function startState(): CrimsonState {
  return { flags: {}, inventory: [], selected: null, won: false };
}

function has(s: CrimsonState, item: ItemId): boolean {
  return s.inventory.includes(item);
}
function flag(s: CrimsonState, f: Flag): boolean {
  return s.flags[f] === true;
}
function set(s: CrimsonState, ...fs: Flag[]): CrimsonState {
  const flags = { ...s.flags };
  for (const f of fs) flags[f] = true;
  return { ...s, flags };
}
function gain(s: CrimsonState, ...items: ItemId[]): CrimsonState {
  return { ...s, inventory: [...s.inventory, ...items] };
}
function drop(s: CrimsonState, item: ItemId): CrimsonState {
  return { ...s, inventory: s.inventory.filter((i) => i !== item), selected: s.selected === item ? null : s.selected };
}
function deselect(s: CrimsonState): CrimsonState {
  return s.selected === null ? s : { ...s, selected: null };
}

/**
 * Tap an inventory slot. Tap-select-tap: selecting the counterpart of a
 * combinable pair combines; re-tapping deselects; anything else switches
 * selection (never an error — browsing the tray must feel safe).
 */
export function selectItem(s: CrimsonState, item: ItemId): Result {
  if (!has(s, item)) return { state: s };
  if (s.selected === item) return { state: deselect(s), sfx: 'tap' };
  const pair = s.selected !== null ? [s.selected, item] : [];
  if (pair.includes('battery') && pair.includes('flashlight')) {
    let n = drop(drop(s, 'battery'), 'flashlight');
    n = gain(n, 'flashlightLit');
    return { state: { ...n, selected: 'flashlightLit' }, msg: 'combineLit', sfx: 'good' };
  }
  return { state: { ...s, selected: item }, sfx: 'tap' };
}

export function applyTap(s: CrimsonState, h: HotspotId): Result {
  if (s.won) return { state: s };
  switch (h) {
    case 'pillow':
      if (flag(s, 'pillowLooted')) return { state: s, msg: 'pillowEmpty', sfx: 'tap' };
      return { state: gain(set(s, 'pillowLooted'), 'brassKey'), msg: 'lookPillow', sfx: 'good' };

    case 'underBed':
      if (flag(s, 'cordTaken')) return { state: s, msg: 'underBedEmpty', sfx: 'tap' };
      if (s.selected === 'flashlightLit')
        return { state: gain(set(deselect(s), 'cordTaken'), 'powerCord'), msg: 'underBedLit', sfx: 'good' };
      return { state: s, msg: 'underBedDark', sfx: 'tap' };

    case 'curtains':
      if (flag(s, 'curtainsOpen')) return { state: s, msg: 'curtainsAlready', sfx: 'tap' };
      return { state: set(s, 'curtainsOpen'), msg: 'curtainsOpened', sfx: 'flip' };

    case 'sill':
      if (!flag(s, 'curtainsOpen')) return { state: s, msg: 'sillBlocked', sfx: 'tap' };
      if (flag(s, 'sillLooted')) return { state: s, msg: 'sillEmpty', sfx: 'tap' };
      return { state: gain(set(s, 'sillLooted'), 'battery'), msg: 'sillBattery', sfx: 'good' };

    case 'calendar':
      return flag(s, 'curtainsOpen')
        ? { state: s, msg: 'calendarRead', sfx: 'flip' }
        : { state: s, msg: 'calendarDim', sfx: 'tap' };

    case 'topDrawer':
      if (flag(s, 'topDrawerOpen')) return { state: s, msg: 'topDrawerEmpty', sfx: 'tap' };
      if (s.selected === 'brassKey') {
        // The key stays in the lock — one less dead item in the tray.
        const n = gain(set(drop(s, 'brassKey'), 'topDrawerOpen'), 'usbDrive', 'note');
        return { state: n, msg: 'topDrawerUnlock', sfx: 'good' };
      }
      return { state: s, msg: 'topDrawerLocked', sfx: 'tap' };

    case 'bottomDrawer':
      if (flag(s, 'bottomDrawerLooted')) return { state: s, msg: 'bottomDrawerEmpty', sfx: 'tap' };
      return { state: gain(set(s, 'bottomDrawerLooted'), 'flashlight'), msg: 'bottomDrawerFind', sfx: 'good' };

    case 'projector':
      if (s.selected === 'powerCord' && !flag(s, 'cordPlugged'))
        return { state: set(drop(s, 'powerCord'), 'cordPlugged'), msg: 'projectorPlug', sfx: 'good' };
      if (s.selected === 'usbDrive' && !flag(s, 'usbInserted'))
        return { state: set(drop(s, 'usbDrive'), 'usbInserted'), msg: 'projectorUsb', sfx: 'good' };
      if (flag(s, 'clipPlayed')) return { state: s, msg: 'projectorAgain', sfx: 'tap' };
      if (flag(s, 'cordPlugged') && flag(s, 'usbInserted'))
        return { state: set(s, 'clipPlayed'), msg: 'projectorPlay', sfx: 'flip', playClip: true };
      return { state: s, msg: flag(s, 'cordPlugged') ? 'projectorNoUsb' : 'projectorNoPower', sfx: 'tap' };

    case 'painting':
      if (flag(s, 'paintingMoved')) return { state: s, sfx: 'tap' };
      if (!flag(s, 'clipPlayed')) return { state: s, msg: 'paintingStuck', sfx: 'tap' };
      return { state: set(s, 'paintingMoved'), msg: 'paintingSlid', sfx: 'flip' };

    case 'safe':
      if (!flag(s, 'paintingMoved')) return { state: s, sfx: 'tap' };
      if (flag(s, 'safeOpen')) return { state: s, msg: 'safeEmpty', sfx: 'tap' };
      return { state: s, openKeypad: true, sfx: 'tap' };

    case 'door':
      if (s.selected === 'doorKey') {
        const n = drop(s, 'doorKey');
        return { state: { ...n, won: true }, msg: 'doorOpened', sfx: 'win' };
      }
      return { state: s, msg: 'doorLocked', sfx: 'tap' };
  }
}

export function enterCode(s: CrimsonState, code: string): Result {
  if (!flag(s, 'paintingMoved')) return { state: s };
  if (flag(s, 'safeOpen')) return { state: s, msg: 'safeEmpty', sfx: 'tap' };
  if (code !== SAFE_CODE) return { state: s, msg: 'codeWrong', sfx: 'wrong' };
  return { state: gain(set(s, 'safeOpen'), 'doorKey'), msg: 'codeRight', sfx: 'good' };
}

// ── Hints ──────────────────────────────────────────────────────────
// One canonical next step per state; drives the ? button and doubles as
// the solver oracle in tests.
export type HintKey =
  | 'hint.pillow' | 'hint.bottomDrawer' | 'hint.curtains' | 'hint.sill'
  | 'hint.combine' | 'hint.underBed' | 'hint.topDrawer' | 'hint.plug'
  | 'hint.usb' | 'hint.play' | 'hint.painting' | 'hint.code' | 'hint.door'
  | 'hint.won';

export function nextHint(s: CrimsonState): HintKey {
  if (s.won) return 'hint.won';
  if (!flag(s, 'pillowLooted')) return 'hint.pillow';
  if (!flag(s, 'bottomDrawerLooted')) return 'hint.bottomDrawer';
  if (!flag(s, 'curtainsOpen')) return 'hint.curtains';
  if (!flag(s, 'sillLooted')) return 'hint.sill';
  if (has(s, 'battery') && has(s, 'flashlight')) return 'hint.combine';
  if (!flag(s, 'cordTaken')) return 'hint.underBed';
  if (!flag(s, 'topDrawerOpen')) return 'hint.topDrawer';
  if (!flag(s, 'cordPlugged')) return 'hint.plug';
  if (!flag(s, 'usbInserted')) return 'hint.usb';
  if (!flag(s, 'clipPlayed')) return 'hint.play';
  if (!flag(s, 'paintingMoved')) return 'hint.painting';
  if (!flag(s, 'safeOpen')) return 'hint.code';
  return 'hint.door';
}

// ── Golden path ────────────────────────────────────────────────────
export type SolveStep =
  | { kind: 'tap'; hotspot: HotspotId }
  | { kind: 'select'; item: ItemId }
  | { kind: 'code'; code: string };

export const SOLUTION: SolveStep[] = [
  { kind: 'tap', hotspot: 'pillow' },          // brass key
  { kind: 'tap', hotspot: 'bottomDrawer' },    // dead flashlight
  { kind: 'tap', hotspot: 'curtains' },        // light
  { kind: 'tap', hotspot: 'sill' },            // battery
  { kind: 'select', item: 'battery' },
  { kind: 'select', item: 'flashlight' },      // combine → lit
  { kind: 'tap', hotspot: 'underBed' },        // power cord (lit flashlight selected)
  { kind: 'select', item: 'brassKey' },
  { kind: 'tap', hotspot: 'topDrawer' },       // USB + note
  { kind: 'select', item: 'powerCord' },
  { kind: 'tap', hotspot: 'projector' },       // plugged
  { kind: 'select', item: 'usbDrive' },
  { kind: 'tap', hotspot: 'projector' },       // inserted
  { kind: 'tap', hotspot: 'projector' },       // clip plays → points at painting
  { kind: 'tap', hotspot: 'painting' },        // safe revealed
  { kind: 'tap', hotspot: 'safe' },            // keypad
  { kind: 'code', code: SAFE_CODE },           // door key
  { kind: 'select', item: 'doorKey' },
  { kind: 'tap', hotspot: 'door' },            // escape!
];

export function applyStep(s: CrimsonState, step: SolveStep): Result {
  if (step.kind === 'tap') return applyTap(s, step.hotspot);
  if (step.kind === 'select') return selectItem(s, step.item);
  return enterCode(s, step.code);
}
