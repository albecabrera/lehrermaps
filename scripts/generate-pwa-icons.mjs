import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(root, 'client/public');
const publicBrandDir = resolve(publicRoot, 'brand');
const publicIconDir = resolve(publicRoot, 'assets/icons');
const liveBrandDir = resolve(root, 'brand');
const liveIconDir = resolve(root, 'assets/icons');
const legacyIconDir = resolve(root, 'icons');
const require = createRequire(resolve(root, 'client/package.json'));
const { chromium } = require('playwright');

const sources = Object.fromEntries(
  await Promise.all(
    ['lehrermaps-mark.svg', 'lehrermaps-mark-light.svg', 'lehrermaps-mark-dark.svg', 'lehrermaps-mark-mono.svg']
      .map(async (name) => [name, await readFile(resolve(publicBrandDir, name), 'utf8')]),
  ),
);

for (const dir of [publicIconDir, liveBrandDir, liveIconDir, legacyIconDir]) {
  await mkdir(dir, { recursive: true });
}

// Keep the authored SVG family and every deployed vector alias in sync.
for (const [name, source] of Object.entries(sources)) {
  await writeFile(resolve(liveBrandDir, name), source);
}
for (const path of [
  resolve(publicIconDir, 'favicon.svg'),
  resolve(publicIconDir, 'lehrermaps-favicon.svg'),
  resolve(publicIconDir, 'lehrermaps-mark.svg'),
  resolve(publicRoot, 'lehrermaps_icon.svg'),
  resolve(liveIconDir, 'favicon.svg'),
  resolve(liveIconDir, 'lehrermaps-favicon.svg'),
  resolve(liveIconDir, 'lehrermaps-mark.svg'),
  resolve(root, 'lehrermaps_icon.svg'),
]) {
  await writeFile(path, sources['lehrermaps-mark.svg']);
}
for (const path of [
  resolve(publicIconDir, 'icon-maskable.svg'),
  resolve(liveIconDir, 'icon-maskable.svg'),
  resolve(legacyIconDir, 'icon-maskable.svg'),
]) {
  await writeFile(path, sources['lehrermaps-mark.svg']);
}
for (const path of [
  resolve(publicIconDir, 'safari-pinned-tab.svg'),
  resolve(liveIconDir, 'safari-pinned-tab.svg'),
]) {
  await writeFile(path, sources['lehrermaps-mark-mono.svg']);
}

const publicAndLive = (names) => names.flatMap((name) => [
  resolve(publicIconDir, name),
  resolve(liveIconDir, name),
]);

const icons = [
  {
    size: 16,
    markSize: 16,
    paths: publicAndLive(['favicon-16.png', 'lehrermaps-favicon-16.png', 'lehrermaps-v2-favicon-16.png']),
  },
  {
    size: 32,
    markSize: 32,
    paths: publicAndLive(['favicon-32.png', 'lehrermaps-favicon-32.png', 'lehrermaps-v2-favicon-32.png']),
  },
  {
    size: 180,
    markSize: 180,
    paths: [
      ...publicAndLive(['apple-touch-icon.png', 'lehrermaps-apple-touch-icon.png', 'lehrermaps-v2-apple-touch-icon.png']),
      resolve(publicRoot, 'apple-touch-icon.png'),
      resolve(publicRoot, 'apple-touch-icon-180x180.png'),
      resolve(root, 'apple-touch-icon.png'),
      resolve(root, 'apple-touch-icon-180x180.png'),
      resolve(legacyIconDir, 'apple-touch-icon.png'),
    ],
  },
  {
    size: 192,
    markSize: 192,
    paths: [
      ...publicAndLive(['icon-192.png', 'lehrermaps-icon-192.png', 'lehrermaps-v2-icon-192.png']),
      resolve(legacyIconDir, 'icon-192.png'),
    ],
  },
  {
    size: 512,
    markSize: 512,
    paths: [
      ...publicAndLive(['icon-512.png', 'lehrermaps-icon-512.png', 'lehrermaps-v2-icon-512.png']),
      resolve(legacyIconDir, 'icon-512.png'),
    ],
  },
  {
    size: 512,
    markSize: 352,
    background: '#F7F8FA',
    paths: [
      ...publicAndLive(['icon-maskable-512.png', 'lehrermaps-icon-maskable-512.png', 'lehrermaps-v2-icon-maskable-512.png']),
    ],
  },
];

const browser = await chromium.launch({ headless: true });
const rendered = new Map();

async function render(source, size, markSize, background = 'transparent') {
  const key = `${source}\0${size}:${markSize}:${background}`;
  if (rendered.has(key)) return rendered.get(key);

  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body><main>${source}</main></body></html>`);
  await page.addStyleTag({ content: `
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${background}; }
    main { width: 100%; height: 100%; display: grid; place-items: center; }
    svg { display: block; width: ${markSize}px; height: ${markSize}px; }
  ` });
  const png = await page.screenshot({ type: 'png', omitBackground: background === 'transparent' });
  await page.close();
  rendered.set(key, png);
  return png;
}

try {
  for (const icon of icons) {
    const png = await render(
      sources['lehrermaps-mark.svg'],
      icon.size,
      icon.markSize,
      icon.background,
    );
    await Promise.all(icon.paths.map((path) => writeFile(path, png)));
  }

  const brandPngs = [
    ['lehrermaps-mark.png', 'lehrermaps-mark.svg'],
    ['lehrermaps-mark-light.png', 'lehrermaps-mark-light.svg'],
    ['lehrermaps-mark-dark.png', 'lehrermaps-mark-dark.svg'],
    ['lehrermaps-mark-mono.png', 'lehrermaps-mark-mono.svg'],
  ];
  for (const [pngName, sourceName] of brandPngs) {
    const png = await render(sources[sourceName], 512, 512);
    await Promise.all([
      writeFile(resolve(publicBrandDir, pngName), png),
      writeFile(resolve(liveBrandDir, pngName), png),
    ]);
  }

  // The historical logo filename must no longer expose the retired teacher artwork.
  const fullMark = await render(sources['lehrermaps-mark.svg'], 512, 512);
  await Promise.all([
    writeFile(resolve(publicBrandDir, 'lehrermaps-logo.png'), fullMark),
    writeFile(resolve(liveBrandDir, 'lehrermaps-logo.png'), fullMark),
  ]);

  // ICO is a small directory of PNG frames; writing it here keeps both aliases reproducible.
  const icoFrames = await Promise.all([16, 32, 48, 64].map(async (size) => ({
    size,
    data: await render(sources['lehrermaps-mark.svg'], size, size),
  })));
  const headerSize = 6 + (16 * icoFrames.length);
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(icoFrames.length, 4);
  let offset = headerSize;
  icoFrames.forEach(({ size, data }, index) => {
    const entry = 6 + (index * 16);
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  const ico = Buffer.concat([header, ...icoFrames.map(({ data }) => data)]);
  await Promise.all([
    resolve(publicRoot, 'favicon.ico'),
    resolve(publicRoot, 'favicon-v2.ico'),
    resolve(root, 'favicon.ico'),
    resolve(root, 'favicon-v2.ico'),
  ].map((path) => writeFile(path, ico)));
} finally {
  await browser.close();
}

console.log('Generated LehrerMaps map-and-book SVG aliases, PNG icons, and ICO files.');
