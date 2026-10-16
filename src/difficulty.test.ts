import { describe, it, expect } from 'vitest';
import { nextSceneId } from './difficulty';

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
});
