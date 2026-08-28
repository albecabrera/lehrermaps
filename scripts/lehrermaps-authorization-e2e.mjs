#!/usr/bin/env node

const apiBaseUrl = process.env.LEHRERMAPS_API_URL || 'http://localhost:3001';
const teacherPassword = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';

async function request(path, { token, method = 'GET', body, expected = 200 } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (response.status !== expected) throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}`);
  return response.headers.get('content-type')?.includes('json') ? response.json() : response.text();
}

let token;
let folder;
try {
  token = (await request('/api/login', { method: 'POST', body: { password: teacherPassword } })).token;
  if (!token) throw new Error('teacher login did not return a token');
  await request('/api/login-student', { method: 'POST', body: { password: 'irrelevant' }, expected: 404 });
  await request('/api/files/public/legacy-token', { expected: 401 });
  folder = await request('/api/folders', { token, method: 'POST', expected: 201, body: { subject: 'informatik', group_name: 'TEST', name: `AUTHZ-${Date.now()}` } });
  await request('/api/folders', { token });
  await request(`/api/files/${folder.id}/share`, { token, method: 'PUT', expected: 404 });
  await request(`/api/files/${folder.id}/public`, { token, method: 'PUT', expected: 404 });
  console.log(JSON.stringify({ status: 'PASS', checks: ['teacher login', 'legacy student login removed', 'legacy public file removed', 'teacher folders remain available'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
} finally {
  if (token && folder) await request(`/api/folders/${folder.id}`, { token, method: 'DELETE' }).catch(() => {});
}
