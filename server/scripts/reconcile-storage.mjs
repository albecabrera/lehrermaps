#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'crypto';
import { mkdir, readdir, rename, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = process.env.SQLITE_PATH ? path.resolve(serverDir, process.env.SQLITE_PATH) : path.join(serverDir, 'data', 'lehrermaps.sqlite');
const storageRoot = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : serverDir;
const uploadsDir = path.join(storageRoot, 'uploads');
const quarantineDir = path.join(storageRoot, 'orphan-quarantine');
const applyAppleDouble = process.argv.includes('--remove-appledouble');
const quarantineOrphans = process.argv.includes('--quarantine-orphans');

const database = new DatabaseSync(databasePath, { readOnly: true });
const referenced = new Set(database.prepare('SELECT stored_name FROM files').all().map(({ stored_name }) => stored_name));
database.close();
const names = (await readdir(uploadsDir)).filter((name) => name !== '.gitkeep');
const appleDouble = names.filter((name) => name.startsWith('._'));
const normal = names.filter((name) => !name.startsWith('._'));
const orphans = normal.filter((name) => !referenced.has(name));
const missing = [...referenced].filter((name) => !normal.includes(name));

async function metadata(name) {
  const info = await stat(path.join(uploadsDir, name));
  return { name, size: info.size, modified_at: info.mtime.toISOString() };
}

const report = {
  mode: applyAppleDouble || quarantineOrphans ? 'apply-selected-actions' : 'dry-run',
  referenced: referenced.size,
  missing_referenced: missing,
  appledouble: await Promise.all(appleDouble.map(metadata)),
  normal_orphans: await Promise.all(orphans.map(metadata)),
  actions: [],
};

// AppleDouble files are metadata sidecars, never application blobs. Normal
// unreferenced files are not deleted: they may be the only surviving user copy.
if (applyAppleDouble) {
  await mkdir(quarantineDir, { recursive: true });
  for (const name of appleDouble) {
    await rename(path.join(uploadsDir, name), path.join(quarantineDir, `${Date.now()}-${name}`));
    report.actions.push({ action: 'quarantined_appledouble', name });
  }
}
if (quarantineOrphans) {
  await mkdir(quarantineDir, { recursive: true });
  for (const name of orphans) {
    const info = await metadata(name);
    const fingerprint = createHash('sha256').update(`${name}:${info.size}:${info.modified_at}`).digest('hex').slice(0, 12);
    await rename(path.join(uploadsDir, name), path.join(quarantineDir, `${Date.now()}-${fingerprint}-${name}`));
    report.actions.push({ action: 'quarantined_normal_orphan', ...info });
  }
}

console.log(JSON.stringify(report, null, 2));
