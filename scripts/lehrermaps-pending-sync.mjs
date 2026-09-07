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

const serialLocal = storage();
const serialClock = scheduler();
let concurrentSaves = 0;
let peakConcurrentSaves = 0;
let releaseSerialSave;
const serialSave = new Promise((resolve) => { releaseSerialSave = resolve; });
const serialQueue = new PendingSyncQueue({
  storage: serialLocal, storageKey: 'serial', load: async () => [],
  save: async (value) => {
    concurrentSaves += 1;
    peakConcurrentSaves = Math.max(peakConcurrentSaves, concurrentSaves);
    await serialSave;
    concurrentSaves -= 1;
    return value;
  },
  isBackendEmpty: (value) => value.length === 0,
  schedule: serialClock.schedule, cancel: serialClock.cancel, onlineTarget: null,
});
await serialQueue.hydrate();
serialQueue.set(['first']);
await serialClock.runNext();
serialQueue.set(['newest']);
await serialClock.runNext();
assert.equal(peakConcurrentSaves, 1, 'a new edit never starts a second save while one is in flight');
releaseSerialSave();
await new Promise((resolve) => setImmediate(resolve));
await serialClock.runNext();
assert.equal(peakConcurrentSaves, 1, 'the queued latest edit is sent serially after the first request');

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
assert.equal(retryQueue.status, 'pending', 'a transient failed save remains visibly pending while retries continue');
assert.ok(retryLocal.getItem('pending'), 'a failed save remains pending');
await retryClock.runNext();
assert.equal(retryQueue.status, 'saved', 'the bounded retry confirms the pending save');

const exhaustedLocal = storage();
const exhaustedClock = scheduler();
const exhaustedQueue = new PendingSyncQueue({
  storage: exhaustedLocal, storageKey: 'exhausted', load: async () => [],
  save: async () => { throw new Error('offline'); },
  isBackendEmpty: (value) => value.length === 0, retryDelays: [0],
  schedule: exhaustedClock.schedule, cancel: exhaustedClock.cancel, onlineTarget: null,
});
await exhaustedQueue.hydrate();
exhaustedQueue.set(['retry later']);
await exhaustedClock.runNext();
assert.equal(exhaustedQueue.status, 'pending', 'the first failure schedules an automatic retry');
await exhaustedClock.runNext();
assert.equal(exhaustedQueue.status, 'error', 'an error is shown only after automatic retries are exhausted');
assert.ok(exhaustedLocal.getItem('exhausted'), 'an exhausted retry keeps the edit available for manual retry');

const pendingLocal = storage();
pendingLocal.setItem('pending', JSON.stringify({ value: ['local edit'] }));
const pendingQueue = new PendingSyncQueue({ storage: pendingLocal, storageKey: 'pending', load: async () => ['server value'], save: async () => {}, isBackendEmpty: (value) => value.length === 0, onlineTarget: null });
await pendingQueue.hydrate();
assert.deepEqual(pendingQueue.value, ['local edit'], 'pending local edits take precedence over server hydration');

const datedPendingLocal = storage();
datedPendingLocal.setItem('dated', JSON.stringify({ value: ['older local edit'], updatedAt: 100 }));
const datedPendingQueue = new PendingSyncQueue({
  storage: datedPendingLocal, storageKey: 'dated', load: async () => ({ value: ['server value'], updatedAt: 200 }),
  save: async () => {}, normalizeValue: (response) => response.value,
  shouldUsePending: (pending, _value, response) => pending.updatedAt > response.updatedAt,
  isBackendEmpty: (value) => value.length === 0, onlineTarget: null,
});
await datedPendingQueue.hydrate();
assert.deepEqual(datedPendingQueue.value, ['server value'], 'an older pending edit cannot overwrite newer shared data');

