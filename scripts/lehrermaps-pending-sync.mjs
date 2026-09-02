#!/usr/bin/env node

import assert from 'node:assert/strict';
import { PendingSyncQueue } from '../client/src/lib/pendingSync.js';

function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key), data };
}

function scheduler() {
  const jobs = [];
  const delays = [];
  return {
    delays,
    schedule: (callback, delay) => { jobs.push(callback); delays.push(delay); return jobs.length - 1; },
    cancel: () => {},
    async runNext() { const job = jobs.shift(); if (job) { job(); await new Promise((resolve) => setImmediate(resolve)); } },
  };
}

function events(hidden = false) {
  const listeners = new Map();
  return {
    hidden,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
    emit(name) { listeners.get(name)?.(); },
    listenerCount: () => listeners.size,
  };
}

const local = storage();
const clock = scheduler();
let backend = [];
let saves = [];
const queue = new PendingSyncQueue({
  storage: local, storageKey: 'pending', load: async () => backend,
  save: async (value) => { saves.push(value); backend = value; },
  isBackendEmpty: (value) => value.length === 0,
  schedule: clock.schedule, cancel: clock.cancel, onlineTarget: null,
});

await queue.hydrate();
queue.set(['first']);
assert.ok(local.getItem('pending'), 'localStorage retains an unsaved edit');
await clock.runNext();
assert.deepEqual(backend, ['first']);
assert.equal(local.getItem('pending'), null, 'pending data is removed only after backend confirmation');

queue.set(['older']);
let releaseFirstSave;
const firstSave = new Promise((resolve) => { releaseFirstSave = resolve; });
queue.save = async (value) => { saves.push(value); await firstSave; backend = value; };
await clock.runNext();
queue.set(['newest']);
releaseFirstSave();
await new Promise((resolve) => setImmediate(resolve));
await clock.runNext();
assert.deepEqual(backend, ['newest'], 'queued writes preserve last-save-wins');

let retryAttempts = 0;
const retryLocal = storage();
const retryClock = scheduler();
const retryQueue = new PendingSyncQueue({
  storage: retryLocal, storageKey: 'pending', load: async () => [],
  save: async () => { retryAttempts += 1; if (retryAttempts === 1) throw new Error('offline'); },
  isBackendEmpty: (value) => value.length === 0, schedule: retryClock.schedule, cancel: retryClock.cancel, onlineTarget: null,
});
await retryQueue.hydrate();
retryQueue.set(['retry']);
await retryClock.runNext();
assert.equal(retryQueue.status, 'error', 'a failed save remains visible as an error');
assert.ok(retryLocal.getItem('pending'), 'a failed save remains pending');
await retryClock.runNext();
assert.equal(retryQueue.status, 'saved', 'the bounded retry confirms the pending save');

const pendingLocal = storage();
pendingLocal.setItem('pending', JSON.stringify({ value: ['local edit'] }));
const pendingQueue = new PendingSyncQueue({ storage: pendingLocal, storageKey: 'pending', load: async () => ['server value'], save: async () => {}, isBackendEmpty: (value) => value.length === 0, onlineTarget: null });
await pendingQueue.hydrate();
assert.deepEqual(pendingQueue.value, ['local edit'], 'pending local edits take precedence over server hydration');

let legacyCleared = false;
const migrationLocal = storage();
const migrationQueue = new PendingSyncQueue({ storage: migrationLocal, storageKey: 'pending', load: async () => [], save: async () => {}, isBackendEmpty: (value) => value.length === 0, readLegacy: () => ['legacy'], clearLegacy: () => { legacyCleared = true; }, onlineTarget: null });
await migrationQueue.hydrate();
await migrationQueue.flush();
assert.equal(legacyCleared, true, 'legacy storage is removed only after migration confirmation');

const unconfirmedLocal = storage();
const unconfirmedQueue = new PendingSyncQueue({ storage: unconfirmedLocal, storageKey: 'pending', load: async () => [], save: async () => ({ items: [] }), confirm: () => false, isBackendEmpty: (value) => value.length === 0, schedule: () => 0, cancel: () => {}, onlineTarget: null });
await unconfirmedQueue.hydrate();
unconfirmedQueue.set(['must remain pending']);
await unconfirmedQueue.flush();
assert.ok(unconfirmedLocal.getItem('pending'), 'an unconfirmed response cannot clear pending data');

