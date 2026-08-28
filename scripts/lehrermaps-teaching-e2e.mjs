#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { chromium } = require('playwright');
const serverRequire = createRequire(new URL('../server/package.json', import.meta.url));
const { Document, Packer, Paragraph } = serverRequire('docx');

const baseUrl = process.env.LEHRERMAPS_URL || 'http://localhost:8090';
const apiBaseUrl = process.env.LEHRERMAPS_API_URL || (new URL(baseUrl).port === '8090' ? 'http://localhost:3001' : baseUrl);
const prefix = `TEST_LEHRERMAPS_E2E_${Date.now()}_`;
const password = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';
let token;
let rootFolder;
let folder;
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

try {
  token = (await request('/api/login', { method: 'POST', body: JSON.stringify({ password }) })).token;
  rootFolder = await request('/api/folders', { method: 'POST', body: JSON.stringify({ subject: 'spanisch', group_name: 'TEST', name: `${prefix}UNTERRICHT` }) });
  folder = await request('/api/folders', { method: 'POST', body: JSON.stringify({ subject: 'spanisch', group_name: 'TEST', name: `${prefix}STUNDE`, parent_id: rootFolder.id }) });
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('LehrerMaps E2E')] }] }));
  const pdfFile = await upload(`${prefix}MATERIAL.pdf`, pdf, 'application/pdf');
  const docxFile = await upload(`${prefix}MATERIAL.docx`, docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => localStorage.setItem('lm_token', value), token);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('button').filter({ hasText: rootFolder.name }).last().evaluate((button) => button.click());
  await page.getByRole('button', { name: folder.name, exact: true }).last().waitFor();
  if (await page.getByText(pdfFile.original_name, { exact: true }).count()) throw new Error('nested files are visible before selecting their folder');
  await page.getByRole('button', { name: folder.name, exact: true }).last().evaluate((button) => button.click());
  const tabs = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()).filter((text) => ['Jahresplanung', 'Dateien', 'Notizen'].includes(text)));
  if (tabs.slice(0, 3).join('|') !== 'Jahresplanung|Dateien|Notizen') throw new Error(`tab order: ${tabs.join('|')}`);
  await page.getByRole('button', { name: /Stunde zeigen/ }).evaluate((button) => button.click());
  await page.getByText('Lehrerhilfe').last().waitFor();
  await page.getByText(pdfFile.original_name, { exact: true }).last().waitFor();
  await page.getByText(docxFile.original_name, { exact: true }).last().waitFor();
  await page.getByText(pdfFile.original_name, { exact: true }).last().click();
  if (await page.locator('iframe').count() < 1) throw new Error('PDF preview iframe missing');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  if (await page.getByText('Lehrerhilfe').last().count()) throw new Error('Escape did not close teaching mode');
  console.log(JSON.stringify({ status: 'PASS', checks: ['tab order', 'Stunde zeigen', 'PDF preview', 'DOCX preview', 'close button via Escape'] }, null, 2));
} catch (error) {
  const bodyText = typeof page !== 'undefined' && page ? await page.locator('body').innerText().catch(() => '') : '';
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, body: bodyText.slice(0, 1200) }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const id of files) await request(`/api/files/${id}`, { method: 'DELETE' }).catch(() => {});
  if (folder) await request(`/api/folders/${folder.id}`, { method: 'DELETE' }).catch(() => {});
  if (rootFolder) await request(`/api/folders/${rootFolder.id}`, { method: 'DELETE' }).catch(() => {});
}
