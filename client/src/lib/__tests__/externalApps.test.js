import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEDULE_INFORMATIK_6_ONENOTE,
  SCHEDULE_SPANISCH_10_ONENOTE,
  SCHEDULE_SPANISCH_Q2_ONENOTE,
  SCHEDULE_WP_INFORMATIK_8_ONENOTE,
  openOneNoteWithFallback,
  scheduleOneNoteTarget,
} from '../externalApps.js';

test('maps Informatik 6d and 6f labels to the schedule OneNote target', () => {
  assert.equal(scheduleOneNoteTarget(' Informatik 6f. '), SCHEDULE_INFORMATIK_6_ONENOTE);
  assert.equal(scheduleOneNoteTarget('INFORMATIK   6d'), SCHEDULE_INFORMATIK_6_ONENOTE);
  assert.match(SCHEDULE_INFORMATIK_6_ONENOTE.nativeUrl, /^onenote:/);
  assert.match(SCHEDULE_INFORMATIK_6_ONENOTE.webUrl, /^https:\/\/onedrive\.live\.com\/view\.aspx\?/);
  assert.equal(SCHEDULE_INFORMATIK_6_ONENOTE.nativeUrl, 'onenote:https://d.docs.live.net/D4ACB07AA3091664/Dokumente/Informatik%20Jgst%206/26-27-IF-6/0.%20Grundlagen.one#Inhaltsverzeichnis&section-id={167BE046-557E-4F49-87A3-81561BF72359}&page-id={CC51E7DE-5DBA-2A43-ABFE-52846D0BBE24}&end');
});

test('uses one delayed web fallback only while the native attempt keeps the page visible', () => {
  let delayed; const opened = [];
  const listeners = {};
  const windowRef = { location: {}, setTimeout: (fn) => { delayed = fn; return 1; }, clearTimeout: () => {}, open: (...args) => opened.push(args), addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: () => {} };
  const documentRef = { visibilityState: 'visible', addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: () => {} };
  openOneNoteWithFallback(SCHEDULE_INFORMATIK_6_ONENOTE, { windowRef, documentRef, delay: 1 });
  assert.equal(windowRef.location.href, SCHEDULE_INFORMATIK_6_ONENOTE.nativeUrl);
  delayed();
  assert.deepEqual(opened, [[SCHEDULE_INFORMATIK_6_ONENOTE.webUrl, '_blank', 'noopener,noreferrer']]);
});

test('cancels the fallback after the native handler hides the page', () => {
  let delayed; const opened = []; const listeners = {};
  const windowRef = { location: {}, setTimeout: (fn) => { delayed = fn; return 1; }, clearTimeout: () => {}, open: (...args) => opened.push(args), addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: () => {} };
  const documentRef = { visibilityState: 'visible', addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: () => {} };
  openOneNoteWithFallback(SCHEDULE_INFORMATIK_6_ONENOTE, { windowRef, documentRef });
  documentRef.visibilityState = 'hidden'; listeners.visibilitychange({ type: 'visibilitychange' }); delayed();
  assert.deepEqual(opened, []);
});

test('does not map unrelated schedule labels', () => {
  assert.equal(scheduleOneNoteTarget('Informatik 6e.'), null);
  assert.equal(scheduleOneNoteTarget('Mathematik 6f.'), null);
});

test('maps Spanisch 10bdf to its exact OneNote target', () => {
  assert.equal(scheduleOneNoteTarget('  SPANISCH   10bdf. '), SCHEDULE_SPANISCH_10_ONENOTE);
  assert.equal(SCHEDULE_SPANISCH_10_ONENOTE.nativeUrl, 'onenote:https://d.docs.live.net/d4acb07aa3091664/Dokumente/Spanisch%2010/26-27-S-10/Unidad%201.one#Inhaltsverzeichnis&section-id={B28816B3-D30F-BE4A-A956-E0D146C3AA7E}&page-id={61FF38CE-96F6-7847-AC4B-8F41F1A6ACF7}&end');
  assert.match(SCHEDULE_SPANISCH_10_ONENOTE.webUrl, /^https:\/\/onedrive\.live\.com\/view\.aspx\?/);
  assert.equal(scheduleOneNoteTarget('Spanisch 10bde'), null);
});

test('maps Spanisch Q2 to its exact OneNote target', () => {
  assert.equal(scheduleOneNoteTarget('  SPANISCH   Q2. '), SCHEDULE_SPANISCH_Q2_ONENOTE);
  assert.equal(SCHEDULE_SPANISCH_Q2_ONENOTE.nativeUrl, 'onenote:https://d.docs.live.net/D4ACB07AA3091664/Dokumente/Q2%20Español/26-27-S-Q2/UV5-Latinoamérica%20-%20retos%20y%20oportunidades%20de%20la%20diversidad%20étnica.one#Inhaltsverzeichnis&section-id={E2605677-E8C1-0843-A305-7ABB9497CED9}&page-id={21AB4A37-E55A-CB43-A823-445FB1687B86}&end');
  assert.equal(SCHEDULE_SPANISCH_Q2_ONENOTE.webUrl, 'https://onedrive.live.com/view.aspx?resid=D4ACB07AA3091664%21575&id=documents&wd=target%2826-27-S-Q2%2FUV5-Latinoam%C3%A9rica%20-%20retos%20y%20oportunidades%20de%20la%20diversidad%20%C3%A9tnica.one%7CE2605677-E8C1-0843-A305-7ABB9497CED9%2FInhaltsverzeichnis%7C21AB4A37-E55A-CB43-A823-445FB1687B86%2F%29&wdpartid={466DE105-269A-0249-B95A-3D2850F8A14E}{1}&wdsectionfileid=D4ACB07AA3091664!sc15d114dbb6d4fa2b891646ae5656c88&end');
});

test('maps WP Informatik 8abcdef to its exact OneNote target', () => {
  assert.equal(scheduleOneNoteTarget(' WP   Informatik  8abcdef. '), SCHEDULE_WP_INFORMATIK_8_ONENOTE);
  assert.equal(SCHEDULE_WP_INFORMATIK_8_ONENOTE.nativeUrl, 'onenote:https://d.docs.live.net/d4acb07aa3091664/Dokumente/WP8-Informatik/26-27-IF-WP8/Kapitel5-Automaten.one#Inhaltsverzeichnis&section-id={B75DA203-AB73-BE4A-91E3-C61A7FD385E0}&page-id={D99C7E7E-7D6C-5D4A-A26B-E39347862BF6}&end');
  assert.equal(SCHEDULE_WP_INFORMATIK_8_ONENOTE.webUrl, 'https://onedrive.live.com/view.aspx?resid=D4ACB07AA3091664%21scac53b33955c4c9989ae58fe8044acdf&id=documents&wd=target%2826-27-IF-WP8%2FKapitel5-Automaten.one%7CB75DA203-AB73-BE4A-91E3-C61A7FD385E0%2FInhaltsverzeichnis%7CD99C7E7E-7D6C-5D4A-A26B-E39347862BF6%2F%29&wdpartid={076C0CA6-4875-0B47-974C-99D510A3C3EF}{1}&wdsectionfileid=D4ACB07AA3091664!s7404bffcc52c4da988c4734f595a550c&end');
});
