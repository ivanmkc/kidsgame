// AI sticker magic — client side of the /wear inpainting service. Kids
// drop a dressup sticker on the scene, tap ✨, and the CHARACTER inside
// the scene actually WEARS it (photorealistic composite from the model).
//
// The service can fetch any public https image. When the game runs on
// the deployed origin (ivanmkc.github.io) that's the origin's own path;
// when the game runs anywhere else (local dev, feature-branch preview,
// Cloud Run staging) the browser can reach its own hashed asset paths
// but the model on Google infra cannot. Because Metro hashes assets by
// CONTENT, the same file has the same hashed filename in every build —
// so we can safely rehost the asset path against the deployed site.

import { Image, Platform } from 'react-native';

export const MAGIC_ENDPOINT =
  'https://kgb-magic-692247227248.us-central1.run.app/wear';

export const PUBLIC_SITE = 'https://ivanmkc.github.io/kidsgame/';

// Every dressup item in the manifest maps to a concrete visual phrase.
// The model responds much better to a picture-able description than
// "wings_butterfly". Fallback for unknown keys is the raw name with
// underscores stripped — the ✨ button only appears for manifest.dressup
// entries, so this is defence-in-depth, not the common path.
export const DRESSUP_DESCRIPTIONS: Record<string, string> = {
  dress_pink: 'a pretty pink princess dress',
  dress_rainbow: 'a rainbow-striped twirly party dress',
  dress_star: 'a midnight-blue dress covered in tiny gold stars',
  dress_flower: 'a spring dress covered in daisy flowers',
  dress_snow: 'a sparkly white snowflake dress',
  dress_blue: 'a flowing blue princess dress',
  tutu: 'a pink ballet tutu',
  crown: 'a golden royal crown',
  tiara: 'a sparkly silver tiara',
  wizard_hat: 'a pointy purple wizard hat with stars',
  sun_hat: 'a wide-brimmed straw sun hat',
  wings_fairy: 'delicate translucent fairy wings on the back',
  wings_butterfly: 'colorful monarch butterfly wings on the back',
  cape: 'a flowing red superhero cape',
  sunglasses: 'cool dark sunglasses',
  bowtie: 'a smart red bowtie',
  necklace: 'a pearl necklace',
  boots: 'sturdy brown adventure boots',
  wand: 'a golden magic wand held in one hand',
  umbrella: 'a bright rainbow-striped umbrella held overhead',
};

export function magicDescription(item: string): string {
  return DRESSUP_DESCRIPTIONS[item] ?? item.replace(/_/g, ' ');
}

// Same scene + same item + roughly the same drop position → same
// magicked backdrop. Bucketed at 1/20 of the stage (~5%) so a kid
// tap-placing "close enough" reuses the previous result instantly
// instead of paying another 30s of inference.
export function cacheKey(
  sceneId: string,
  item: string,
  x: number,
  y: number,
): string {
  return `${sceneId}|${item}|${Math.round(x * 20)}x${Math.round(y * 20)}`;
}

type ImageSource = number | string | { uri?: string } | null | undefined;

function assetUri(source: ImageSource): string | null {
  if (source == null) return null;
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && typeof source.uri === 'string') return source.uri;
  try {
    const r = Image.resolveAssetSource(source as number);
    return r?.uri ?? null;
  } catch {
    return null;
  }
}

// Return a URL the SERVER can fetch, or null if we can't build one.
// Rules:
//   - If we're already on ivanmkc.github.io (or any *.github.io origin),
//     the asset's own absolute URL is publicly reachable.
//   - Otherwise, take the asset path suffix (…/assets/…hashed.png) and
//     rehost it against PUBLIC_SITE. Metro's hashes are content-addressed,
//     so the same file has the same filename on the live site.
//   - Exported for testing.
export function resolvePublicImageUrl(
  source: ImageSource,
  origin?: string,
): string | null {
  const raw = assetUri(source);
  if (!raw) return null;
  const here = origin ?? (Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname
    : '');
  const publicOrigin = new URL(PUBLIC_SITE).origin;
  let path = raw;
  try {
    const u = new URL(raw, here || 'http://placeholder/');
    if (u.origin === publicOrigin) return u.href;
    if (u.origin && here && new URL(here).origin.endsWith('.github.io')) return u.href;
    path = u.pathname;
  } catch {
    // raw wasn't parseable — treat as a path fragment
  }
  // Drop any leading "/" and (redundant) "kidsgame/" so we don't double-prefix.
  const stripped = path.replace(/^\/+/, '').replace(/^kidsgame\/+/, '');
  return PUBLIC_SITE + stripped;
}

export interface WearResponse {
  ok: boolean;
  image_b64?: string;
  reason?: string;
  meta?: unknown;
}

// Fires POST /wear. AbortSignal supports the 90s outer timeout in the
// caller so we don't accumulate zombie requests when a kid changes scenes.
export async function callMagic(
  args: { imageUrl: string; x: number; y: number; item: string },
  init: { signal?: AbortSignal } = {},
): Promise<WearResponse> {
  try {
    const res = await fetch(MAGIC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: args.imageUrl,
        x: args.x,
        y: args.y,
        item: magicDescription(args.item),
      }),
      signal: init.signal,
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return (await res.json()) as WearResponse;
  } catch (err) {
    const reason = (err as { name?: string; message?: string })?.name === 'AbortError' ? 'aborted' : 'network';
    return { ok: false, reason };
  }
}

// Cheap "is the public URL actually fetchable" check. We use this to
// decide whether to SHOW the ✨ button at all — if the server would
// 404 on the URL, better to hide the affordance than let the kid tap
// and watch it fail.
export async function publicUrlReachable(
  url: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', signal });
    return r.ok;
  } catch {
    return false;
  }
}