let loadAttempts = 0;
const loadRetryQueue = new PendingSyncQueue({
  storage: storage(), storageKey: 'pending',
  load: async () => { loadAttempts += 1; if (loadAttempts === 1) throw new Error('offline'); return ['server']; },
  save: async () => {}, isBackendEmpty: (value) => value.length === 0, onlineTarget: null,
});
await loadRetryQueue.hydrate().catch(() => {});
assert.equal(loadRetryQueue.status, 'error', 'an initial load failure is surfaced');
loadRetryQueue.retryNow();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(loadRetryQueue.value, ['server'], 'manual retry rehydrates after an initial load failure');

const refreshLocal = storage();
const refreshClock = scheduler();
const refreshWindow = events();
const refreshDocument = events();
let sharedValue = ['first device'];
const refreshQueue = new PendingSyncQueue({
  storage: refreshLocal, storageKey: 'pending', load: async () => sharedValue,
  save: async (value) => { sharedValue = value; return value; },
  isBackendEmpty: (value) => value.length === 0, refreshInterval: 2_000,
  schedule: refreshClock.schedule, cancel: refreshClock.cancel,
  onlineTarget: refreshWindow, visibilityTarget: refreshDocument,
});
await refreshQueue.hydrate();
assert.equal(refreshClock.delays.at(-1), 2_000, 'active resources poll every two seconds');
sharedValue = ['second device'];
await refreshClock.runNext();
assert.deepEqual(refreshQueue.value, ['second device'], 'a confirmed resource refreshes external backend changes');

refreshQueue.set(['unsaved local edit']);
sharedValue = ['third device'];
await refreshQueue.refresh();
assert.deepEqual(refreshQueue.value, ['unsaved local edit'], 'refresh never overwrites a local pending edit');

await refreshClock.runNext();
await refreshClock.runNext();
sharedValue = ['focus update'];
refreshWindow.emit('focus');
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(refreshQueue.value, ['focus update'], 'window focus refreshes a confirmed resource');
sharedValue = ['visibility update'];
refreshDocument.hidden = false;
refreshDocument.emit('visibilitychange');
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(refreshQueue.value, ['visibility update'], 'visibility recovery refreshes a confirmed resource');
sharedValue = ['online update'];
refreshWindow.emit('online');
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(refreshQueue.value, ['online update'], 'online recovery refreshes a confirmed resource');
refreshQueue.dispose();
assert.equal(refreshWindow.listenerCount(), 0, 'dispose removes online and focus listeners');
assert.equal(refreshDocument.listenerCount(), 0, 'dispose removes visibility listeners');

let backgroundReadFails = false;
const quietRefreshQueue = new PendingSyncQueue({
  storage: storage(), storageKey: 'quiet-refresh',
  load: async () => {
    if (backgroundReadFails) throw new Error('temporary read outage');
    return ['server value'];
  },
  save: async () => ['server value'], isBackendEmpty: (value) => value.length === 0,
  onlineTarget: null, visibilityTarget: null,
});
await quietRefreshQueue.hydrate();
backgroundReadFails = true;
await assert.rejects(() => quietRefreshQueue.refresh(), /temporary read outage/);
assert.equal(quietRefreshQueue.status, 'saved', 'a background read failure does not present as a failed user save');

const checklistSource = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../client/src/components/BugChecklist.jsx', import.meta.url), 'utf8'));
assert.match(checklistSource, /enabled:\s*open/, 'the closed checklist does not create a polling queue');

console.log(JSON.stringify({ status: 'PASS', checks: ['pending retention', 'last-save-wins', 'pending precedence', 'confirmed legacy migration', 'response confirmation', 'external refresh', 'pending protection', 'focus, visibility and online refresh', 'quiet background read failures', 'closed checklist lifecycle'] }));
