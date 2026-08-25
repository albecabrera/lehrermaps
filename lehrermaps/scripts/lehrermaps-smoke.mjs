#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.env.LEHRERMAPS_URL || 'http://localhost:8090';
const apiBaseUrl = process.env.LEHRERMAPS_API_URL || (new URL(baseUrl).port === '8090' ? 'http://localhost:3001' : baseUrl);
const prefix = `TEST_LEHRERMAPS_${Date.now()}_`;
const results = [];
const createdFiles = [];
let teacherToken;
let studentToken;
let root;
let child;
let destination;
let notebook;
let section;
let pageRecord;
let quickNote;
let exam;
let originalSchedule;
let browser;
let annualPlan;
let annualEntry;
let annualCopy;

const pass = (name, detail = '') => results.push({ name, status: 'PASS', detail });
const fail = (name, error) => results.push({ name, status: 'FAIL', detail: error.message });

async function request(path, options = {}, token = teacherToken) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : await response.arrayBuffer();
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function requestStatus(path, expectedStatus, options = {}, token = teacherToken) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}, expected ${expectedStatus}: ${body}`);
  }
  return response;
}

async function check(name, callback) {
  try {
    const detail = await callback();
    pass(name, typeof detail === 'string' ? detail : '');
  } catch (error) {
    fail(name, error);
  }
}

async function cleanup(path, options = {}) {
  try { await request(path, options); } catch (error) { fail(`cleanup ${path}`, error); }
}

try {
  await check('health', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });

  teacherToken = (await request('/api/login', {
    method: 'POST', body: JSON.stringify({ password: process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer' }),
  }, null)).token;
  studentToken = (await request('/api/login-student', {
    method: 'POST', body: JSON.stringify({ password: process.env.LEHRERMAPS_STUDENT_PASSWORD || 'schueler' }),
  }, null)).token;
  pass('login docente y estudiante');

  root = await request('/api/folders', { method: 'POST', body: JSON.stringify({ subject: 'Informatik', group_name: 'TEST', name: `${prefix}ROOT` }) });
  child = await request('/api/folders', { method: 'POST', body: JSON.stringify({ subject: 'Informatik', group_name: 'TEST', name: `${prefix}CHILD`, parent_id: root.id }) });
  destination = await request('/api/folders', { method: 'POST', body: JSON.stringify({ subject: 'Informatik', group_name: 'TEST', name: `${prefix}DESTINATION` }) });
  pass('folder CRUD setup');
  await check('student read access', async () => {
    const folders = await request('/api/folders', {}, studentToken);
    if (!folders.some((folder) => folder.id === root.id)) throw new Error('student cannot read folders');
    const files = await request(`/api/files/${root.id}`, {}, studentToken);
    if (!Array.isArray(files)) throw new Error('student file read failed');
  });
  await check('student write protection for folders', async () => {
    await requestStatus('/api/folders', 403, { method: 'POST', body: JSON.stringify({ subject: 'Informatik', group_name: 'TEST', name: `${prefix}STUDENT` }) }, studentToken);
    await requestStatus(`/api/folders/${root.id}/notes`, 403, { method: 'PUT', body: JSON.stringify({ content: 'student' }) }, studentToken);
    await requestStatus(`/api/folders/${root.id}`, 403, { method: 'DELETE' }, studentToken);
  });
  await check('folder actions', async () => {
    await request(`/api/folders/${root.id}`, { method: 'PUT', body: JSON.stringify({ name: `${prefix}RENAMED` }) });
    await request(`/api/folders/${root.id}/color`, { method: 'PUT', body: JSON.stringify({ color: '#E8472A' }) });
    await request(`/api/folders/${root.id}/favorite`, { method: 'PUT' });
    await request(`/api/folders/${root.id}/deadline`, { method: 'PUT', body: JSON.stringify({ due_at: '2030-01-02' }) });
    await request(`/api/folders/${root.id}/notes`, { method: 'PUT', body: JSON.stringify({ content: prefix }) });
    await request(`/api/folders/${child.id}/move`, { method: 'PUT', body: JSON.stringify({ parent_id: destination.id }) });
    return request('/api/folders/reorder', { method: 'PUT', body: JSON.stringify({ items: [{ id: root.id, sort_order: 9 }, { id: destination.id, sort_order: 8 }] }) });
  });
  annualPlan = await request('/api/plans', { method: 'POST', body: JSON.stringify({ root_folder_id: root.id, school_year: '2026/27', start_date: '2026-08-01', end_date: '2027-07-31' }) });
  annualEntry = await request(`/api/plans/${annualPlan.id}/entries`, { method: 'POST', body: JSON.stringify({ entry_date: '2026-08-10', entry_type: 'lesson', lesson_number: '1', title: `${prefix}Jahresplanung` }) });
  annualCopy = await request(`/api/plans/entries/${annualEntry.id}/duplicate`, { method: 'POST' });
  await check('Jahresplanung und CSV', async () => {
    const loaded = await request(`/api/plans?folder_id=${root.id}&school_year=2026/27`);
    if (loaded.entries.length !== 2) throw new Error('Jahresplanungseinträge fehlen');
    const csv = await request(`/api/plans/${annualPlan.id}/export.csv`);
    if (csv.byteLength < 30) throw new Error('CSV ist leer');
  });

  const fileTypes = [
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['pdf', 'application/pdf'], ['png', 'image/png'], ['md', 'text/markdown'],
  ];
  for (const [extension, mime] of fileTypes) {
    const form = new FormData();
    form.append('folder_id', String(root.id));
    form.append('file', new Blob([`${prefix}${extension}`], { type: mime }), `${prefix}${extension}.${extension}`);
    const uploaded = await request('/api/files/upload', { method: 'POST', body: form });
    createdFiles.push(uploaded.id);
  }
  const primaryFile = await request(`/api/files/${root.id}`).then((files) => files[0]);
  await check('file search, rename, roles and sharing', async () => {
    await request(`/api/files/search?q=${encodeURIComponent(prefix)}`);
    await request(`/api/files/${primaryFile.id}`, { method: 'PUT', body: JSON.stringify({ original_name: `${prefix}RENAMED.md`, material_role: 'solution' }) });
    await request(`/api/files/${primaryFile.id}/share`, { method: 'PUT' });
    const studentFiles = await request(`/api/files/${root.id}`, {}, studentToken);
    if (!studentFiles.some((file) => file.id === primaryFile.id)) throw new Error('shared file is not visible to student');
  });
  await check('student write protection for files', async () => {
    await requestStatus(`/api/files/${primaryFile.id}`, 403, { method: 'PUT', body: JSON.stringify({ original_name: `${prefix}STUDENT.md` }) }, studentToken);
    await requestStatus(`/api/files/${primaryFile.id}/share`, 403, { method: 'PUT' }, studentToken);
    await requestStatus(`/api/files/${primaryFile.id}`, 403, { method: 'DELETE' }, studentToken);
  });
  await check('public link, deadline and ZIP', async () => {
    const publicFile = await request(`/api/files/${primaryFile.id}/public`, { method: 'PUT' });
    await request(`/api/files/public/${publicFile.public_token}`, {}, null);
    await request(`/api/files/${primaryFile.id}/deadline`, { method: 'PUT', body: JSON.stringify({ due_at: '2030-01-03' }) });
    const zip = await request(`/api/files/zip/${root.id}`);
    if (zip.byteLength < 10) throw new Error('ZIP is empty');
  });
  await check('version flow', async () => {
    await request(`/api/files/${primaryFile.id}/versions`);
    await request(`/api/files/${primaryFile.id}/edit-copy`, { method: 'POST', body: JSON.stringify({ open: false }) });
    const version = await request(`/api/files/${primaryFile.id}/versions/commit`, { method: 'POST' });
    createdFiles.push(version.id);
    const versions = await request(`/api/files/${primaryFile.id}/versions`);
    if (versions.length < 2) throw new Error('new version was not created');
  });

  exam = await request('/api/exams', { method: 'POST', body: JSON.stringify({ title: `${prefix}EXAM`, class_name: 'TEST', subject: 'Informatik', exam_date: '2030-01-04' }) });
  await request(`/api/exams/${exam.id}`, { method: 'PUT', body: JSON.stringify({ title: `${prefix}EXAM_EDITED`, class_name: 'TEST', exam_date: '2030-01-05' }) });
  pass('exam create and edit');
  await check('student write protection for schedule, exams and links', async () => {
    await requestStatus('/api/schedule', 403, { method: 'PUT', body: JSON.stringify({ __smoke: prefix }) }, studentToken);
    await requestStatus('/api/exams', 403, { method: 'POST', body: JSON.stringify({ title: `${prefix}STUDENT`, class_name: 'TEST', exam_date: '2030-01-06' }) }, studentToken);
    await requestStatus(`/api/exams/${exam.id}`, 403, { method: 'DELETE' }, studentToken);
    await requestStatus('/api/links', 403, { method: 'POST', body: JSON.stringify({ folder_id: root.id, title: prefix, url: 'https://example.com' }) }, studentToken);
  });

  originalSchedule = await request('/api/schedule');
  await request('/api/schedule', { method: 'PUT', body: JSON.stringify({ ...originalSchedule, __smoke: prefix }) });
  pass('schedule read and write');

  notebook = await request('/api/notebooks', { method: 'POST', body: JSON.stringify({ title: `${prefix}NOTEBOOK` }) });
  section = await request('/api/sections', { method: 'POST', body: JSON.stringify({ notebook_id: notebook.id, title: `${prefix}SECTION` }) });
  pageRecord = await request('/api/pages', { method: 'POST', body: JSON.stringify({ section_id: section.id, title: `${prefix}PAGE` }) });
  await request(`/api/blocks/${pageRecord.id}`, { method: 'PUT', body: JSON.stringify({ blocks: [{ type: 'text', content: { text: prefix } }] }) });
  quickNote = await request('/api/quicknotes', { method: 'POST', body: JSON.stringify({ content: `${prefix}QUICK` }) });
  pass('notebook, page, blocks and quick note');

  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Lehrer/ }).click();
  await page.locator('input[type=password]').fill(process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer');
  await page.locator('form button[type=submit]').click();
  await page.waitForTimeout(1000);
  const teacherText = await page.locator('body').innerText();
  if (!teacherText.includes('Heute')) throw new Error('Heute missing');
  if (/Terminal|Arbeitsblatt/.test(teacherText)) throw new Error('removed sections are visible');
  if (consoleErrors.length) throw new Error(`console: ${consoleErrors.join('; ')}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('lm_theme', 'dark'));
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('body').evaluate((element) => element.scrollWidth > window.innerWidth + 2)) throw new Error('mobile horizontal overflow');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${baseUrl}/?student`, { waitUntil: 'networkidle' });
  await page.locator('input[type=password]').fill(process.env.LEHRERMAPS_STUDENT_PASSWORD || 'schueler');
  await page.locator('form button[type=submit]').click();
  await page.waitForTimeout(700);
  if ((await page.locator('body').innerText()).includes('Falsches Passwort')) throw new Error('student login failed');
  await browser.close();
  pass('teacher/student UI, direct student route, mobile, dark theme and console');
} catch (error) {
  fail('smoke test', error);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (originalSchedule) await cleanup('/api/schedule', { method: 'PUT', body: JSON.stringify(originalSchedule) });
  if (quickNote) await cleanup(`/api/quicknotes/${quickNote.id}`, { method: 'DELETE' });
  if (pageRecord) await cleanup(`/api/pages/${pageRecord.id}`, { method: 'DELETE' });
  if (section) await cleanup(`/api/sections/${section.id}`, { method: 'DELETE' });
  if (notebook) await cleanup(`/api/notebooks/${notebook.id}`, { method: 'DELETE' });
  if (exam) await cleanup(`/api/exams/${exam.id}`, { method: 'DELETE' });
  if (annualCopy) await cleanup(`/api/plans/entries/${annualCopy.id}`, { method: 'DELETE' });
  if (annualEntry) await cleanup(`/api/plans/entries/${annualEntry.id}`, { method: 'DELETE' });
  if (annualPlan) await cleanup(`/api/plans/${annualPlan.id}`, { method: 'DELETE' });
  for (const id of createdFiles) await cleanup(`/api/files/${id}`, { method: 'DELETE' });
  if (root) await cleanup(`/api/folders/${root.id}`, { method: 'DELETE' });
  if (child) await cleanup(`/api/folders/${child.id}`, { method: 'DELETE' });
  if (destination) await cleanup(`/api/folders/${destination.id}`, { method: 'DELETE' });
}

console.log(JSON.stringify(results, null, 2));
if (results.some(({ status }) => status === 'FAIL')) process.exitCode = 1;
