#!/usr/bin/env node
import { createRequire } from 'node:module';
import {
  CleanupStack,
  assert,
  baseUrl,
  chromePath,
  chromium,
  closeInitialAppointmentsOverlay,
  collectConsoleErrors,
  createApiClient,
  loginApi,
  loginPage,
  readDownload,
} from './e2e-helpers.mjs';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PDFDocument } = require('pdf-lib');

const prefix = `AUDIT_LEHRERMAPS_${Date.now()}_`;
const results = [];
const cleanup = new CleanupStack();
const teacher = createApiClient();
const student = createApiClient();
const anonymous = createApiClient();
let browser;
let teacherToken;
let studentToken;
let root;
let child;
let pdfFile;
let privateFile;
let annotation;
let originalPdf;
let originalSchedule;
let session;
let exam;

const pass = (name, detail = '') => results.push({ name, status: 'PASS', detail });
const fail = (name, error) => results.push({ name, status: 'FAIL', detail: error.message });

async function check(name, task) {
  try {
    const detail = await task();
    pass(name, typeof detail === 'string' ? detail : '');
  } catch (error) {
    fail(name, error);
  }
}

async function upload(folderId, name, bytes, mime) {
  const form = new FormData();
  form.append('folder_id', String(folderId));
  form.append('file', new Blob([bytes], { type: mime }), name);
  const file = await teacher.request('/api/files/upload', { method: 'POST', body: form });
  cleanup.defer(`Datei ${file.id}`, () => teacher.request(`/api/files/${file.id}`, { method: 'DELETE' }));
  return file;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function openSchedule(page) {
  const button = page.getByRole('button', { name: /^Stundenplan$/i }).last();
  await button.waitFor();
  await button.click();
  await page.locator('.lm-schedule-grid').waitFor();
}

async function seed() {
  teacherToken = await loginApi('teacher', process.env.LEHRERMAPS_TEACHER_PASSWORD);
  studentToken = await loginApi('student', process.env.LEHRERMAPS_STUDENT_PASSWORD);
  teacher.setToken(teacherToken);
  student.setToken(studentToken);

  root = await teacher.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ subject: 'spanisch', group_name: 'TEST', name: `${prefix}ROOT` }),
  });
  cleanup.defer(`Ordner ${root.id}`, () => teacher.request(`/api/folders/${root.id}`, { method: 'DELETE' }));
  child = await teacher.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ subject: 'spanisch', group_name: 'TEST', name: `${prefix}CHILD`, parent_id: root.id }),
  });
  cleanup.defer(`Unterordner ${child.id}`, () => teacher.request(`/api/folders/${child.id}`, { method: 'DELETE' }));

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  page.drawText(`${prefix}PDF`, { x: 50, y: 790, size: 16 });
  originalPdf = Buffer.from(await pdf.save());
  pdfFile = await upload(root.id, `${prefix}MATERIAL.pdf`, originalPdf, 'application/pdf');
  privateFile = await upload(root.id, `${prefix}PRIVATE.txt`, Buffer.from(`${prefix}PRIVATE`), 'text/plain');

  originalSchedule = await teacher.request('/api/schedule');
  cleanup.defer('Stundenplan wiederherstellen', () => teacher.request('/api/schedule', {
    method: 'PUT', body: JSON.stringify(originalSchedule),
  }));
}