const stalePendingLocal = storage();
stalePendingLocal.setItem('stale', JSON.stringify({ value: ['old local edit'], updatedAt: 100 }));
const stalePendingQueue = new PendingSyncQueue({
  storage: stalePendingLocal, storageKey: 'stale', load: async () => ({ value: ['old local edit'], updatedAt: 100 }),
  save: async () => {}, normalizeValue: (response) => response.value,
  shouldUsePending: (pending, _value, response) => pending.updatedAt > response.updatedAt,
  isBackendEmpty: (value) => value.length === 0, onlineTarget: null,
});
await stalePendingQueue.hydrate();
stalePendingQueue.load = async () => ({ value: ['new second-device edit'], updatedAt: 200 });
await stalePendingQueue.refresh();
assert.deepEqual(stalePendingQueue.value, ['new second-device edit'], 'a live refresh replaces stale pending data from another device');
assert.equal(stalePendingLocal.getItem('stale'), null, 'a stale pending edit is cleared after shared data wins');

const legacyShapeLocal = storage();
legacyShapeLocal.setItem('legacy-shape', JSON.stringify({ value: [{ id: 'legacy', text: 'keep this text', completed: false, createdAt: 'old-client' }] }));
let normalizedSave;
const legacyShapeQueue = new PendingSyncQueue({
  storage: legacyShapeLocal, storageKey: 'legacy-shape', load: async () => [],
  save: async (value) => { normalizedSave = value; return { items: value }; },
  confirm: (response, value) => JSON.stringify(response.items) === JSON.stringify(value),
  normalizeValue: (value) => Array.isArray(value) ? value
    .filter((item) => item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.completed === 'boolean')
    .map(({ id, text, completed }) => ({ id, text, completed })) : [],
  isBackendEmpty: (value) => value.length === 0, onlineTarget: null,
});
await legacyShapeQueue.hydrate();
await legacyShapeQueue.flush();
assert.deepEqual(normalizedSave, [{ id: 'legacy', text: 'keep this text', completed: false }], 'legacy fields are removed before a pending save reaches the backend');

const absentLegacyQueue = new PendingSyncQueue({
  storage: storage(), storageKey: 'absent-legacy', load: async () => [], save: async () => {},
  normalizeValue: () => [], isBackendEmpty: (value) => value.length === 0, onlineTarget: null,
});
await absentLegacyQueue.hydrate();
assert.equal(absentLegacyQueue.status, 'saved', 'an absent legacy value never becomes an empty pending migration');

const rejectedLocal = storage();
const rejectedQueue = new PendingSyncQueue({
  storage: rejectedLocal, storageKey: 'rejected', load: async () => [],
  save: async () => { const error = new Error('invalid payload'); error.response = { status: 400 }; throw error; },
  isBackendEmpty: (value) => value.length === 0, onlineTarget: null,
});
await rejectedQueue.hydrate();
rejectedQueue.set(['invalid']);
await rejectedQueue.flush();
assert.equal(rejectedQueue.status, 'error', 'a rejected save stops automatic network retries');
assert.equal(rejectedQueue.errorKind, 'rejected', 'a validation rejection is distinguished from a connection outage');

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

const todayDashboardSource = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../client/src/components/TodayDashboard.jsx', import.meta.url), 'utf8'));
assert.match(todayDashboardSource, /function normalizeTasks\(value\)/, 'today tasks normalize legacy data before syncing');
assert.match(todayDashboardSource, /normalizeValue:\s*\(dashboard\) => normalizeTasks\(dashboard\?\.tasks\)/, 'today tasks use the API-shape normalizer for pending saves');
assert.match(todayDashboardSource, /shouldUsePending:\s*pendingTaskIsNewer/, 'today tasks keep newer shared SQLite data over stale pending edits');

console.log(JSON.stringify({ status: 'PASS', checks: ['pending retention', 'last-save-wins', 'serial writes', 'pending precedence', 'legacy checklist normalization', 'today task normalization', 'absent legacy protection', 'validation error classification', 'confirmed legacy migration', 'response confirmation', 'bounded retry status', 'external refresh', 'pending protection', 'focus, visibility and online refresh', 'quiet background read failures', 'closed checklist lifecycle'] }));
