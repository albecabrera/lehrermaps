#!/usr/bin/env node

import assert from 'node:assert/strict';
import { PendingSyncQueue } from '../client/src/lib/pendingSync.js';
import { createRichTextPending, isNewerRichTextPending, isPersistedPageId, readRichText, readRichTextState } from '../client/src/lib/onenotePersistence.js';

function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key), data };
}

function scheduler() {
  const jobs = [];
  return {
    schedule: (callback) => { jobs.push(callback); return jobs.length - 1; },
    cancel: () => {},
    async runNext() { const job = jobs.shift(); if (job) { job(); await new Promise((resolve) => setImmediate(resolve)); } },
  };
}

assert.equal(isPersistedPageId(12), true);
assert.equal(isPersistedPageId('12'), true);
assert.equal(isPersistedPageId('onenote_local'), false, 'temporary page IDs are never sent to the API');
assert.equal(readRichText([{ type: 'rich_text', content: JSON.stringify({ html: '<p>Saved</p>' }) }]), '<p>Saved</p>');
assert.equal(readRichText([{ type: 'rich_text', content: '{broken' }]), '', 'corrupt stored block content is safe to read');
assert.deepEqual(readRichTextState([{ type: 'rich_text', content: JSON.stringify({ html: '<p>Saved</p>' }), updatedAt: '2026-09-01T10:00:00.000Z' }]), { html: '<p>Saved</p>', updatedAt: '2026-09-01T10:00:00.000Z' });

const newerPendingLocal = storage();
const newerPendingClock = scheduler();
let newerPendingSaved = false;
newerPendingLocal.setItem('lm_editor_rich_pending:12', JSON.stringify({ value: '<p>New local edit</p>', updatedAt: '2026-09-01T10:00:01.000Z' }));
const newerPendingQueue = new PendingSyncQueue({
  storage: newerPendingLocal,
  storageKey: 'lm_editor_rich_pending:12',
  load: async () => ({ html: '<p>Older backend edit</p>', updatedAt: '2026-09-01T10:00:00.000Z' }),
  save: async (html) => { newerPendingSaved = true; return { html }; },
  confirm: (response, html) => response?.html === html,
  isBackendEmpty: (value) => !value.html,
  isValid: (value) => typeof value === 'string',
  shouldUsePending: isNewerRichTextPending,
  getLoadedValue: (value) => value.html,
  schedule: newerPendingClock.schedule,
  cancel: newerPendingClock.cancel,
  onlineTarget: null,
});
await newerPendingQueue.hydrate();
assert.equal(newerPendingQueue.value, '<p>New local edit</p>', 'a newer local pending edit overrides older backend rich text');
await newerPendingClock.runNext();
assert.equal(newerPendingSaved, true, 'the newer pending edit is retried');

const stalePendingLocal = storage();
let stalePendingSaved = false;
stalePendingLocal.setItem('lm_editor_rich_pending:12', JSON.stringify({ value: '<p>Stale local edit</p>', updatedAt: '2026-09-01T10:00:00.000Z' }));
const stalePendingQueue = new PendingSyncQueue({
  storage: stalePendingLocal,
  storageKey: 'lm_editor_rich_pending:12',
  load: async () => ({ html: '<p>Newer backend edit</p>', updatedAt: '2026-09-01T10:00:01.000Z' }),
  save: async () => { stalePendingSaved = true; },
  isBackendEmpty: (value) => !value.html,
  isValid: (value) => typeof value === 'string',
  shouldUsePending: isNewerRichTextPending,
  getLoadedValue: (value) => value.html,
  schedule: () => 0,
  cancel: () => {},
  onlineTarget: null,
});
await stalePendingQueue.hydrate();
assert.equal(stalePendingQueue.value, '<p>Newer backend edit</p>', 'stale local pending data cannot overwrite newer backend rich text');
assert.equal(stalePendingLocal.getItem('lm_editor_rich_pending:12'), null, 'stale local pending data is discarded');
assert.equal(stalePendingSaved, false, 'stale local pending data is never retried');
assert.equal(isNewerRichTextPending(createRichTextPending('<p>Current</p>', new Date('2026-09-01T10:00:02.000Z')), { updatedAt: '2026-09-01T10:00:01.000Z' }), true);

const local = storage();
const clock = scheduler();
let legacyCleared = false;
let savedHtml = '';
const migrationQueue = new PendingSyncQueue({
  storage: local,
  storageKey: 'lm_editor_rich_pending:12',
  load: async () => '',
  save: async (html) => { savedHtml = html; return { html }; },
  confirm: (response, html) => response?.html === html,
  isBackendEmpty: (html) => !html,
  isValid: (html) => typeof html === 'string',
  readLegacy: () => '<p>Legacy note</p>',
  clearLegacy: () => { legacyCleared = true; },
  schedule: clock.schedule,
  cancel: clock.cancel,
  onlineTarget: null,
});
await migrationQueue.hydrate();
assert.equal(migrationQueue.value, '<p>Legacy note</p>', 'legacy rich text is used only for an empty backend page');
assert.equal(migrationQueue.status, 'pending');
await clock.runNext();
assert.equal(savedHtml, '<p>Legacy note</p>');
assert.equal(legacyCleared, true, 'legacy content is removed only after confirmed persistence');
assert.equal(local.getItem('lm_editor_rich_pending:12'), null);

const existingLegacy = storage();
let overwriteAttempted = false;
const existingQueue = new PendingSyncQueue({
  storage: existingLegacy,
  storageKey: 'lm_editor_rich_pending:12',
  load: async () => '<p>Backend note</p>',
  save: async () => { overwriteAttempted = true; },
  isBackendEmpty: (html) => !html,
  readLegacy: () => '<p>Old local note</p>',
  schedule: () => 0,
  cancel: () => {},
  onlineTarget: null,
});
await existingQueue.hydrate();
assert.equal(existingQueue.value, '<p>Backend note</p>');
assert.equal(overwriteAttempted, false, 'legacy content cannot overwrite persisted content');

const retryLocal = storage();
const retryClock = scheduler();
let attempts = 0;
const retryQueue = new PendingSyncQueue({
  storage: retryLocal,
  storageKey: 'lm_editor_rich_pending:12',
  load: async () => '',
  save: async (html) => { attempts += 1; if (attempts === 1) throw new Error('offline'); return { html }; },
  confirm: (response, html) => response?.html === html,
  isBackendEmpty: (html) => !html,
  isValid: (html) => typeof html === 'string',
  schedule: retryClock.schedule,
  cancel: retryClock.cancel,
  onlineTarget: null,
});
await retryQueue.hydrate();
retryQueue.set('<p>Retry</p>');
await retryClock.runNext();
assert.equal(retryQueue.status, 'error');
assert.ok(retryLocal.getItem('lm_editor_rich_pending:12'), 'failed content remains queued locally');
await retryClock.runNext();
assert.equal(retryQueue.status, 'saved');
assert.equal(retryLocal.getItem('lm_editor_rich_pending:12'), null);

console.log(JSON.stringify({ status: 'PASS', checks: ['safe IDs', 'rich block parsing', 'newer pending wins', 'stale pending loses', 'confirmed migration', 'no legacy overwrite', 'retry queue'] }));
