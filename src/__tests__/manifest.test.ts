import { describe, test, expect, vi, afterEach } from 'vitest';
import { pickScene, baseImage } from '../manifest';

describe('pickScene', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('picks a scene randomly based on Math.random', () => {
    const scenes = ['a', 'b', 'c'];
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 * 3 = 1.5 -> floor = 1 ('b')

    const result = pickScene(scenes);
    expect(result).toEqual({ scene: 'b', index: 1 });
  });

  test('avoids avoidIndex by picking the next index', () => {
    const scenes = ['a', 'b', 'c'];
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // wants index 1

    const result = pickScene(scenes, 1);
    // it was 1, avoiding 1 -> (1 + 1) % 3 = 2
    expect(result).toEqual({ scene: 'c', index: 2 });
  });

  test('wraps around to 0 when avoiding the last index', () => {
    const scenes = ['a', 'b', 'c'];
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // wants index 2

    const result = pickScene(scenes, 2);
    // it was 2, avoiding 2 -> (2 + 1) % 3 = 0
    expect(result).toEqual({ scene: 'a', index: 0 });
  });

  test('does not avoid when there is only one scene', () => {
    const scenes = ['a'];
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // wants index 0

    const result = pickScene(scenes, 0);
    expect(result).toEqual({ scene: 'a', index: 0 });
  });
});

describe('baseImage', () => {
  test('returns image when available', () => {
    expect(baseImage({ id: '1', name: '1', w: 100, h: 100, image: 'foo.png' })).toBe('foo.png');
  });

  test('falls back to imageA when image is not available', () => {
    expect(baseImage({ id: '1', name: '1', w: 100, h: 100, imageA: 'bar.png' })).toBe('bar.png');
  });
});
