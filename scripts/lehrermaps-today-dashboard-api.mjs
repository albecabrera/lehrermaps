#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lehrermaps-today-dashboard-'));
const databasePath = path.join(tempDirectory, 'dashboard.sqlite');
const port = String(32000 + Math.floor(Math.random() * 1000));
const apiBaseUrl = `http://127.0.0.1:${port}`;
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
  assert.deepEqual(await request(`/api/today-dashboard?date=${date}`, { token }), { tasks: [], note: '', date });
  const invalidGet = await request('/api/today-dashboard?date=2026-02-30', { token });
  assert.match(invalidGet.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(invalidGet.date, '2026-02-30');
  await request('/api/today-dashboard/tasks', { token, method: 'PUT', expected: 400, body: { tasks: [{ id: 'invalid', text: 'not boolean', done: 'yes' }] } });
  await request('/api/today-dashboard/note', { token, method: 'PUT', expected: 400, body: { date: '2026-02-30', content: 'invalid calendar date' } });

  const tasks = [{ id: 'task-1', text: 'Persisted task', done: false }];
  await request('/api/today-dashboard/tasks', { token, method: 'PUT', body: { tasks } });
  await request('/api/today-dashboard/note', { token, method: 'PUT', body: { date, content: 'Persisted note' } });
  assert.deepEqual(await request(`/api/today-dashboard?date=${date}`, { token }), { tasks, note: 'Persisted note', date });

  const nextTasks = [{ ...tasks[0], done: true }];
  await request('/api/today-dashboard/tasks', { token, method: 'PUT', body: { tasks: nextTasks } });
  await request('/api/today-dashboard/note', { token, method: 'PUT', body: { date, content: '' } });
  assert.deepEqual(await request(`/api/today-dashboard?date=${date}`, { token }), { tasks: nextTasks, note: '', date });
  assert.deepEqual(await request('/api/today-dashboard/tasks', { token, method: 'PUT', body: { tasks: [] } }), { tasks: [] });
  assert.deepEqual(await request(`/api/today-dashboard?date=${date}`, { token }), { tasks: [], note: '', date });
  console.log(JSON.stringify({ status: 'PASS', checks: ['authentication', 'GET by date', 'strict validation', 'task and note upserts', 'explicit clears', 'isolated SQLite'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
  await fs.rm(tempDirectory, { recursive: true, force: true });
}
