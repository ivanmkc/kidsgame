import { describe, expect, it } from 'vitest';
import { DRESSUP_DESCRIPTIONS, PUBLIC_SITE, cacheKey, magicDescription, resolvePublicImageUrl } from '../sticker/magic';
import { manifest } from '../../manifest';

describe('sticker AI magic', () => {
  it('describes every manifest.dressup item as a picture-able phrase', () => {
    for (const item of manifest.dressup ?? []) {
      const desc = DRESSUP_DESCRIPTIONS[item];
      expect(desc, `dressup item "${item}" needs a description`).toBeTruthy();
      // A phrase, not just the raw key — must be longer than one word.
      expect(desc.split(/\s+/).length).toBeGreaterThan(1);
    }
  });

  it('falls back to a spaced-out raw name for unknown items', () => {
    expect(magicDescription('mystery_hat')).toBe('mystery hat');
  });

  it('cacheKey buckets very-close drop positions and separates far ones', () => {
    // Bucket width is 1/20 = 5%; within-bucket wobble reuses the cache.
    const a = cacheKey('d-farm', 'crown', 0.501, 0.502);
    const b = cacheKey('d-farm', 'crown', 0.503, 0.504);
    expect(a).toBe(b);
    // A drop 15% away is a different bucket.
    expect(cacheKey('d-farm', 'crown', 0.65, 0.65)).not.toBe(a);
    // Scene / item are part of the key.
    expect(cacheKey('d-farm', 'crown', 0.5, 0.5)).not.toBe(cacheKey('d-farm', 'tiara', 0.5, 0.5));
    expect(cacheKey('d-farm', 'crown', 0.5, 0.5)).not.toBe(cacheKey('d-beach', 'crown', 0.5, 0.5));
  });

  it('rehosts a local /kidsgame/ asset URL against the deployed origin', () => {
    const url = resolvePublicImageUrl(
      { uri: '/kidsgame/assets/assets/game/diff/farm_base.a00d0c143d43ac443722f3e2dadf8d5d.png' },
      'http://localhost:8793/kidsgame/',
    );
    expect(url).toBe(
      `${PUBLIC_SITE}assets/assets/game/diff/farm_base.a00d0c143d43ac443722f3e2dadf8d5d.png`,
    );
  });

  it('leaves an already-public github.io URL alone', () => {
    const same = `${PUBLIC_SITE}assets/x.png`;
    expect(resolvePublicImageUrl({ uri: same }, 'http://localhost:8793/kidsgame/')).toBe(same);
  });

  it('returns null for a source with no uri', () => {
    expect(resolvePublicImageUrl(null, 'http://localhost/')).toBeNull();
  });
});
