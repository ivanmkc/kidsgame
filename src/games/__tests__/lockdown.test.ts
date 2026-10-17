import React from 'react';
import { renderToString } from 'react-dom/server';
import { Platform } from 'react-native';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  useLockdown,
  effectiveLang,
  visibleCards,
  GATE_WORDS,
  randomGateWord,
} from '../../lockdown';

const mockStorage = new Map<string, string>();

vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => { mockStorage.set(k, v); },
    removeItem: (k: string) => { mockStorage.delete(k); },
  },
});

beforeEach(() => {
  mockStorage.clear();
});


describe('effectiveLang', () => {
  it('returns current lang when not hidden', () => {
    expect(effectiveLang('ja', [])).toBe('ja');
    expect(effectiveLang('en', ['ja', 'cmn'])).toBe('en');
  });

  it('returns first allowed lang when current is hidden', () => {
    expect(effectiveLang('ja', ['ja'])).toBe('en');
    expect(effectiveLang('en', ['en'])).toBe('ja');
    expect(effectiveLang('cmn', ['en', 'cmn'])).toBe('ja');
  });

  it('returns first allowed when multiple are hidden', () => {
    expect(effectiveLang('yue', ['en', 'ja', 'yue'])).toBe('cmn');
  });

  it('falls back to en if all are hidden (safety)', () => {
    expect(effectiveLang('ja', ['en', 'ja', 'cmn', 'yue'])).toBe('en');
  });
});

describe('visibleCards', () => {
  const cards = [
    { route: 'spotit', color: 'red' },
    { route: 'diff', color: 'teal' },
    { route: 'story', color: 'purple' },
    { route: 'memory', color: 'green' },
  ];

  it('returns all cards when no games hidden', () => {
    expect(visibleCards(cards, [])).toEqual(cards);
  });

  it('filters hidden games', () => {
    const visible = visibleCards(cards, ['story']);
    expect(visible).toHaveLength(3);
    expect(visible.find((c) => c.route === 'story')).toBeUndefined();
  });

  it('filters multiple hidden games', () => {
    const visible = visibleCards(cards, ['story', 'diff']);
    expect(visible).toHaveLength(2);
    expect(visible.map((c) => c.route)).toEqual(['spotit', 'memory']);
  });

  it('handles hiding all games', () => {
    const visible = visibleCards(cards, ['spotit', 'diff', 'story', 'memory']);
    expect(visible).toHaveLength(0);
  });

  it('ignores unknown game ids', () => {
    const visible = visibleCards(cards, ['nonexistent']);
    expect(visible).toEqual(cards);
  });
});

describe('randomGateWord', () => {
  it('returns a word from the pool', () => {
    for (let i = 0; i < 50; i++) {
      expect(GATE_WORDS).toContain(randomGateWord());
    }
  });
});

describe('useLockdown', () => {
  function getHook() {
    let hook!: ReturnType<typeof useLockdown>;
    function Harness() {
      hook = useLockdown();
      return null;
    }
    renderToString(React.createElement(Harness));
    return hook;
  }

  it('provides initial state', () => {
    const hook = getHook();
    expect(hook.state).toEqual({ hiddenGames: [], hiddenLangs: [] });
    expect(hook.isActive).toBe(false);
    expect(hook.isGameHidden('balloon')).toBe(false);
    expect(hook.isLangHidden('ja')).toBe(false);
    expect(hook.allowedLangs).toHaveLength(4);
  });

  it('updates hidden games with setHiddenGames', () => {
    const hook = getHook();
    hook.setHiddenGames(['diff', 'story']);
    expect(mockStorage.get('kgb.lockdown.v1')).toBe(
      JSON.stringify({ hiddenGames: ['diff', 'story'], hiddenLangs: [] }),
    );
  });

  it('updates hidden langs with setHiddenLangs', () => {
    const hook = getHook();
    hook.setHiddenLangs(['ja', 'cmn']);
    expect(mockStorage.get('kgb.lockdown.v1')).toBe(
      JSON.stringify({ hiddenGames: [], hiddenLangs: ['ja', 'cmn'] }),
    );
  });

  it('toggles games on and off', () => {
    const hook = getHook();
    hook.toggleGame('story');
    expect(mockStorage.get('kgb.lockdown.v1')).toBe(
      JSON.stringify({ hiddenGames: ['story'], hiddenLangs: [] }),
    );
    hook.toggleGame('story');
    expect(mockStorage.get('kgb.lockdown.v1')).toBe(
      JSON.stringify({ hiddenGames: [], hiddenLangs: [] }),
    );
  });

  it('toggles langs on and off and forbids hiding all langs', () => {
    const hook = getHook();
    expect(hook.toggleLang('ja')).toBe(true);
    expect(mockStorage.get('kgb.lockdown.v1')).toBe(
      JSON.stringify({ hiddenGames: [], hiddenLangs: ['ja'] }),
    );
    expect(hook.toggleLang('cmn')).toBe(true);
    expect(hook.toggleLang('yue')).toBe(true);
    // Hiding the last remaining language should be rejected
    expect(hook.toggleLang('en')).toBe(false);
    // Unhiding ja should work
    expect(hook.toggleLang('ja')).toBe(true);
  });

  it('handles corrupted JSON in storage gracefully', () => {
    mockStorage.set('kgb.lockdown.v1', '{corrupt json');
    const hook = getHook();
    hook.toggleGame('story');
    expect(mockStorage.get('kgb.lockdown.v1')).toBe(
      JSON.stringify({ hiddenGames: ['story'], hiddenLangs: [] }),
    );
  });

  it('handles malformed shape in storage gracefully', () => {
    mockStorage.set(
      'kgb.lockdown.v1',
      JSON.stringify({ hiddenGames: 'not-an-array', hiddenLangs: 123 }),
    );
    const hook = getHook();
    hook.toggleGame('story');
    expect(mockStorage.get('kgb.lockdown.v1')).toBe(
      JSON.stringify({ hiddenGames: ['story'], hiddenLangs: [] }),
    );
  });

  it('handles storage write failures silently', () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    try {
      const hook = getHook();
      expect(() => hook.toggleGame('story')).not.toThrow();
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });

  it('does nothing when Platform.OS is not web', () => {
    const origOS = Platform.OS;
    Platform.OS = 'ios';
    try {
      const hook = getHook();
      hook.setHiddenGames(['diff']);
      expect(mockStorage.get('kgb.lockdown.v1')).toBeUndefined();
    } finally {
      Platform.OS = origOS;
    }
  });
});


