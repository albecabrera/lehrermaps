import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const readText = (path) => readFile(resolve(root, path), 'utf8');
const readBinary = (path) => readFile(resolve(root, path));
const publicIcons = 'client/public/assets/icons';
const liveIcons = 'assets/icons';

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const rasterFamilies = [
  { names: ['favicon-16.png', 'lehrermaps-favicon-16.png', 'lehrermaps-v2-favicon-16.png'], size: 16 },
  { names: ['favicon-32.png', 'lehrermaps-favicon-32.png', 'lehrermaps-v2-favicon-32.png'], size: 32 },
  { names: ['apple-touch-icon.png', 'lehrermaps-apple-touch-icon.png', 'lehrermaps-v2-apple-touch-icon.png'], size: 180 },
  { names: ['icon-192.png', 'lehrermaps-icon-192.png', 'lehrermaps-v2-icon-192.png'], size: 192 },
  { names: ['icon-512.png', 'lehrermaps-icon-512.png', 'lehrermaps-v2-icon-512.png'], size: 512 },
  { names: ['icon-maskable-512.png', 'lehrermaps-icon-maskable-512.png', 'lehrermaps-v2-icon-maskable-512.png'], size: 512 },
];

for (const family of rasterFamilies) {
  const buffers = [];
  for (const name of family.names) {
    for (const dir of [publicIcons, liveIcons]) {
      const buffer = await readBinary(`${dir}/${name}`);
      assert.deepEqual(pngDimensions(buffer), [family.size, family.size], `${dir}/${name}`);
      buffers.push(buffer);
    }
  }
  assert.equal(new Set(buffers.map(digest)).size, 1, `${family.size}px aliases must be byte-identical`);
}

for (const path of [
  'client/public/apple-touch-icon.png',
  'client/public/apple-touch-icon-180x180.png',
  'apple-touch-icon.png',
  'apple-touch-icon-180x180.png',
]) {
  assert.deepEqual(pngDimensions(await readBinary(path)), [180, 180], path);
}

for (const path of [
  'client/public/favicon.ico',
  'client/public/favicon-v2.ico',
  'favicon.ico',
  'favicon-v2.ico',
]) {
  const ico = await readBinary(path);
  assert.equal(ico.readUInt16LE(2), 1, `${path} type`);
  assert.equal(ico.readUInt16LE(4), 4, `${path} frame count`);
}

const canonicalSvg = await readText('client/public/brand/lehrermaps-mark.svg');
assert.match(canonicalSvg, /viewBox="0 0 512 512"/);
assert.match(canonicalSvg, /#173B66/);
assert.match(canonicalSvg, /#0F9E9A/);
assert.match(canonicalSvg, /#E87824/);
assert.match(canonicalSvg, /stroke-dasharray=/);
assert.doesNotMatch(canonicalSvg, /<image\b|checkerboard/i);

for (const path of [
  `${publicIcons}/lehrermaps-mark.svg`,
  `${liveIcons}/lehrermaps-mark.svg`,
  'lehrermaps_icon.svg',
  'client/public/lehrermaps_icon.svg',
]) {
  assert.equal(await readText(path), canonicalSvg, `${path} must mirror the canonical vector`);
}

const [clientHtml, liveHtml, publicManifestText, liveManifestText, publicServiceWorker, liveServiceWorker, brandMark] = await Promise.all([
  readText('client/index.html'),
  readText('index.html'),
  readText('client/public/manifest.json'),
  readText('manifest.json'),
  readText('client/public/service-worker.js'),
  readText('service-worker.js'),
  readText('client/src/components/BrandMark.jsx'),
]);

for (const html of [clientHtml, liveHtml]) {
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/assets\/icons\/lehrermaps-mark\.svg"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180"/);
  assert.match(html, /rel="mask-icon" href="\/assets\/icons\/safari-pinned-tab\.svg" color="#173B66"/);
}
assert.match(brandMark, /src="\/assets\/icons\/lehrermaps-mark\.svg"/);

for (const [manifestText, iconDir] of [[publicManifestText, publicIcons], [liveManifestText, liveIcons]]) {
  const manifest = JSON.parse(manifestText);
  for (const icon of manifest.icons) {
    const relative = icon.src.replace('/assets/icons/', `${iconDir}/`);
    const buffer = await readBinary(relative);
    const size = Number(icon.sizes.split('x')[0]);
    assert.deepEqual(pngDimensions(buffer), [size, size], icon.src);
    assert.equal(icon.type, 'image/png');
  }
  assert.equal(manifest.icons.some(({ purpose }) => purpose === 'maskable'), true);
}

for (const source of [publicServiceWorker, liveServiceWorker]) {
  assert.match(source, /const CACHE_VERSION = 'lehrermaps-v54';/);
  assert.match(source, /'\/assets\/icons\/lehrermaps-mark\.svg'/);
  assert.match(source, /'\/assets\/icons\/lehrermaps-icon-192\.png'/);
  assert.match(source, /'\/assets\/icons\/lehrermaps-v2-icon-192\.png'/);
}

for (const path of [
  'client/public/assets/icons/safari-pinned-tab.svg',
  'assets/icons/safari-pinned-tab.svg',
  'client/public/brand/lehrermaps-logo.png',
  'brand/lehrermaps-logo.png',
]) {
  await stat(resolve(root, path));
}

console.log('Variant D map-and-book vectors, raster aliases, manifests, and caches verified.');
