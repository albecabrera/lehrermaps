const CACHE_VERSION = 'lehrermaps-v64';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-v2.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-180x180.png',
  '/assets/logineo-logo.jpg',
  '/assets/icons/esg-logo-overlay.svg',
  '/assets/icons/lehrermaps-mark.svg',
  '/assets/icons/lehrermaps-favicon-16.png',
  '/assets/icons/lehrermaps-favicon-32.png',
  '/assets/icons/lehrermaps-icon-192.png',
  '/assets/icons/lehrermaps-icon-512.png',
  '/assets/icons/lehrermaps-icon-maskable-512.png',
  '/assets/icons/lehrermaps-apple-touch-icon.png',
  '/assets/icons/lehrermaps-v2-favicon-16.png',
  '/assets/icons/lehrermaps-v2-favicon-32.png',
  '/assets/icons/lehrermaps-v2-icon-192.png',
  '/assets/icons/lehrermaps-v2-icon-512.png',
  '/assets/icons/lehrermaps-v2-icon-maskable-512.png',
  '/assets/icons/lehrermaps-v2-apple-touch-icon.png',
  '/assets/icons/safari-pinned-tab.svg',
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(APP_SHELL);

  // Vite emits hashed entry points, so discover the current bundle instead of
  // hard-coding filenames that become stale after every deployment.
  const indexResponse = await fetch('/index.html', { cache: 'no-store' });
  const indexHtml = await indexResponse.text();
  await cacheReferencedAssets(
    cache,
    extractReferencedAssets(indexHtml, new URL('/index.html', self.location.origin)),
  );
}

function extractReferencedAssets(source, baseUrl) {
  const assets = new Set();
  const strings = /["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = strings.exec(source))) {
    const value = match[1];
    if (!/\.(?:js|css)(?:[?#].*)?$/.test(value)) continue;
    let url;
    try {
      url = new URL(value.startsWith('assets/') ? `/${value}` : value, baseUrl);
    } catch {
      continue;
    }
    if (url.origin !== self.location.origin || !url.pathname.startsWith('/assets/')) continue;
    assets.add(`${url.pathname}${url.search}`);
  }
  return assets;
}

async function cacheReferencedAssets(cache, initialAssets) {
  const queue = initialAssets.map((asset) => new URL(asset, self.location.origin));
  const visited = new Set();

  while (queue.length) {
    const assetUrl = queue.shift();
    const cacheKey = assetUrl.href;
    if (visited.has(cacheKey)) continue;
    visited.add(cacheKey);

    const response = await fetch(assetUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to precache ${assetUrl.pathname}`);
    await cache.put(assetUrl, response.clone());

    if (assetUrl.pathname.endsWith('.js')) {
      const source = await response.text();
      for (const referencedAsset of extractReferencedAssets(source, assetUrl)) {
        queue.push(new URL(referencedAsset, self.location.origin));
      }
    }
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
