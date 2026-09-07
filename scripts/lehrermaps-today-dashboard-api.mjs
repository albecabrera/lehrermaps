#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(import.meta.dirname, '..');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lehrermaps-today-dashboard-'));
const databasePath = path.join(tempDirectory, 'dashboard.sqlite');
const port = String(32000 + Math.floor(Math.random() * 1000));
const apiBaseUrl = `http://127.0.0.1:${port}`;
// Reproduce the broken trigger created by an older release. initSchema must
// remove it before the first update, otherwise SQLite raises "no such column: id".
const legacyDatabase = new DatabaseSync(databasePath);
legacyDatabase.exec(`
  CREATE TABLE today_dashboard_tasks (user_id INTEGER PRIMARY KEY, tasks_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE today_dashboard_notes (user_id INTEGER NOT NULL, note_date TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, note_date));
  CREATE TRIGGER today_dashboard_tasks_touch_updated_at AFTER UPDATE ON today_dashboard_tasks FOR EACH ROW BEGIN UPDATE today_dashboard_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
  CREATE TRIGGER today_dashboard_notes_touch_updated_at AFTER UPDATE ON today_dashboard_notes FOR EACH ROW BEGIN UPDATE today_dashboard_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
`);
legacyDatabase.close();
const server = spawn(process.execPath, ['index.js'], {
  cwd: path.join(root, 'server'),
  env: {
    ...process.env,
    PORT: port,
    SQLITE_PATH: databasePath,
    APP_PASSWORD: 'today-dashboard-test',
    JWT_SECRET: 'today-dashboard-test-secret-that-is-long-enough',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });

async function request(pathname, { token, method = 'GET', body, expected = 200 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiBaseUrl}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, expected, `${method} ${pathname}`);
  return response.json();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`isolated server did not start:\n${output}`);
}

try {
  await waitForServer();
  await request('/api/today-dashboard', { expected: 401 });
  const { token } = await request('/api/login', { method: 'POST', body: { password: 'today-dashboard-test' } });
  assert.ok(token, 'teacher login returns a token');

  const date = '2026-08-29';
  assert.deepEqual(await request(`/api/today-dashboard?date=${date}`, { token }), { tasks: [], tasksUpdatedAt: null, note: '', date });
  const invalidGet = await request('/api/today-dashboard?date=2026-02-30', { token });
  assert.match(invalidGet.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(invalidGet.date, '2026-02-30');
  await request('/api/today-dashboard/tasks', { token, method: 'PUT', expected: 400, body: { tasks: [{ id: 'invalid', text: 'not boolean', done: 'yes' }] } });
  await request('/api/today-dashboard/note', { token, method: 'PUT', expected: 400, body: { date: '2026-02-30', content: 'invalid calendar date' } });

  const tasks = [{ id: 'task-1', text: 'Persisted task', done: false }];
  const savedTasks = await request('/api/today-dashboard/tasks', { token, method: 'PUT', body: { tasks } });
  assert.deepEqual(savedTasks.tasks, tasks);
  assert.equal(typeof savedTasks.updatedAt, 'string', 'task save returns the persisted timestamp');
  await request('/api/today-dashboard/note', { token, method: 'PUT', body: { date, content: 'Persisted note' } });
  const loaded = await request(`/api/today-dashboard?date=${date}`, { token });
  assert.deepEqual({ tasks: loaded.tasks, note: loaded.note, date: loaded.date }, { tasks, note: 'Persisted note', date });
  assert.equal(typeof loaded.tasksUpdatedAt, 'string', 'dashboard returns the task persistence timestamp');

  const nextTasks = [{ ...tasks[0], done: true }];
  await request('/api/today-dashboard/tasks', { token, method: 'PUT', body: { tasks: nextTasks } });
  await request('/api/today-dashboard/note', { token, method: 'PUT', body: { date, content: '' } });
  assert.deepEqual((await request(`/api/today-dashboard?date=${date}`, { token })).tasks, nextTasks);
  assert.deepEqual((await request('/api/today-dashboard/tasks', { token, method: 'PUT', body: { tasks: [] } })).tasks, []);
  assert.deepEqual((await request(`/api/today-dashboard?date=${date}`, { token })).tasks, []);
  console.log(JSON.stringify({ status: 'PASS', checks: ['authentication', 'GET by date', 'strict validation', 'task and note upserts', 'explicit clears', 'isolated SQLite'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
  await fs.rm(tempDirectory, { recursive: true, force: true });
}
