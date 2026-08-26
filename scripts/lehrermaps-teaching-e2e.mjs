#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const serverRequire = createRequire(new URL('../server/package.json', import.meta.url));
const { Document, Packer, Paragraph } = serverRequire('docx');

const baseUrl = process.env.LEHRERMAPS_URL || 'http://localhost:8090';
const apiBaseUrl = process.env.LEHRERMAPS_API_URL || (new URL(baseUrl).port === '8090' ? 'http://localhost:3001' : baseUrl);
const prefix = `TEST_LEHRERMAPS_E2E_${Date.now()}_`;
const password = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';
let token;
let folder;
let lessonSession;
const files = [];
let browser;
let page;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('json') ? await response.json() : await response.arrayBuffer();
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function upload(name, bytes, mime) {
  const form = new FormData();
  form.append('folder_id', String(folder.id));
  form.append('file', new Blob([bytes], { type: mime }), name);
  const file = await request('/api/files/upload', { method: 'POST', body: form });
  files.push(file.id);
  return file;
}

async function dismissInitialExamBoard() {
  const board = page.locator('.eb-board');
  if (!(await board.count())) return;

  const dismiss = page.getByRole('button', { name: /Weiter zu LehrerMaps/i });
  if (await dismiss.count()) await dismiss.first().click();
  else await page.keyboard.press('Escape');

  await board.waitFor({ state: 'hidden', timeout: 3000 });
}

try {
  token = (await request('/api/login', { method: 'POST', body: JSON.stringify({ password }) })).token;
  folder = await request('/api/folders', { method: 'POST', body: JSON.stringify({ subject: 'spanisch', group_name: 'TEST', name: `${prefix}UNTERRICHT` }) });
  const pdfDocument = await PDFDocument.create();
  pdfDocument.addPage([300, 200]);
  const pdf = await pdfDocument.save();
  const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('LehrerMaps E2E')] }] }));
  const pdfFile = await upload(`${prefix}MATERIAL.pdf`, pdf, 'application/pdf');
  const docxFile = await upload(`${prefix}MATERIAL.docx`, docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  lessonSession = await request('/api/lesson-sessions', {
    method: 'POST',
    body: JSON.stringify({
      folder_id: folder.id,
      title: `${prefix}UNTERRICHT`,
      subject: folder.subject,
      class_name: folder.group_name,
      learning_goal: 'LehrerMaps E2E',
      phases: [{ title: 'Einstieg', duration_seconds: 300, student_instruction: 'Start' }],
    }),
  });

  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('lm_token', value), token);
  await page.reload({ waitUntil: 'networkidle' });
  await dismissInitialExamBoard();
  await page.locator('button').filter({ hasText: folder.name }).last().evaluate((button) => button.click());
  const tabs = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()).filter((text) => ['Jahresplanung', 'Dateien', 'Notizen'].includes(text)));
  if (tabs.slice(0, 3).join('|') !== 'Jahresplanung|Dateien|Notizen') throw new Error(`tab order: ${tabs.join('|')}`);
  await page.getByRole('button', { name: /Stunde zeigen/ }).evaluate((button) => button.click());
  await page.getByText('Lehrerhilfe').last().waitFor();
  await page.getByText(pdfFile.original_name, { exact: true }).last().waitFor();
  await page.getByText(docxFile.original_name, { exact: true }).last().waitFor();
  await page.getByText(pdfFile.original_name, { exact: true }).last().click();
  await page.locator('.lm-pdf-annotation-viewer').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.lm-pdf-page canvas').waitFor({ state: 'visible', timeout: 10000 });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  if (await page.locator('.lm-teaching-mode').count()) throw new Error('Escape did not close teaching mode');
  console.log(JSON.stringify({ status: 'PASS', checks: ['tab order', 'Stunde zeigen', 'PDF preview', 'DOCX preview', 'close button via Escape'] }, null, 2));
} catch (error) {
  const bodyText = typeof page !== 'undefined' && page ? await page.locator('body').innerText().catch(() => '') : '';
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, body: bodyText.slice(0, 1200) }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const id of files) await request(`/api/files/${id}`, { method: 'DELETE' }).catch(() => {});
  if (lessonSession) await request(`/api/lesson-sessions/${lessonSession.id}`, { method: 'DELETE' }).catch(() => {});
  if (folder) await request(`/api/folders/${folder.id}`, { method: 'DELETE' }).catch(() => {});
}
