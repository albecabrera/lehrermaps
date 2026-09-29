#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lehrermaps-reflection-'));
const databasePath = path.join(tempDirectory, 'reflection.sqlite');
const port = String(33000 + Math.floor(Math.random() * 1000));
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['index.js'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, PORT: port, SQLITE_PATH: databasePath, APP_PASSWORD: 'reflection-test', JWT_SECRET: 'reflection-test-secret-that-is-long-enough' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });

async function request(pathname, { token, method = 'GET', body, expected = 200 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, expected, `${method} ${pathname}`);
  if (response.status === 204) return null;
  return response.headers.get('content-type')?.includes('json') ? response.json() : response.arrayBuffer();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`isolated server did not start:\n${output}`);
}

try {
  await waitForServer();
  await request('/api/reflection-board', { expected: 401 });
  const { token } = await request('/api/login', { method: 'POST', body: { password: 'reflection-test' } });
  const initial = await request('/api/reflection-board', { token });
  assert.deepEqual(initial.items, []);
  assert.equal(initial.metadata.subject, '');
  await request('/api/reflection-board', { token, method: 'PUT', body: { metadata: { subject: 'Informatik', className: '6d', topic: 'Zustände', date: '2026-09-29' }, question: 'Was bleibt?' } });
  const item = await request('/api/reflection-board/items', { token, method: 'POST', body: { category: 'koffer', content: 'Kara macht Zustände verständlich.' }, expected: 201 });
  const moved = await request(`/api/reflection-board/items/${item.id}`, { token, method: 'PATCH', body: { category: 'muellkorb' } });
  assert.equal(moved.category, 'muellkorb');
  assert.equal((await request(`/api/reflection-board/items/${item.id}/like`, { token, method: 'POST' })).likes, 1);
  const pdf = await request('/api/reflection-board/export.pdf', { token });
  assert.ok(pdf.byteLength > 100, 'PDF export returns content');
  const backup = await request('/api/backups', { token, method: 'POST', expected: 201 });
  assert.equal(backup.payload.data.reflection_boards.length, 1, 'backups enumerate reflection boards');
  assert.equal(backup.payload.data.reflection_items.length, 1, 'backups enumerate reflection items');
  await request('/api/reflection-board/reset', { token, method: 'POST', body: { preserveMetadata: true } });
  const reloaded = await request('/api/reflection-board', { token });
  assert.deepEqual(reloaded.items, []);
  assert.equal(reloaded.metadata.topic, 'Zustände');
  await request('/api/reflection-board/items', { token, method: 'POST', body: { category: 'invalid', content: 'nope' }, expected: 400 });
  console.log(JSON.stringify({ status: 'PASS', checks: ['authentication', 'normalized metadata', 'owned item lifecycle', 'atomic like', 'PDF export', 'backup enumeration', 'reset with metadata preservation', 'validation'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
  await fs.rm(tempDirectory, { recursive: true, force: true });
}
