import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEDULE_INFORMATIK_6_ONENOTE, openOneNoteWithFallback, scheduleOneNoteTarget } from '../externalApps.js';

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
