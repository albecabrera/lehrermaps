#!/usr/bin/env node

import assert from 'node:assert/strict';
import { PendingSyncQueue } from '../client/src/lib/pendingSync.js';

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

console.log(JSON.stringify({ status: 'PASS', checks: ['pending retention', 'last-save-wins', 'pending precedence', 'confirmed legacy migration', 'response confirmation'] }));
