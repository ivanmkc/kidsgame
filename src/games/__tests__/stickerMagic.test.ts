import { afterEach, describe, expect, it, vi } from 'vitest';
import { Image } from 'react-native';
import {
  DRESSUP_DESCRIPTIONS,
  MAGIC_ENDPOINT,
  PUBLIC_SITE,
  cacheKey,
  callMagic,
  magicDescription,
  publicUrlReachable,
  resolvePublicImageUrl,
} from '../sticker/magic';
import { manifest } from '../../manifest';

describe('sticker AI magic', () => {
  const originalResolveAssetSource = Image.resolveAssetSource;

  afterEach(() => {
    Image.resolveAssetSource = originalResolveAssetSource;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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
    expect(resolvePublicImageUrl(undefined, 'http://localhost/')).toBeNull();
    expect(resolvePublicImageUrl({ uri: undefined }, 'http://localhost/')).toBeNull();
  });

  it('resolves string sources directly', () => {
    const url = resolvePublicImageUrl(
      '/kidsgame/assets/game/diff/farm_base.png',
      'http://localhost:8793/kidsgame/',
    );
    expect(url).toBe(`${PUBLIC_SITE}assets/game/diff/farm_base.png`);
  });

  it('resolves numeric asset source via Image.resolveAssetSource', () => {
    Image.resolveAssetSource = vi.fn().mockReturnValue({
      uri: '/kidsgame/assets/game/diff/cow.png',
      width: 100,
      height: 100,
      scale: 1,
    });
    const url = resolvePublicImageUrl(42, 'http://localhost:8793/kidsgame/');
    expect(url).toBe(`${PUBLIC_SITE}assets/game/diff/cow.png`);
    expect(Image.resolveAssetSource).toHaveBeenCalledWith(42);
  });

  it('returns null for numeric asset when Image.resolveAssetSource throws', () => {
    Image.resolveAssetSource = vi.fn().mockImplementation(() => {
      throw new Error('asset resolution failure');
    });
    expect(resolvePublicImageUrl(999, 'http://localhost:8793/kidsgame/')).toBeNull();
  });

  it('returns null when Image.resolveAssetSource returns an asset without uri', () => {
    const fakeAsset: Partial<ReturnType<typeof Image.resolveAssetSource>> = {
      width: 100,
      height: 100,
    };
    Image.resolveAssetSource = vi.fn().mockReturnValue(
      fakeAsset as ReturnType<typeof Image.resolveAssetSource>,
    );
    expect(resolvePublicImageUrl(777, 'http://localhost:8793/kidsgame/')).toBeNull();
  });

  it('preserves URL on a third-party github.io deployment origin', () => {
    const url = resolvePublicImageUrl(
      '/kidsgame/assets/custom.png',
      'https://alice.github.io/kidsgame/',
    );
    expect(url).toBe('https://alice.github.io/kidsgame/assets/custom.png');
  });

  it('falls back to window location when origin is omitted in web environment', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/kidsgame/',
      },
    });
    const url = resolvePublicImageUrl('/kidsgame/assets/preview.png');
    expect(url).toBe(`${PUBLIC_SITE}assets/preview.png`);
  });

  it('falls back to placeholder origin when origin and window are undefined', () => {
    const url = resolvePublicImageUrl('/kidsgame/assets/node-env.png');
    expect(url).toBe(`${PUBLIC_SITE}assets/node-env.png`);
  });

  it('handles unparseable URL raw input as a path fragment', () => {
    const url = resolvePublicImageUrl('http://:invalid', 'http://localhost/');
    expect(url).toBe(`${PUBLIC_SITE}http://:invalid`);
  });

  it('calls magic endpoint and returns parsed response on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, image_b64: 'data:image/png;base64,abc' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const controller = new AbortController();

    const result = await callMagic(
      {
        imageUrl: 'https://ivanmkc.github.io/kidsgame/assets/base.png',
        x: 0.45,
        y: 0.6,
        item: 'party_hat',
      },
      { signal: controller.signal },
    );

    expect(result).toEqual({ ok: true, image_b64: 'data:image/png;base64,abc' });
    expect(fetchSpy).toHaveBeenCalledWith(
      MAGIC_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: 'https://ivanmkc.github.io/kidsgame/assets/base.png',
          x: 0.45,
          y: 0.6,
          item: 'a pointy party hat with polka dots',
        }),
        signal: controller.signal,
      }),
    );
  });

  it('returns http error reason on non-200 responses from magic endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );

    const result = await callMagic({
      imageUrl: 'https://ivanmkc.github.io/kidsgame/assets/base.png',
      x: 0.1,
      y: 0.2,
      item: 'unknown_item',
    });

    expect(result).toEqual({ ok: false, reason: 'http_500' });
  });

  it('handles aborted requests to magic endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The user aborted a request.', 'AbortError'),
    );

    const result = await callMagic({
      imageUrl: 'https://ivanmkc.github.io/kidsgame/assets/base.png',
      x: 0.1,
      y: 0.2,
      item: 'crown',
    });

    expect(result).toEqual({ ok: false, reason: 'aborted' });
  });

  it('handles network failures to magic endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection reset'));

    const result = await callMagic({
      imageUrl: 'https://ivanmkc.github.io/kidsgame/assets/base.png',
      x: 0.1,
      y: 0.2,
      item: 'crown',
    });

    expect(result).toEqual({ ok: false, reason: 'network' });
  });

  it('checks public url reachability via HEAD request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const controller = new AbortController();

    const reachable = await publicUrlReachable(
      'https://ivanmkc.github.io/kidsgame/assets/base.png',
      controller.signal,
    );

    expect(reachable).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://ivanmkc.github.io/kidsgame/assets/base.png',
      { method: 'HEAD', signal: controller.signal },
    );
  });

  it('returns false when public url check returns non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    const reachable = await publicUrlReachable(
      'https://ivanmkc.github.io/kidsgame/assets/missing.png',
    );

    expect(reachable).toBe(false);
  });

  it('returns false when public url check throws a network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const reachable = await publicUrlReachable(
      'https://ivanmkc.github.io/kidsgame/assets/error.png',
    );

    expect(reachable).toBe(false);
  });
});
