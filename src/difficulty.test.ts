import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import {
  byLevel,
  DIFFICULTIES,
  difficultyOf,
  FILTERS,
  inFilter,
  loadFilter,
  nextFilter,
  nextSceneId,
  saveFilter,
  settingsFor,
} from './difficulty';

describe('nextSceneId', () => {
  it('throws an Error when the pool is empty', () => {
    expect(() => nextSceneId([], [], 'x')).toThrowError('nextSceneId called with empty pool');
  });

  it('wraps around to the first item', () => {
    const scenes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(nextSceneId(scenes, scenes, 'a')).toBe('b');
    expect(nextSceneId(scenes, scenes, 'b')).toBe('c');
    expect(nextSceneId(scenes, scenes, 'c')).toBe('a');
  });

  it('steps through scenes in easy -> medium -> hard order', () => {
    const scenes = [
      { id: 'h', level: 'hard' as const },
      { id: 'e', level: 'easy' as const },
      { id: 'm' },
    ];
    expect(nextSceneId(scenes, scenes, 'e')).toBe('m');
    expect(nextSceneId(scenes, scenes, 'm')).toBe('h');
    expect(nextSceneId(scenes, scenes, 'h')).toBe('e');
  });

  it('sorts pool by level regardless of initial array order', () => {
    const scenes = [
      { id: 'h', level: 'hard' as const },
      { id: 'm' },
      { id: 'e', level: 'easy' as const },
    ];
    expect(nextSceneId(scenes, scenes, 'e')).toBe('m');
    expect(nextSceneId(scenes, scenes, 'm')).toBe('h');
    expect(nextSceneId(scenes, scenes, 'h')).toBe('e');
  });

  it('falls back to all scenes when current scene is not in visible', () => {
    const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const visible = [{ id: 'c' }];
    expect(nextSceneId(all, visible, 'a')).toBe('b');
  });

  it('uses visible scenes when current scene is visible', () => {
    const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const visible = [{ id: 'a' }, { id: 'c' }];
    expect(nextSceneId(all, visible, 'a')).toBe('c');
  });
});

describe('byLevel', () => {
  it('sorts scenes easy -> medium -> hard, treating unlevelled scenes as medium', () => {
    const scenes = [
      { id: 'h', level: 'hard' as const },
      { id: 'e', level: 'easy' as const },
      { id: 'm' },
    ];
    expect(byLevel(scenes)).toEqual([
      { id: 'e', level: 'easy' },
      { id: 'm' },
      { id: 'h', level: 'hard' },
    ]);
  });
});

describe('nextFilter', () => {
  it('cycles all -> easy -> medium -> hard -> all', () => {
    expect(nextFilter('all')).toBe('easy');
    expect(nextFilter('easy')).toBe('medium');
    expect(nextFilter('medium')).toBe('hard');
    expect(nextFilter('hard')).toBe('all');
  });
});

describe('FILTERS', () => {
  it('defines an emoji and no label for each filter', () => {
    for (const f of FILTERS) {
      expect(f.emoji).toBeDefined();
      expect('label' in f).toBe(false);
    }
  });
});

describe('inFilter', () => {
  it('always matches when filter is all', () => {
    expect(inFilter('easy', 'all')).toBe(true);
    expect(inFilter('hard', 'all')).toBe(true);
    expect(inFilter(undefined, 'all')).toBe(true);
  });

  it('treats unlevelled scenes as always visible', () => {
    expect(inFilter(undefined, 'hard')).toBe(true);
    expect(inFilter(undefined, 'easy')).toBe(true);
  });

  it('matches matching difficulty and rejects non-matching', () => {
    expect(inFilter('easy', 'easy')).toBe(true);
    expect(inFilter('easy', 'hard')).toBe(false);
  });
});

describe('difficultyOf', () => {
  it('maps all to medium and preserves concrete difficulties', () => {
    expect(difficultyOf('all')).toBe('medium');
    expect(difficultyOf('easy')).toBe('easy');
    expect(difficultyOf('medium')).toBe('medium');
    expect(difficultyOf('hard')).toBe('hard');
  });
});

