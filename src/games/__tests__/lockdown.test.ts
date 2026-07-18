import { describe, expect, it, beforeEach, vi } from 'vitest';
import { effectiveLang, visibleCards, GATE_WORDS, randomGateWord } from '../../lockdown';

const mockStorage = new Map<string, string>();

vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => { mockStorage.set(k, v); },
    removeItem: (k: string) => { mockStorage.delete(k); },
  },
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
