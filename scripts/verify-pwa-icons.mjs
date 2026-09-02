import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFile(resolve(root, path), 'utf8');
const requiredAssets = [
  'client/public/assets/icons/favicon.svg',
  'client/public/assets/icons/favicon-16.png',
  'client/public/assets/icons/favicon-32.png',
  'client/public/assets/icons/apple-touch-icon.png',
  'client/public/assets/icons/icon-192.png',
  'client/public/assets/icons/icon-512.png',
  'client/public/assets/icons/icon-maskable-512.png',
  'client/public/assets/icons/safari-pinned-tab.svg',
];

const [html, manifest, serviceWorker] = await Promise.all([
  read('client/index.html'),
  read('client/public/manifest.json'),
  read('client/public/service-worker.js'),
]);
const parsedManifest = JSON.parse(manifest);

for (const asset of requiredAssets) {
  await stat(resolve(root, asset));
}

assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/assets\/icons\/favicon\.svg"/);
assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/assets\/icons\/favicon-32\.png"/);
assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/assets\/icons\/apple-touch-icon\.png"/);
assert.match(html, /rel="mask-icon" href="\/assets\/icons\/safari-pinned-tab\.svg" color="#173B66"/);
assert.equal(parsedManifest.icons.some((icon) => icon.src === '/assets/icons/icon-maskable-512.png' && icon.purpose === 'maskable'), true);
assert.match(serviceWorker, /const CACHE_VERSION = 'lehrermaps-v16';/);
for (const asset of ['/assets/icons/favicon.svg', '/assets/icons/icon-maskable-512.png', '/assets/icons/safari-pinned-tab.svg']) {
  assert.match(serviceWorker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

console.log('PWA icon declarations and assets verified.');
