// @vitest-environment happy-dom
import React from 'react';
import { render } from '@testing-library/react';
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
import { LangContext } from '../../components/GameShell';
import { LockdownSettings } from '../../components/LockdownSettings';
import {
  ALL_MENU_CARDS,
  ESCAPE_SHIPPED,
  buildGameSections,
  countHidden,
} from '../../menuCards';
import { t } from '../../i18n';

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
    render(React.createElement(Harness));
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

  it('handles storage write failures silently and keeps state in memory', () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    try {
      const hook = getHook();
      expect(() => hook.toggleGame('story')).not.toThrow();
      expect(getHook().state.hiddenGames).toEqual(['story']);
    } finally {
      window.localStorage.setItem = originalSetItem;
      getHook().setHiddenGames([]);
    }
  });

  it('falls back to memory when localStorage access throws SecurityError', () => {
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.getItem = () => {
      throw new Error('SecurityError');
    };
    window.localStorage.setItem = () => {
      throw new Error('SecurityError');
    };
    try {
      const hook = getHook();
      expect(hook.state).toEqual({ hiddenGames: [], hiddenLangs: [] });
      hook.toggleGame('diff');
      expect(getHook().state.hiddenGames).toEqual(['diff']);
      expect(getHook().isGameHidden('diff')).toBe(true);
    } finally {
      window.localStorage.getItem = originalGetItem;
      window.localStorage.setItem = originalSetItem;
      getHook().setHiddenGames([]);
    }
  });

  it('persists state in memory without touching localStorage when Platform.OS is not web', () => {
    const origOS = Platform.OS;
    Platform.OS = 'ios';
    try {
      const hook = getHook();
      expect(hook.state).toEqual({ hiddenGames: [], hiddenLangs: [] });
      hook.setHiddenGames(['diff']);
      expect(mockStorage.get('kgb.lockdown.v1')).toBeUndefined();
      expect(getHook().state.hiddenGames).toEqual(['diff']);
      expect(getHook().isGameHidden('diff')).toBe(true);

      hook.toggleGame('story');
      expect(getHook().state.hiddenGames).toEqual(['diff', 'story']);

      hook.toggleGame('diff');
      expect(getHook().state.hiddenGames).toEqual(['story']);

      expect(hook.toggleLang('ja')).toBe(true);
      expect(getHook().state.hiddenLangs).toEqual(['ja']);
      expect(getHook().isLangHidden('ja')).toBe(true);
    } finally {
      getHook().setHiddenGames([]);
      getHook().setHiddenLangs([]);
      Platform.OS = origOS;
    }
  });
});

describe('buildGameSections', () => {
  it('every card has a toggle', () => {
    const sections = buildGameSections('en');
    const toggleIds = new Set(sections.flatMap((s) => s.games.map((g) => g.id)));
    for (const card of ALL_MENU_CARDS) {
      expect(toggleIds.has(card.route)).toBe(true);
    }
  });

  it('every toggle has a card', () => {
    const sections = buildGameSections('en');
    const cardRoutes = new Set(ALL_MENU_CARDS.map((c) => c.route));
    for (const section of sections) {
      for (const game of section.games) {
        expect(cardRoutes.has(game.id)).toBe(true);
      }
    }
  });

  it('excludes hidden Car Mode card and includes live cards like Bingo', () => {
    const sections = buildGameSections('en');
    const toggleIds = new Set(sections.flatMap((s) => s.games.map((g) => g.id)));
    expect(toggleIds.has('carmode')).toBe(false);
    expect(toggleIds.has('bingo')).toBe(true);
    expect(toggleIds.has('escape')).toBe(ESCAPE_SHIPPED);
  });

  it('derives game labels via t() and supports active language', () => {
    const enSections = buildGameSections('en');
    const jaSections = buildGameSections('ja');

    const enBingo = enSections.flatMap((s) => s.games).find((g) => g.id === 'bingo');
    expect(enBingo?.label).toBe(t('en', 'card.bingo.title'));

    const jaBingo = jaSections.flatMap((s) => s.games).find((g) => g.id === 'bingo');
    expect(jaBingo?.label).toBe(t('ja', 'card.bingo.title'));
  });
});

describe('countHidden', () => {
  it('counts active hidden games and languages', () => {
    expect(countHidden([], [])).toBe(0);
    expect(countHidden(['spotit'], [])).toBe(1);
    expect(countHidden(['spotit', 'bingo'], ['ja'])).toBe(3);
  });

  it('ignores stale game ids such as carmode so they do not inflate the hidden count', () => {
    expect(countHidden(['carmode'], [])).toBe(0);
    expect(countHidden(['carmode', 'bingo'], [])).toBe(1);
    expect(countHidden(['carmode', 'diff'], ['yue'])).toBe(2);
    expect(countHidden(['nonexistent'], [])).toBe(0);
  });

  it('ignores invalid language ids', () => {
    expect(countHidden([], ['invalid-lang'])).toBe(0);
  });
});

describe('LockdownSettings', () => {
  it('renders parental controls overlay with active toggles', () => {
    const html = renderToString(
      React.createElement(LockdownSettings, {
        hiddenGames: [],
        hiddenLangs: [],
        onToggleGame: vi.fn(),
        onToggleLang: vi.fn(),
        onDone: vi.fn(),
      }),
    );
    expect(html).toContain('Parental Controls');
    expect(html).toContain(t('en', 'card.bingo.title'));
    expect(html).toContain('data-testid="lock-game-bingo"');
    expect(html).not.toContain('data-testid="lock-game-carmode"');
    if (ESCAPE_SHIPPED) {
      expect(html).toContain('data-testid="lock-game-escape"');
      expect(html).toContain('Little Escapes');
    }
    expect(html).toContain('Done');
    expect(html).not.toContain('(0 hidden)');
  });

  it('displays count only for active toggles when items are hidden', () => {
    const html = renderToString(
      React.createElement(LockdownSettings, {
        hiddenGames: ['bingo'],
        hiddenLangs: ['ja'],
        onToggleGame: vi.fn(),
        onToggleLang: vi.fn(),
        onDone: vi.fn(),
      }),
    );
    expect(html).toContain('Done');
    expect(html).toContain('(2 hidden)');
  });

  it('does not count stale carmode id in Done button hidden count', () => {
    const html = renderToString(
      React.createElement(LockdownSettings, {
        hiddenGames: ['carmode'],
        hiddenLangs: [],
        onToggleGame: vi.fn(),
        onToggleLang: vi.fn(),
        onDone: vi.fn(),
      }),
    );
    expect(html).toContain('Done');
    expect(html).not.toContain('hidden)');
  });

  it('renders labels using language provided by LangContext', () => {
    const jaTitle = t('ja', 'card.bingo.title');
    const html = renderToString(
      React.createElement(
        LangContext.Provider,
        { value: { lang: 'ja', onCycle: vi.fn() } },
        React.createElement(LockdownSettings, {
          hiddenGames: [],
          hiddenLangs: [],
          onToggleGame: vi.fn(),
          onToggleLang: vi.fn(),
          onDone: vi.fn(),
        }),
      ),
    );
    expect(html).toContain(jaTitle);
  });
});


