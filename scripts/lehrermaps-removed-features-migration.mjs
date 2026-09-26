#!/usr/bin/env node
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lehrermaps-removed-features-'));
const databasePath = path.join(directory, 'legacy.sqlite');
const legacy = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });

legacy.exec(`
  CREATE TABLE folders (id INTEGER PRIMARY KEY, subject TEXT NOT NULL, group_name TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, notes TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, due_at TEXT, parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE, color TEXT, is_archived INTEGER NOT NULL DEFAULT 0, is_internal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE files (id INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE, original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, timer_minutes INTEGER, is_shared INTEGER NOT NULL DEFAULT 0, due_at TEXT, is_public INTEGER NOT NULL DEFAULT 0, public_token TEXT, material_role TEXT NOT NULL DEFAULT 'other', version_group_id TEXT, version_number INTEGER NOT NULL DEFAULT 1, is_current_version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE schedule (id INTEGER PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}');
  CREATE TABLE user_backups (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE lesson_sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL DEFAULT 1, folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL, title TEXT NOT NULL, lesson_date TEXT NOT NULL, class_name TEXT, subject TEXT, learning_goal TEXT, teacher_notes TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE annual_plans (id INTEGER PRIMARY KEY, root_folder_id INTEGER NOT NULL REFERENCES folders(id));
  CREATE TABLE annual_plan_entries (id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES annual_plans(id), lesson_session_id INTEGER REFERENCES lesson_sessions(id));
  CREATE TABLE annual_plan_materials (id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES annual_plan_entries(id), folder_id INTEGER REFERENCES folders(id));
  CREATE TABLE notebooks (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL);
  CREATE TABLE sections (id INTEGER PRIMARY KEY, notebook_id INTEGER NOT NULL REFERENCES notebooks(id));
  CREATE TABLE pages (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES sections(id));
  CREATE TABLE blocks (id INTEGER PRIMARY KEY, page_id INTEGER NOT NULL REFERENCES pages(id));
  CREATE TABLE quick_notes (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, content TEXT);
  INSERT INTO folders (id, subject, group_name, name, notes) VALUES (1, 'legacy', 'Legacy', 'Legacy folder', 'removed note');
  INSERT INTO lesson_sessions (id, title, lesson_date) VALUES (1, 'Legacy session', '2026-01-01');
  INSERT INTO annual_plans (id, root_folder_id) VALUES (1, 1);
  INSERT INTO annual_plan_entries (id, plan_id, lesson_session_id) VALUES (1, 1, 1);
  INSERT INTO annual_plan_materials (id, entry_id, folder_id) VALUES (1, 1, 1);
  INSERT INTO notebooks (id, user_id, title) VALUES (1, 1, 'Legacy notebook');
  INSERT INTO sections (id, notebook_id) VALUES (1, 1);
  INSERT INTO pages (id, section_id) VALUES (1, 1);
  INSERT INTO blocks (id, page_id) VALUES (1, 1);
  INSERT INTO quick_notes (id, user_id, content) VALUES (1, 1, 'Legacy quick note');
  INSERT INTO user_backups (user_id, payload_json) VALUES (1, '{"data":{"notebooks":[{"id":1}],"quick_notes":[{"id":1}],"today_dashboard_tasks":[]}}');
`);
legacy.close();

process.env.SQLITE_PATH = databasePath;
const { initSchema } = await import(`../server/db.js?migration-test=${Date.now()}`);
await initSchema();

const migrated = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
const removedTables = ['annual_plan_materials', 'annual_plan_entries', 'annual_plans', 'blocks', 'pages', 'sections', 'notebooks', 'quick_notes'];
for (const table of removedTables) {
  assert.equal(migrated.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table), undefined, `${table} must be removed`);
}
const folderColumns = migrated.prepare('PRAGMA table_info(folders)').all().map((column) => column.name);
assert.equal(folderColumns.includes('notes'), false, 'folders.notes must be removed');
const backup = JSON.parse(migrated.prepare('SELECT payload_json FROM user_backups WHERE id = 1').get().payload_json);
assert.deepEqual(backup.data, { today_dashboard_tasks: [] }, 'legacy notebook backup data must be scrubbed');
migrated.close();

const { default: filesRouter } = await import(`../server/routes/files.js?migration-test=${Date.now()}`);
const searchLayer = filesRouter.stack.find((layer) => layer.route?.path === '/search' && layer.route.methods.get);
assert.ok(searchLayer, 'files search route must remain registered');
const searchResult = await new Promise((resolve, reject) => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, payload }); },
  };
  Promise.resolve(searchLayer.route.stack.at(-1).handle({ user: { role: 'lehrer' }, query: { q: 'Legacy' } }, response)).catch(reject);
});
assert.equal(searchResult.statusCode, 200, `files search must succeed after migration: ${JSON.stringify(searchResult.payload)}`);
assert(searchResult.payload.folders.some((folder) => folder.name === 'Legacy folder'), 'files search must return migrated folders');
await fs.rm(directory, { recursive: true, force: true });

console.log(JSON.stringify({ status: 'PASS', checks: ['legacy SQLite migration', 'FK-safe table removal', 'folder notes removal', 'backup scrub', 'files search after migration'] }));
