#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lehrermaps-short-links-'));
const databasePath = path.join(tempDirectory, 'short-links.sqlite');
const port = String(34000 + Math.floor(Math.random() * 1000));
const baseUrl = `http://127.0.0.1:${port}`;
const password = 'short-link-test';
const secret = 'short-link-test-secret-that-is-long-enough';
let server;
let output = '';

function startServer() {
  output = '';
  server = spawn(process.execPath, ['index.js'], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, PORT: port, SQLITE_PATH: databasePath, APP_PASSWORD: password, JWT_SECRET: secret },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1500))]);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {}
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`isolated server did not start:\n${output}`);
}

async function request(pathname, { token, method = 'GET', body, expected = 200, redirect } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: redirect || 'follow',
  });
  assert.equal(response.status, expected, `${method} ${pathname}`);
  return response;
}

try {
  startServer();
  await waitForServer();
  await request('/api/short-links', { method: 'POST', body: { url: 'https://example.org/lesson' }, expected: 401 });
  const login = await request('/api/login', { method: 'POST', body: { password } });
  const { token } = await login.json();
  await request('/api/short-links', { token, method: 'POST', body: { url: 'javascript:alert(1)' }, expected: 400 });
  await request('/api/short-links', { token, method: 'POST', body: { url: 'example.org/lesson' }, expected: 400 });

  const createdResponse = await request('/api/short-links', {
    token,
    method: 'POST',
    body: { url: 'https://example.org/lesson?q=1#page' },
    expected: 201,
  });
  const created = await createdResponse.json();
  assert.match(created.code, /^[A-Za-z0-9_-]{16}$/, 'code is opaque and non-incremental');
  assert.equal(created.url, 'https://example.org/lesson?q=1#page');
  await request('/api/s/not-a-code', { expected: 404 });

  const redirect = await request(`/api/s/${created.code}`, { expected: 302, redirect: 'manual' });
  assert.equal(redirect.headers.get('location'), created.url);
  await stopServer();

  startServer();
  await waitForServer();
  const persisted = await request(`/api/s/${created.code}`, { expected: 302, redirect: 'manual' });
  assert.equal(persisted.headers.get('location'), created.url, 'short link survives backend restart');
  await request('/api/s/aaaaaaaaaaaaaaaa', { expected: 404 });
  console.log(JSON.stringify({ status: 'PASS', checks: ['teacher authentication', 'server URL validation', 'opaque code creation', 'public 302 redirect', 'unknown-link 404', 'SQLite persistence across restart'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
} finally {
  await stopServer();
  await fs.rm(tempDirectory, { recursive: true, force: true });
}
