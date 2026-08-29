#!/usr/bin/env node

const apiBaseUrl = process.env.LEHRERMAPS_API_URL || 'http://localhost:3001';
const teacherPassword = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';

async function request(path, { token, method = 'GET', body, expected = 200 } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (response.status !== expected) throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}`);
  return response.json();
}

let token;
let originalItems;
try {
  await request('/api/bug-checklist', { expected: 401 });
  token = (await request('/api/login', { method: 'POST', body: { password: teacherPassword } })).token;
  if (!token) throw new Error('teacher login did not return a token');
  originalItems = (await request('/api/bug-checklist', { token })).items;
  await request('/api/bug-checklist', { token, method: 'PUT', expected: 400, body: { items: [{ id: 'bad', text: 'Invalid', completed: 'yes' }] } });
  const items = [{ id: `checklist-${Date.now()}`, text: 'API persistence check', completed: false }];
  const saved = await request('/api/bug-checklist', { token, method: 'PUT', body: { items } });
  const updatedItems = [{ ...items[0], completed: true }];
  await request('/api/bug-checklist', { token, method: 'PUT', body: { items: updatedItems } });
  const loaded = await request('/api/bug-checklist', { token });
  if (JSON.stringify(saved.items) !== JSON.stringify(items) || JSON.stringify(loaded.items) !== JSON.stringify(updatedItems)) throw new Error('saved checklist was not returned intact');
  console.log(JSON.stringify({ status: 'PASS', checks: ['authentication', 'strict validation', 'upsert persistence'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
} finally {
  if (token && originalItems) await request('/api/bug-checklist', { token, method: 'PUT', body: { items: originalItems } }).catch(() => {});
}
