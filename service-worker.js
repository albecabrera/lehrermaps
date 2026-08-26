const CACHE_VERSION = 'lehrermaps-v8';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable.svg',
  '/assets/icons/apple-touch-icon.png',
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(APP_SHELL);

  // Vite emits hashed entry points, so discover the current bundle instead of
  // hard-coding filenames that become stale after every deployment.
  const indexResponse = await fetch('/index.html', { cache: 'no-store' });
  const indexHtml = await indexResponse.text();
  const assets = [...indexHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map((match) => match[1]);
  await cache.addAll(assets);

  // Cache code-split chunks referenced by the entry bundle as well.
  for (const asset of assets.filter((url) => url.endsWith('.js'))) {
    const response = await fetch(asset, { cache: 'no-store' });
    const source = await response.text();
    const chunks = [...source.matchAll(/["'](\/assets\/[^"']+\.js)["']/g)]
      .map((match) => match[1]);
    await cache.addAll(chunks);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Stale-while-revalidate: sofort aus dem Cache antworten, aber im
  // Hintergrund IMMER das Netz fragen und den Cache aktualisieren.
  // Cache-first ohne Revalidierung klebte Geräte dauerhaft an alten
  // Bundles fest — Updates kamen ohne manuellen Versions-Bump nie an.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
