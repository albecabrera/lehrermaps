#!/usr/bin/env node
/**
 * Rebuild the SQLite material catalogue from source material tracked in Git.
 *
 * This deliberately refuses to run when folders or files already exist.  It
 * is a recovery tool, not a general import or merge facility.
 */
import { DatabaseSync } from 'node:sqlite';
import { copyFile, cp, mkdir, readdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(serverDir, '..');
const sourceDir = path.join(projectDir, 'Spanisch');
const databasePath = path.join(serverDir, 'data', 'lehrermaps.sqlite');
const uploadsDir = path.join(serverDir, 'uploads');
const stagingDir = path.join(uploadsDir, `.repository-recovery-${Date.now()}`);
const backupPath = path.join(serverDir, 'data', `lehrermaps.before-repository-recovery-${Date.now()}.sqlite`);

const MIME_TYPES = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', mp4: 'video/mp4', txt: 'text/plain', zip: 'application/zip',
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return nested.flat().sort((a, b) => a.localeCompare(b, 'de'));
}

function materialRole(name) {
  const lower = name.toLocaleLowerCase('de');
  if (/(loesung|lösung|soluci|erwartung|\bewh\b)/.test(lower)) return 'solution';
  if (/(klausur|examen|probeklausur)/.test(lower)) return 'exam';
  return 'other';
}

function mimeType(name) {
  const extension = path.extname(name).slice(1).toLocaleLowerCase('en');
  return MIME_TYPES[extension] || 'application/octet-stream';
}

if (!existsSync(sourceDir)) throw new Error(`No existe el directorio recuperable: ${sourceDir}`);
if (!existsSync(databasePath)) throw new Error(`No existe la base SQLite: ${databasePath}`);

const database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
const existing = database.prepare('SELECT (SELECT COUNT(*) FROM folders) AS folders, (SELECT COUNT(*) FROM files) AS files').get();
if (Number(existing.folders) !== 0 || Number(existing.files) !== 0) {
  throw new Error('La base no está vacía; se cancela para no mezclar o sobrescribir contenido existente.');
}

const sourceFiles = await listFiles(sourceDir);
if (!sourceFiles.length) throw new Error('No se encontraron materiales para recuperar.');

await mkdir(uploadsDir, { recursive: true });
await copyFile(databasePath, backupPath);
await mkdir(stagingDir, { recursive: true });

const folderIdByPath = new Map();
const insertFolder = database.prepare('INSERT INTO folders (subject, group_name, name, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)');
const insertFile = database.prepare(`INSERT INTO files
  (folder_id, original_name, stored_name, mime_type, size_bytes, material_role, version_group_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)`);

try {
  database.exec('BEGIN IMMEDIATE');
  for (const sourcePath of sourceFiles) {
    const relative = path.relative(sourceDir, sourcePath);
    const parts = relative.split(path.sep);
    const [legacyGroup, ...contentParts] = parts;
    if (legacyGroup !== 'Klasse 12' || contentParts.length < 2) {
      throw new Error(`Ruta de material inesperada: ${relative}`);
    }

    const originalName = contentParts.at(-1);
    const folderParts = contentParts.slice(0, -1);
    let parentId = null;
    let folderKey = '';
    for (const [index, folderName] of folderParts.entries()) {
      folderKey = folderKey ? `${folderKey}/${folderName}` : folderName;
      if (!folderIdByPath.has(folderKey)) {
        const result = insertFolder.run('spanisch', 'Q1', folderName, parentId, index);
        folderIdByPath.set(folderKey, Number(result.lastInsertRowid));
      }
      parentId = folderIdByPath.get(folderKey);
    }

    const storedName = randomUUID();
    const targetPath = path.join(stagingDir, storedName);
    const metadata = await stat(sourcePath);
    await cp(sourcePath, targetPath, { force: false });
    insertFile.run(parentId, originalName, storedName, mimeType(originalName), Number(metadata.size), materialRole(originalName), randomUUID());
  }
  database.exec('PRAGMA foreign_key_check;');
  database.exec('COMMIT');
  database.close();

  for (const storedName of await readdir(stagingDir)) {
    await rename(path.join(stagingDir, storedName), path.join(uploadsDir, storedName));
  }
  console.log(JSON.stringify({
    recoveredFiles: sourceFiles.length,
    recoveredFolders: folderIdByPath.size,
    backup: backupPath,
    database: databasePath,
    uploads: uploadsDir,
  }, null, 2));
} catch (error) {
  try { database.exec('ROLLBACK'); } catch {}
  database.close();
  throw error;
}