describe('settingsFor', () => {
  it('returns medium settings for undefined or concrete settings otherwise', () => {
    expect(settingsFor(undefined)).toBe(DIFFICULTIES.medium);
    expect(settingsFor('easy')).toBe(DIFFICULTIES.easy);
    expect(settingsFor('hard')).toBe(DIFFICULTIES.hard);
  });
});

describe('DIFFICULTIES', () => {
  it('does not expose dead label or emoji strings', () => {
    for (const s of Object.values(DIFFICULTIES)) {
      expect('label' in s).toBe(false);
      expect('emoji' in s).toBe(false);
    }
  });

  it('scaffolds hiddenDraw progression from easy to hard', () => {
    expect(DIFFICULTIES.easy.hiddenDraw).toBe(5);
    expect(DIFFICULTIES.medium.hiddenDraw).toBe(6);
    expect(DIFFICULTIES.hard.hiddenDraw).toBe(8);
    expect(DIFFICULTIES.easy.hiddenDraw).toBeLessThan(DIFFICULTIES.medium.hiddenDraw);
    expect(DIFFICULTIES.medium.hiddenDraw).toBeLessThan(DIFFICULTIES.hard.hiddenDraw);
  });

  it('scaffolds hint availability for hard difficulty in hidden scenes', () => {
    expect(DIFFICULTIES.easy.hiddenHintSecs).toBe(15);
    expect(DIFFICULTIES.medium.hiddenHintSecs).toBe(15);
    expect(DIFFICULTIES.hard.hiddenHintSecs).toBe(Infinity);
  });
});

describe('loadFilter and saveFilter', () => {
  const KEY = 'kgb.filter.v1';
  const LEGACY_KEY = 'kgb.difficulty.v1';
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    mockStorage.clear();
    (Platform as { OS: string }).OS = 'web';
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => mockStorage.get(k) ?? null,
        setItem: (k: string, v: string) => { mockStorage.set(k, v); },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    (Platform as { OS: string }).OS = 'web';
  });

  it('loads valid filter from storage', () => {
    mockStorage.set(KEY, 'hard');
    expect(loadFilter()).toBe('hard');
  });

  it('reads legacy key when current key is missing', () => {
    mockStorage.set(LEGACY_KEY, 'easy');
    expect(loadFilter()).toBe('easy');
  });

  it('prefers current key over legacy key', () => {
    mockStorage.set(KEY, 'hard');
    mockStorage.set(LEGACY_KEY, 'easy');
    expect(loadFilter()).toBe('hard');
  });

  it('returns all when keys are missing or contain junk', () => {
    expect(loadFilter()).toBe('all');
    mockStorage.set(KEY, 'junk');
    expect(loadFilter()).toBe('all');
    mockStorage.delete(KEY);
    mockStorage.set(LEGACY_KEY, 'junk');
    expect(loadFilter()).toBe('all');
  });

  it('returns all when Platform.OS is not web', () => {
    mockStorage.set(KEY, 'hard');
    (Platform as { OS: string }).OS = 'ios';
    expect(loadFilter()).toBe('all');
  });

  it('returns all when window is undefined', () => {
    vi.unstubAllGlobals();
    expect(loadFilter()).toBe('all');
  });

  it('returns all when window.localStorage is undefined', () => {
    vi.stubGlobal('window', {});
    expect(loadFilter()).toBe('all');
  });

  it('returns all when localStorage.getItem throws SecurityError', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {},
      },
    });
    expect(loadFilter()).toBe('all');
  });

  it('returns all when legacy localStorage.getItem throws SecurityError', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => {
          if (k === LEGACY_KEY) throw new Error('SecurityError');
          return null;
        },
        setItem: () => {},
      },
    });
    expect(loadFilter()).toBe('all');
  });

  it('returns all when window.localStorage access throws SecurityError', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('SecurityError');
      },
    });
    expect(loadFilter()).toBe('all');
  });

  it('saves filter to storage key', () => {
    saveFilter('hard');
    expect(mockStorage.get(KEY)).toBe('hard');
    expect(loadFilter()).toBe('hard');
  });

  it('handles saveFilter storage write errors gracefully', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceeded'); },
      },
    });
    expect(() => saveFilter('easy')).not.toThrow();
  });
});
