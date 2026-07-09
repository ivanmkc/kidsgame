// Cache-first for immutable app assets. gh-pages serves max-age=600, so
// without this every return visit re-downloads scene art and voice clips
// (Ivan: "images are redownloading when i return"). Hashed bundles and
// content assets are safe to cache forever; index.html and version.json
// stay network-first so the stale-bundle self-heal keeps working.
const CACHE = 'kgb-assets-v1';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const p = new URL(e.request.url).pathname;
  const cacheable =
    /\/_expo\/static\//.test(p) ||
    /\/(assets|voice)\//.test(p) ||
    /\.(png|jpg|jpeg|webp|mp3|ttf|ico)$/.test(p);
  if (!cacheable || /version\.json|index\.html/.test(p)) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    })
  );
});
