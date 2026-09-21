#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(import.meta.dirname, '..');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lehrermaps-widget-'));
const databasePath = path.join(tempDirectory, 'widget.sqlite');
const port = String(33000 + Math.floor(Math.random() * 1000));
const apiBaseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['index.js'], {
  cwd: path.join(root, 'server'),
  env: {
    ...process.env,
    PORT: port,
    SQLITE_PATH: databasePath,
    APP_PASSWORD: 'widget-test',
    JWT_SECRET: 'widget-test-secret-that-is-long-enough',
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
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

const v1Schedule = {
  __lehrermaps_schedule_meta_v1: {
    version: 1,
    periods: [
      { start: '08:00', end: '08:45' }, { start: '09:00', end: '09:45' },
      { start: '10:00', end: '10:45' }, { start: '11:00', end: '11:45' },
      { start: '12:00', end: '12:45' }, { start: '13:00', end: '13:45' },
    ],
  },
  '0-0': { label: '  6a   Informatik  ', location: ' S10 ', notes: 'private lesson note' },
  '0-2': { label: '7b', location: 'S11', folderId: 99 },
};

const v2Schedule = {
  __lehrermaps_schedule_meta_v1: {
    version: 2,
    periods: [
      { start: '08:00', end: '08:45' }, { start: '09:00', end: '09:45' },
      { start: '10:00', end: '10:45' }, { start: '11:00', end: '11:45' },
      { start: '12:30', end: '13:15' }, { start: '13:30', end: '14:15' },
    ],
    breaks: [
      { start: '09:45', end: '10:00' }, { start: '11:45', end: '12:30' },
    ],
  },
  '1-0': { label: '8c', location: 'B12' },
  'break-fruehstueck': { 1: { label: 'Aufsicht', location: 'Schulhof', student: 'private' } },
  '1-2': { label: 'Q1', location: 'Aula' },
};

try {
  await waitForServer();
  await request('/api/widget/today?date=2099-09-07', { expected: 401 });
  const { token } = await request('/api/login', { method: 'POST', body: { password: 'widget-test' } });
  assert.ok(token, 'teacher login returns a token');
  await request(`/api/widget/today?date=2099-09-07&token=${encodeURIComponent(token)}`, { expected: 401 });

  await request('/api/widget/today', { token, expected: 400 });
  await request('/api/widget/today?date=2026-02-30', { token, expected: 400 });

  const empty = await request('/api/widget/today?date=2099-09-07', { token });
  assert.equal(empty.version, 1);
  assert.equal(empty.date, '2099-09-07');
  assert.match(empty.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(empty.schedule, { configured: false, current: null, next: null, slots: [] });
  assert.equal(empty.openTaskCount, 0);
  assert.equal(empty.nextAppointment, null);

  const database = new DatabaseSync(databasePath);
  database.prepare('UPDATE schedule SET data = ? WHERE user_id = 1').run(JSON.stringify(v1Schedule));
  let snapshot = await request('/api/widget/today?date=2099-09-07', { token });
  assert.equal(snapshot.schedule.configured, true);
  assert.deepEqual(snapshot.schedule.slots, [
    { label: '6a Informatik', room: 'S10', start: '08:00', end: '08:45', type: 'lesson', block: 1 },
    { label: '7b', room: 'S11', start: '10:00', end: '10:45', type: 'lesson', block: 3 },
  ]);
  assert.deepEqual(snapshot.schedule.next, snapshot.schedule.slots[0]);
  assert.equal(JSON.stringify(snapshot).includes('private lesson note'), false);
  assert.equal(JSON.stringify(snapshot).includes('folderId'), false);

  database.prepare('UPDATE schedule SET data = ? WHERE user_id = 1').run(JSON.stringify(v2Schedule));
  snapshot = await request('/api/widget/today?date=2099-09-08', { token });
  assert.deepEqual(snapshot.schedule.slots.map(({ type, start, end, block }) => ({ type, start, end, block })), [
    { type: 'lesson', start: '08:00', end: '08:45', block: 1 },
    { type: 'break', start: '09:45', end: '10:00', block: 'break-fruehstueck' },
    { type: 'lesson', start: '10:00', end: '10:45', block: 3 },
  ]);
  assert.equal(JSON.stringify(snapshot).includes('student'), false);

  database.prepare('UPDATE schedule SET data = ? WHERE user_id = 1').run(JSON.stringify({
    ...v2Schedule,
    __lehrermaps_schedule_meta_v1: { ...v2Schedule.__lehrermaps_schedule_meta_v1, breaks: undefined },
  }));
  snapshot = await request('/api/widget/today?date=2099-09-08', { token });
  assert.equal(snapshot.schedule.configured, true, 'legacy six-period timings remain configured');
  assert.equal(snapshot.schedule.slots.some((slot) => slot.type === 'break'), false, 'break time is never invented');

  database.prepare('INSERT INTO today_dashboard_tasks (user_id, tasks_json) VALUES (1, ?) ON CONFLICT(user_id) DO UPDATE SET tasks_json = excluded.tasks_json')
    .run(JSON.stringify([
      { id: '1', text: 'Private task text', done: false },
      { id: '2', text: 'Private completed text', done: true },
    ]));
  database.prepare('INSERT INTO today_dashboard_notes (user_id, note_date, content) VALUES (1, ?, ?)').run('2099-09-08', 'Private dashboard note');
  database.prepare('INSERT INTO exams (title, class_name, subject, exam_date, exam_time, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run('Private appointment title', 'Private class', 'Private subject', '2099-09-09', '14:30', 'Private appointment note');

  snapshot = await request('/api/widget/today?date=2099-09-08', { token });
  assert.equal(snapshot.openTaskCount, 1);
  assert.deepEqual(snapshot.nextAppointment, { date: '2099-09-09', time: '14:30' });
  for (const secret of ['Private task text', 'Private completed text', 'Private dashboard note', 'Private appointment title', 'Private class', 'Private subject', 'Private appointment note']) {
    assert.equal(JSON.stringify(snapshot).includes(secret), false, `${secret} must not leave the widget endpoint`);
  }
  database.close();

  console.log(JSON.stringify({
    status: 'PASS',
    checks: ['Bearer-only authentication', 'strict date validation', 'empty state', 'v1 periods', 'v2 configured breaks', 'no invented break times', 'task privacy', 'appointment privacy', 'isolated SQLite'],
  }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.stack || error.message }));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
  await fs.rm(tempDirectory, { recursive: true, force: true });
}
