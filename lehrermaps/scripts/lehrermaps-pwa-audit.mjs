#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const baseUrl = (process.env.LEHRERMAPS_URL || 'http://localhost:8090').replace(/\/$/, '');
const dist = path.resolve(new URL('../client/dist/', import.meta.url).pathname);
const results = [];

const pass = (name, detail = '') => results.push({ name, status: 'PASS', detail });
const fail = (name, detail) => results.push({ name, status: 'FAIL', detail });
const warn = (name, detail) => results.push({ name, status: 'WARN', detail });

async function get(url) {
  return fetch(`${baseUrl}${url}`, { redirect: 'manual' });
}

async function check(name, callback) {
  try {
    await callback();
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
}

await check('base URL', async () => {
  const response = await get('/');
  if (!response.ok && response.status !== 304) throw new Error(`HTTP ${response.status}`);
  if (new URL(baseUrl).protocol !== 'https:') {
    warn('HTTPS', 'The audit URL is not HTTPS; service workers require a secure context in production.');
  }
  pass('base URL', `HTTP ${response.status}`);
});

await check('manifest', async () => {
  const response = await get('/manifest.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const manifest = await response.json();
  for (const field of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
    if (manifest[field] === undefined) throw new Error(`missing ${field}`);
  }
  if (manifest.display !== 'standalone') throw new Error(`display=${manifest.display}`);
  for (const icon of manifest.icons) {
    const iconResponse = await get(icon.src);
    if (!iconResponse.ok) throw new Error(`${icon.src} -> HTTP ${iconResponse.status}`);
  }
  pass('manifest', `${manifest.icons.length} icons`);
});

await check('service worker', async () => {
  const response = await get('/service-worker.js');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const source = await response.text();
  for (const marker of ["addEventListener('install'", "addEventListener('activate'", "addEventListener('fetch'"]) {
    if (!source.includes(marker)) throw new Error(`missing ${marker}`);
  }
  pass('service worker', 'install/activate/fetch handlers present');
});

await check('cache headers', async () => {
  for (const resource of ['/index.html', '/manifest.json', '/service-worker.js']) {
    const response = await get(resource);
    const cacheControl = response.headers.get('cache-control') || '';
    if (!/no-cache|no-store|must-revalidate/i.test(cacheControl)) {
      throw new Error(`${resource}: Cache-Control=${cacheControl || '(missing)'}`);
    }
  }
  pass('cache headers', 'index, manifest and service worker are revalidated');
});

await check('API health', async () => {
  const response = await get('/api/health');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.ok !== true) throw new Error('health response is not ok=true');
  pass('API health');
});

await check('production dist integrity', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(dist, 'manifest.json'), 'utf8'));
  for (const icon of manifest.icons) await fs.access(path.join(dist, icon.src.replace(/^\//, '')));
  const index = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  for (const asset of index.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)) {
    await fs.access(path.join(dist, asset[1].replace(/^\//, '')));
  }
  pass('production dist integrity');
});

console.log(JSON.stringify({ baseUrl, results }, null, 2));
if (results.some(({ status }) => status === 'FAIL')) process.exitCode = 1;
