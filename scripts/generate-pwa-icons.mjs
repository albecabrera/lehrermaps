import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'client/package.json'));
const { chromium } = require('playwright');
const source = await readFile(resolve(root, 'client/public/brand/lehrermaps-mark.svg'), 'utf8');
const outputDir = resolve(root, 'client/public/assets/icons');

const icons = [
  { name: 'favicon-16.png', size: 16, markSize: 12 },
  { name: 'favicon-32.png', size: 32, markSize: 24 },
  { name: 'icon-192.png', size: 192, markSize: 138 },
  { name: 'icon-512.png', size: 512, markSize: 368 },
  { name: 'apple-touch-icon.png', size: 180, markSize: 130 },
  // Android may crop the outer 16.7% of a maskable icon. Keep the mark inside
  // the central safe zone while retaining the LehrerMaps identity.
  { name: 'icon-maskable-512.png', size: 512, markSize: 320 },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const icon of icons) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body><main>${source}</main></body></html>`);
    await page.addStyleTag({ content: `
      html, body { margin: 0; width: ${icon.size}px; height: ${icon.size}px; background: #F7F8FA; }
      main { width: 100%; height: 100%; display: grid; place-items: center; }
      svg { display: block; width: ${icon.markSize}px; height: ${icon.markSize}px; }
    ` });
    await page.screenshot({ path: resolve(outputDir, icon.name), type: 'png' });
    await page.close();
  }
} finally {
  await browser.close();
}