try {
  await check('Erreichbarkeit und Login-Validierung', async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert(health.ok, `/api/health -> ${health.status}`);
    await anonymous.request('/api/login', {
      method: 'POST', body: JSON.stringify({ password: `${prefix}FALSCH` }), expectedStatus: 401, token: null,
    });
    await anonymous.request('/api/login-student', {
      method: 'POST', body: JSON.stringify({ password: `${prefix}FALSCH` }), expectedStatus: 401, token: null,
    });
    await anonymous.request('/api/folders', { expectedStatus: 401, token: null });
  });

  await seed();
  pass('Isolierte AUDIT-Testdaten angelegt', prefix);

  await check('Ordner: Verschachtelung, Suche und Schüler-Schreibschutz', async () => {
    const folders = await teacher.request('/api/folders');
    assert(folders.some(({ id, parent_id }) => id === child.id && Number(parent_id) === Number(root.id)), 'Unterordner fehlt oder ist falsch verschachtelt');
    await teacher.request(`/api/folders/${child.id}`, { method: 'PUT', body: JSON.stringify({ name: `${prefix}CHILD_EDITED` }) });
    await student.request('/api/folders', { method: 'POST', body: JSON.stringify({ name: `${prefix}STUDENT` }), expectedStatus: 403 });
    await student.request(`/api/folders/${root.id}/notes`, { method: 'PUT', body: JSON.stringify({ content: prefix }), expectedStatus: 403 });
  });

  await check('Dateien: Vorschau, Suche, Rolle, Freigabe, Timer, ZIP und Link', async () => {
    const preview = await teacher.request(`/api/files/view/${pdfFile.id}`);
    assert(preview.byteLength > 100, 'PDF-Vorschau ist leer');
    const search = await teacher.request(`/api/files/search?q=${encodeURIComponent(prefix)}`);
    assert(JSON.stringify(search).includes(pdfFile.original_name), 'PDF fehlt in der Suche');
    await teacher.request(`/api/files/${pdfFile.id}`, { method: 'PUT', body: JSON.stringify({ material_role: 'work' }) });
    await teacher.request(`/api/files/${pdfFile.id}/timer`, { method: 'PUT', body: JSON.stringify({ timer_minutes: 3 }) });
    await teacher.request(`/api/files/${pdfFile.id}/share`, { method: 'PUT' });
    const studentFiles = await student.request(`/api/files/${root.id}`);
    assert(studentFiles.some(({ id }) => id === pdfFile.id), 'Freigegebene PDF fehlt in der Schüleransicht');
    assert(!studentFiles.some(({ id }) => id === privateFile.id), 'Nicht freigegebene Datei ist für Schüler sichtbar');
    const zip = await teacher.request(`/api/files/zip/${root.id}`);
    assert(zip.byteLength > 20, 'ZIP ist leer');
    const link = await teacher.request('/api/links', {
      method: 'POST', body: JSON.stringify({ folder_id: root.id, title: `${prefix}LINK`, url: 'https://example.com/audit' }),
    });
    cleanup.defer(`Link ${link.id}`, () => teacher.request(`/api/links/${link.id}`, { method: 'DELETE' }));
    const links = await teacher.request(`/api/links/${root.id}`);
    assert(links.some(({ id }) => id === link.id), 'Link wurde nicht geladen');
  });

  await check('Dateiversionen und Schüler-Schreibschutz', async () => {
    await teacher.request(`/api/files/${privateFile.id}/edit-copy`, { method: 'POST', body: JSON.stringify({ open: false }) });
    const version = await teacher.request(`/api/files/${privateFile.id}/versions/commit`, { method: 'POST' });
    cleanup.defer(`Version ${version.id}`, () => teacher.request(`/api/files/${version.id}`, { method: 'DELETE' }));
    const versions = await teacher.request(`/api/files/${privateFile.id}/versions`);
    assert(versions.length >= 2, 'Neue Dateiversion fehlt');
    await student.request(`/api/files/${pdfFile.id}`, { method: 'PUT', body: JSON.stringify({ original_name: `${prefix}HACK.pdf` }), expectedStatus: 403 });
    await student.request(`/api/files/${pdfFile.id}`, { method: 'DELETE', expectedStatus: 403 });
    await student.request('/api/links', { method: 'POST', body: JSON.stringify({ folder_id: root.id, title: prefix, url: 'https://example.com' }), expectedStatus: 403 });
  });

  await check('Stundenplan: Backup, Zellen, Pausen, Räume und gleiche Fachfarben', async () => {
    const color = '#2255AA';
    const auditSchedule = {
      ...originalSchedule,
      '0-0': { label: `${prefix}FACH`, room: 'AUDIT-R101', color },
      '1-0': { label: `${prefix}FACH`, room: 'AUDIT-R102', color },
      'break-fruehstueck': {
        ...(originalSchedule['break-fruehstueck'] || {}),
        0: { label: `${prefix}PAUSE`, room: 'Hof', color: '#A16207' },
      },
      'break-mittag': {
        ...(originalSchedule['break-mittag'] || {}),
        1: { label: `${prefix}MIPA`, room: 'Mensa', color: '#047857' },
      },
    };
    await teacher.request('/api/schedule', { method: 'PUT', body: JSON.stringify(auditSchedule) });
    const loaded = await teacher.request('/api/schedule');
    assert(loaded['0-0']?.room === 'AUDIT-R101', 'Raum wurde nicht gespeichert');
    assert(loaded['0-0']?.color === loaded['1-0']?.color, 'Identische Fachfarben gingen verloren');
    assert(loaded['break-fruehstueck']?.[0]?.label === `${prefix}PAUSE`, 'Pause wurde nicht gespeichert');
    assert(loaded['break-mittag']?.[1]?.label === `${prefix}MIPA`, 'MiPa wurde nicht gespeichert');
    await student.request('/api/schedule', { method: 'PUT', body: JSON.stringify(auditSchedule), expectedStatus: 403 });
  });

  await check('Termine: Erstellen, Bearbeiten, Löschen und Rechte', async () => {
    exam = await teacher.request('/api/exams', {
      method: 'POST',
      body: JSON.stringify({ title: `${prefix}TERMIN`, class_name: 'AUDIT', subject: 'Informatik', exam_date: '2030-02-01', exam_time: '10:00', notes: prefix }),
    });
    cleanup.defer(`Termin ${exam.id}`, () => teacher.request(`/api/exams/${exam.id}`, { method: 'DELETE' }));
    exam = await teacher.request(`/api/exams/${exam.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: `${prefix}TERMIN_EDITED`, class_name: 'AUDIT', subject: 'Informatik', exam_date: '2030-02-02', exam_time: '11:00', notes: prefix }),
    });
    const transient = await teacher.request('/api/exams', {
      method: 'POST', body: JSON.stringify({ title: `${prefix}DELETE`, class_name: 'AUDIT', exam_date: '2030-02-03' }),
    });
    await teacher.request(`/api/exams/${transient.id}`, { method: 'DELETE' });
    assert(!(await teacher.request('/api/exams')).some(({ id }) => id === transient.id), 'Gelöschter Termin ist noch vorhanden');
    await student.request('/api/exams', { method: 'POST', body: JSON.stringify({ title: prefix, class_name: 'AUDIT', exam_date: '2030-02-04' }), expectedStatus: 403 });
  });

  await check('Lehrerhilfe: Sitzung, Phasen, Timer, Canvas, Sichtbarkeit und Projektion', async () => {
    session = await teacher.request('/api/lesson-sessions', {
      method: 'POST',
      body: JSON.stringify({
        folder_id: root.id,
        title: `${prefix}STUNDE`,
        class_name: 'AUDIT',
        subject: 'Informatik',
        learning_goal: `${prefix}LERNZIEL`,
        teacher_notes: `${prefix}PRIVATE_NOTES`,
        phases: [{ title: `${prefix}PHASE`, duration_seconds: 3723, student_instruction: `${prefix}AUFTRAG` }],
      }),
    });
    cleanup.defer(`Lehrerhilfe-Sitzung ${session.id}`, () => teacher.request(`/api/lesson-sessions/${session.id}`, { method: 'DELETE' }));
    const phase = session.phases[0];
    const timer = await teacher.request(`/api/lesson-phases/${phase.id}`, {
      method: 'PATCH', body: JSON.stringify({ timer_state: 'paused', timer_remaining_seconds: 3723 }),
    });
    assert(Number(timer.timer_remaining_seconds) === 3723, 'H/M/S-Timerwert wurde nicht gespeichert');
    const privateElement = await teacher.request(`/api/lesson-sessions/${session.id}/canvas`, {
      method: 'POST', body: JSON.stringify({ phase_id: phase.id, type: 'text', content: { text: `${prefix}PRIVATE` }, visibility: 'private' }),
    });
    const displayedElement = await teacher.request(`/api/lesson-sessions/${session.id}/canvas`, {
      method: 'POST', body: JSON.stringify({ phase_id: phase.id, type: 'text', content: { text: `${prefix}DISPLAYED` }, visibility: 'displayed' }),
    });
    await teacher.request(`/api/lesson-canvas-elements/${displayedElement.id}`, {
      method: 'PATCH', body: JSON.stringify({ position: { x: 10, y: 20 }, style: { color: '#2255AA' } }),
    });
    await teacher.request(`/api/lesson-phases/${phase.id}/visibility`, {
      method: 'PUT', body: JSON.stringify({ file_id: pdfFile.id, visibility: 'displayed', position: 0 }),
    });
    const display = await teacher.request(`/api/lesson-sessions/${session.id}/display-session`, { method: 'POST' });
    await teacher.request(`/api/display/${display.token}`, { method: 'PATCH', body: JSON.stringify({ active_phase_id: phase.id }) });
    const projected = await anonymous.request(`/api/display/${display.token}`, { token: null });
    const projectedIds = projected.canvas?.elements?.map(({ id }) => id) || [];
    assert(projectedIds.includes(displayedElement.id), 'Freigegebenes Canvas-Element fehlt in der Projektion');
    assert(!projectedIds.includes(privateElement.id), 'Privates Canvas-Element ist in der Projektion sichtbar');
    assert(projected.materials.some(({ original_name }) => original_name === pdfFile.original_name), 'Freigegebenes Material fehlt in der Projektion');
    await student.request('/api/lesson-sessions', { method: 'POST', body: JSON.stringify({ title: prefix }), expectedStatus: 403 });
  });

  await check('Lehrerhilfe: private Sitzungen sind vom Schüler isoliert', async () => {
    await student.request('/api/lesson-sessions', { expectedStatus: 403 });
    await student.request(`/api/lesson-sessions/${session.id}`, { expectedStatus: 403 });
  });

  await check('PDF-Annotationen: CRUD, Verlauf und Schülerisolation', async () => {
    annotation = await teacher.request(`/api/files/${pdfFile.id}/annotations`, {
      method: 'POST',
      body: JSON.stringify({
        page_number: 1,
        type: 'ink',
        data: { marker: prefix, points: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.8 }] },
        style: { color: '#E11D48', opacity: 0.9, strokeWidth: 0.01 },
      }),
    });
    cleanup.defer(`Annotation ${annotation.id}`, () => teacher.request(`/api/document-annotations/${annotation.id}`, { method: 'DELETE' }));
    annotation = await teacher.request(`/api/document-annotations/${annotation.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ style: { color: '#2563EB', opacity: 0.8, strokeWidth: 0.012 } }),
    });
    const annotations = await teacher.request(`/api/files/${pdfFile.id}/annotations`);
    assert(annotations.some(({ id, data }) => id === annotation.id && data.marker === prefix), 'Annotation wurde nicht geladen');
    const history = await teacher.request(`/api/files/${pdfFile.id}/annotation-history`);
    assert(history.some(({ annotation_id, action }) => Number(annotation_id) === Number(annotation.id) && action === 'update'), 'Annotationsverlauf enthält das Update nicht');
    await student.request(`/api/files/${pdfFile.id}/annotations`, { expectedStatus: 403 });
    await student.request(`/api/files/${pdfFile.id}/annotation-history`, { expectedStatus: 403 });
  });

  await check('Notizbücher: CRUD, Blöcke, Quick Notes, Suche und Nutzerisolation', async () => {
    let notebook = await teacher.request('/api/notebooks', { method: 'POST', body: JSON.stringify({ title: `${prefix}NOTEBOOK`, color: '#2255AA' }) });
    cleanup.defer(`Notizbuch ${notebook.id}`, () => teacher.request(`/api/notebooks/${notebook.id}`, { method: 'DELETE' }));
    notebook = await teacher.request(`/api/notebooks/${notebook.id}`, { method: 'PATCH', body: JSON.stringify({ title: `${prefix}NOTEBOOK_EDITED` }) });
    let section = await teacher.request('/api/sections', { method: 'POST', body: JSON.stringify({ notebook_id: notebook.id, title: `${prefix}SECTION` }) });
    section = await teacher.request(`/api/sections/${section.id}`, { method: 'PATCH', body: JSON.stringify({ title: `${prefix}SECTION_EDITED` }) });
    let pageRecord = await teacher.request('/api/pages', { method: 'POST', body: JSON.stringify({ section_id: section.id, title: `${prefix}PAGE` }) });
    pageRecord = await teacher.request(`/api/pages/${pageRecord.id}`, { method: 'PATCH', body: JSON.stringify({ title: `${prefix}PAGE_EDITED` }) });
    const blocks = await teacher.request(`/api/blocks/${pageRecord.id}`, {
      method: 'PUT', body: JSON.stringify({ blocks: [{ type: 'text', content: { text: `${prefix}BLOCK` }, pos_x: 5, pos_y: 10, width: 420 }] }),
    });
    assert(blocks.length === 1, 'Notizblock wurde nicht gespeichert');
    const quick = await teacher.request('/api/quicknotes', { method: 'POST', body: JSON.stringify({ content: `${prefix}QUICK` }) });
    cleanup.defer(`Quick Note ${quick.id}`, () => teacher.request(`/api/quicknotes/${quick.id}`, { method: 'DELETE' }));
    const search = await teacher.request(`/api/search?q=${encodeURIComponent(prefix)}`);
    assert(JSON.stringify(search).includes(prefix), 'Notizinhalt fehlt in der Suche');

    const studentNotebook = await student.request('/api/notebooks', { method: 'POST', body: JSON.stringify({ title: `${prefix}STUDENT_NOTEBOOK` }) });
    cleanup.defer(`Schüler-Notizbuch ${studentNotebook.id}`, () => student.request(`/api/notebooks/${studentNotebook.id}`, { method: 'DELETE' }));
    const teacherNotebooks = await teacher.request('/api/notebooks');
    const studentNotebooks = await student.request('/api/notebooks');
    assert(!teacherNotebooks.some(({ id }) => id === studentNotebook.id), 'Schüler-Notizbuch ist für Lehrer sichtbar');
    assert(!studentNotebooks.some(({ id }) => id === notebook.id), 'Lehrer-Notizbuch ist für Schüler sichtbar');
  });

  await check('KI: nur Status- und Authentifizierungspfad', async () => {
    const status = await teacher.request('/api/ai/status');
    assert(status && typeof status === 'object', 'KI-Status ist ungültig');
    await anonymous.request('/api/ai/status', { expectedStatus: 401, token: null });
  });

  browser = await chromium.launch({ headless: true, executablePath: chromePath });

  await check('Termine-Overlay: Escape entfernt die Überlagerung', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const consoleCapture = collectConsoleErrors(page);
    try {
      await loginPage(page, { role: 'teacher', token: teacherToken, closeAppointments: false });
      await page.locator('.eb-board').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.eb-board').waitFor({ state: 'detached' });
      consoleCapture.assertEmpty('Termine-Overlay');
    } finally {
      consoleCapture.stop();
      await context.close();
    }
  });

  await check('Stundenplan: Wochentage auf iPhone, iPad und Desktop plus ICS', async () => {
    const viewports = [
      { name: 'iPhone', width: 390, height: 844, mobile: true },
      { name: 'iPad', width: 768, height: 1024, mobile: true },
      { name: 'Desktop', width: 1440, height: 900, mobile: false },
    ];
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const consoleCapture = collectConsoleErrors(page);
      try {
        await loginPage(page, { role: 'teacher', token: teacherToken });
        await openSchedule(page);
        const days = await page.locator('.lm-schedule-day').allTextContents();
        assert(['MO', 'DI', 'MI', 'DO', 'FR'].every((day) => days.map((value) => value.trim().toUpperCase()).includes(day)), `${viewport.name}: Wochentage fehlen (${days.join(', ')})`);
        const clipped = await page.locator('.lm-schedule-day').evaluateAll((nodes) => nodes.filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width <= 0 || rect.right > window.innerWidth + 2;
        }).map((node) => node.textContent?.trim()));
        assert(!clipped.length, `${viewport.name}: Wochentage abgeschnitten (${clipped.join(', ')})`);
        if (!viewport.mobile) {
          const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: /Als \.ics exportieren/i }).click(),
          ]);
          const ics = (await readDownload(download)).toString('utf8');
          assert(download.suggestedFilename().endsWith('.ics'), 'ICS-Dateiname fehlt');
          assert(ics.includes('BEGIN:VCALENDAR') && ics.includes(`${prefix}FACH`), 'ICS enthält den AUDIT-Termin nicht');
        }
        consoleCapture.assertEmpty(`${viewport.name} Stundenplan`);
      } finally {
        consoleCapture.stop();
        await context.close();
      }
    }
  });

  await check('PDF: Vorschau und gültiger annotierter Export', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const consoleCapture = collectConsoleErrors(page);
    try {
      await loginPage(page, { role: 'teacher', token: teacherToken });
      const folderButton = page.locator('button').filter({ hasText: new RegExp(escapeRegExp(root.name)) }).last();
      await folderButton.waitFor();
      await folderButton.click();
      await page.getByText(pdfFile.original_name, { exact: true }).last().click();
      await page.locator('.lm-pdf-annotation-viewer').waitFor({ timeout: 15000 });
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /^Export$/ }).click(),
      ]);
      const exported = await readDownload(download);
      assert(download.suggestedFilename().endsWith('-annotated.pdf'), 'Annotierter PDF-Dateiname ist falsch');
      assert(exported.subarray(0, 5).toString() === '%PDF-', 'Export ist keine PDF-Datei');
      const parsed = await PDFDocument.load(exported);
      assert(parsed.getPageCount() === 1, 'Annotierter Export hat eine falsche Seitenzahl');
      assert(exported.byteLength > originalPdf.byteLength, 'Annotierter Export enthält offenbar keine eingebettete Annotation');
      consoleCapture.assertEmpty('PDF-Export');
    } finally {
      consoleCapture.stop();
      await context.close();
    }
  });

  await check('Schüleransicht: keine Lehrkraft-Aktionen und keine private Datei', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const consoleCapture = collectConsoleErrors(page);
    try {
      await loginPage(page, { role: 'student', token: studentToken });
      const text = await page.locator('body').innerText();
      assert(!text.includes(privateFile.original_name), 'Private Datei ist in der Schüleransicht sichtbar');
      assert(!/Neuer Ordner|Datei hochladen|Upload/i.test(text), 'Lehrkraft-Aktion ist in der Schüleransicht sichtbar');
      const folders = page.getByRole('button', { name: /Ordner|Fächer/i }).last();
      if (await folders.count()) {
        await folders.click();
        assert(await page.locator('.lm-drawer').count() === 1, 'Responsive Schülernavigation öffnet nicht');
      }
      consoleCapture.assertEmpty('Schüleransicht');
    } finally {
      consoleCapture.stop();
      await context.close();
    }
  });
} catch (error) {
  fail('Audit-Setup oder Laufzeit', error);
} finally {
  if (browser) await browser.close().catch(() => {});
  const cleanupFailures = await cleanup.run();
  for (const detail of cleanupFailures) fail('Cleanup', new Error(detail));
}

console.log(JSON.stringify({ prefix, results }, null, 2));
if (results.some(({ status }) => status === 'FAIL')) process.exitCode = 1;
