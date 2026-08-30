#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'lehrermaps-annual-api-'));
const port = 33000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}/api`;
const server = spawn(process.execPath, ['server/index.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'test', PORT: String(port), BIND_HOST: '127.0.0.1', SQLITE_PATH: path.join(temporary, 'test.sqlite'), STORAGE_DIR: path.join(temporary, 'storage'), APP_PASSWORD: 'test-password', JWT_SECRET: 'test-secret' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let token;

async function request(url, options = {}, expected = 200) {
  const response = await fetch(`${base}${url}`, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  const body = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, expected, `${options.method || 'GET'} ${url}: ${JSON.stringify(body)}`);
  return body;
}

try {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  token = (await request('/login', { method: 'POST', body: JSON.stringify({ password: 'test-password' }) })).token;
  const rootA = await request('/folders', { method: 'POST', body: JSON.stringify({ subject: 'Test', group_name: 'A', name: 'Class A' }) }, 201);
  const rootB = await request('/folders', { method: 'POST', body: JSON.stringify({ subject: 'Test', group_name: 'B', name: 'Class B' }) }, 201);
  const plan = await request('/plans', { method: 'POST', body: JSON.stringify({ root_folder_id: rootA.id, school_year: '2030/31', start_date: '2030-08-01', end_date: '2031-07-31' }) }, 201);
  await request(`/plans/${plan.id}/entries`, { method: 'POST', body: JSON.stringify({ entry_date: '2030-02-31' }) }, 400);
  const entry = await request(`/plans/${plan.id}/entries`, { method: 'POST', body: JSON.stringify({ entry_date: '2030-08-10', title: '', content: 'General content', learning_objectives: 'Objective', activities: 'Activity', homework: 'Homework' }) }, 201);
  const patched = await request(`/plans/entries/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ activities: 'Changed' }) });
  assert.equal(patched.content, 'General content');
  assert.equal(patched.activities, 'Changed');

  const form = new FormData();
  form.append('folder_id', String(rootA.id));
  form.append('file', new Blob([Buffer.from('%PDF-1.4\n%%EOF')], { type: 'application/pdf' }), 'worksheet.pdf');
  const file = await request('/files/upload', { method: 'POST', body: form }, 201);
  await request(`/plans/entries/${entry.id}/materials`, { method: 'POST', body: JSON.stringify({ kind: 'file', id: file.id }) });
  const duplicate = await request(`/plans/entries/${entry.id}/duplicate`, { method: 'POST' }, 201);
  assert.equal(duplicate.lesson_session_id, null);
  assert.deepEqual(duplicate.file_ids, [file.id]);
  const firstStart = await request(`/plans/entries/${entry.id}/lesson-session`, { method: 'POST', body: '{}' });
  const secondStart = await request(`/plans/entries/${entry.id}/lesson-session`, { method: 'POST', body: '{}' });
  assert.equal(firstStart.session.id, secondStart.session.id);
  await request(`/plans/entries/${entry.id}`, { method: 'DELETE' });
  assert.equal((await request(`/lesson-sessions/${firstStart.session.id}`)).id, firstStart.session.id);

  const archive = await request(`/plan-archives/${plan.id}/export.zip`);
  assert.equal(archive[0], 0x50);
  const importForm = new FormData();
  importForm.append('root_folder_id', String(rootB.id));
  importForm.append('school_year', '2031/32');
  importForm.append('archive', new Blob([archive], { type: 'application/zip' }), 'plan.zip');
  const preview = await request('/plan-archives/import/preview', { method: 'POST', body: importForm });
  await request('/plan-archives/import/commit', { method: 'POST', body: JSON.stringify({ token: preview.token }) }, 201);
  const imported = await request(`/plans?folder_id=${rootB.id}&school_year=2031/32`);
  assert.equal(imported.entries.length, 1);
  assert.equal(imported.entries[0].lesson_session_id, null);
  console.log('annual planning API invariants: PASS');
} finally {
  server.kill('SIGTERM');
  await rm(temporary, { recursive: true, force: true });
}
