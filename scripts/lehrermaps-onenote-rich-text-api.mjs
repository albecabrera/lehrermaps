#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lehrermaps-onenote-'));
const databasePath = path.join(directory, 'onenote.sqlite');
const port = String(33000 + Math.floor(Math.random() * 1000));
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['index.js'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, PORT: port, SQLITE_PATH: databasePath, APP_PASSWORD: 'onenote-test', JWT_SECRET: 'onenote-test-secret-that-is-long-enough' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });

async function request(pathname, { token, method = 'GET', body, expected = 200 } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, expected, `${method} ${pathname}`);
  return response.status === 204 ? null : response.json();
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
  const { token } = await request('/api/login', { method: 'POST', body: { password: 'onenote-test' } });
  const notebook = await request('/api/notebooks', { token, method: 'POST', expected: 201, body: { title: 'OneNote' } });
  const section = await request('/api/sections', { token, method: 'POST', expected: 201, body: { notebook_id: notebook.id, title: 'Section' } });
  const page = await request('/api/pages', { token, method: 'POST', expected: 201, body: { section_id: section.id, title: 'Page' } });

  assert.deepEqual(await request(`/api/blocks/${page.id}`, { token }), []);
  const first = await request(`/api/pages/${page.id}/rich-text`, { token, method: 'PUT', body: { html: '<p>First</p>' } });
  assert.equal(typeof first.id, 'number');
  assert.equal(first.html, '<p>First</p>');
  assert.equal(Number.isFinite(Date.parse(first.updatedAt)), true, 'writes return a reliable persisted modification timestamp');
  let blocks = await request(`/api/blocks/${page.id}`, { token });
  assert.equal(blocks.filter((block) => block.type === 'rich_text').length, 1);
  assert.deepEqual(JSON.parse(blocks[0].content), { html: '<p>First</p>' });
  assert.equal(blocks[0].updatedAt, first.updatedAt, 'reads return the exact persisted rich-text modification timestamp');

  await new Promise((resolve) => setTimeout(resolve, 2));
  const final = await request(`/api/pages/${page.id}/rich-text`, { token, method: 'PUT', body: { html: '<p>Last write wins</p>' } });
  assert.equal(final.html, '<p>Last write wins</p>');
  assert.ok(Date.parse(final.updatedAt) > Date.parse(first.updatedAt), 'later writes receive a newer persisted timestamp');
  blocks = await request(`/api/blocks/${page.id}`, { token });
  assert.equal(blocks.filter((block) => block.type === 'rich_text').length, 1);
  assert.deepEqual(JSON.parse(blocks[0].content), { html: '<p>Last write wins</p>' });
  await request('/api/pages/onenote_local/rich-text', { token, method: 'PUT', expected: 404, body: { html: '<p>Never saved</p>' } });
  await request(`/api/pages/${page.id}/rich-text`, { method: 'PUT', expected: 401, body: { html: '<p>Unauthorized</p>' } });
  console.log(JSON.stringify({ status: 'PASS', checks: ['authentication', 'rich text write/read', 'last-write-wins', 'temporary ID rejection'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
  await fs.rm(directory, { recursive: true, force: true });
}
