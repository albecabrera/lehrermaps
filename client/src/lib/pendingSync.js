import { useEffect, useRef, useState } from 'react';

const DEFAULT_RETRY_DELAYS = [500, 1_000, 2_000, 4_000];

function readPending(storage, key) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    clearPending(storage, key);
    return null;
  }
}

function writePending(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify({ value }));
  } catch {
    // A full or unavailable localStorage must not make the editor unusable.
  }
}

function clearPending(storage, key) {
  try { storage?.removeItem(key); } catch {}
}

/**
 * Keeps one resource server-first while retaining only unsynchronised edits in
 * localStorage. Each save is versioned, so an older response can never erase a
 * newer local change.
 */
export class PendingSyncQueue {
  constructor({ storage = globalThis.localStorage, storageKey, load, save, confirm = () => true, isBackendEmpty, isValid = () => true, readLegacy, clearLegacy, saveDelay = 0, retryDelays = DEFAULT_RETRY_DELAYS, schedule = setTimeout, cancel = clearTimeout, onlineTarget = globalThis.window }) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.load = load;
    this.save = save;
    this.confirm = confirm;
    this.isBackendEmpty = isBackendEmpty;
    this.isValid = isValid;
    this.readLegacy = readLegacy;
    this.clearLegacy = clearLegacy;
    this.saveDelay = saveDelay;
    this.retryDelays = retryDelays;
    this.schedule = schedule;
    this.cancel = cancel;
    this.listeners = new Set();
    this.value = undefined;
    this.status = 'saved';
    this.hydrated = false;
    this.version = 0;
    this.sending = false;
    this.retryCount = 0;
    this.timer = null;
    this.legacyPending = false;
    this.loadFailed = false;
    this.onlineTarget = onlineTarget;
    this.onOnline = () => this.retryNow();
    onlineTarget?.addEventListener?.('online', this.onOnline);
  }

  snapshot() {
    return { value: this.value, status: this.status, hydrated: this.hydrated };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  async hydrate() {
    try {
      const backendValue = await this.load();
      this.loadFailed = false;
      const storedPending = readPending(this.storage, this.storageKey);
      const pending = storedPending && this.isValid(storedPending.value) ? storedPending : null;
      if (storedPending && !pending) clearPending(this.storage, this.storageKey);
      const legacyValue = !pending && this.isBackendEmpty(backendValue) ? this.readLegacy?.() : undefined;
      const shouldMigrateLegacy = !pending && legacyValue !== undefined && legacyValue !== null;
      this.value = pending ? pending.value : (shouldMigrateLegacy ? legacyValue : backendValue);
      this.hydrated = true;
      if (pending || shouldMigrateLegacy) {
        this.status = 'pending';
        this.legacyPending = shouldMigrateLegacy;
        writePending(this.storage, this.storageKey, this.value);
        this.scheduleFlush(0);
      }
      this.notify();
      return this.snapshot();
    } catch (error) {
      this.loadFailed = true;
      const pending = readPending(this.storage, this.storageKey);
      if (pending) {
        this.value = pending.value;
        this.status = 'error';
        this.hydrated = true;
        this.notify();
        this.scheduleRetry();
        return this.snapshot();
      }
      this.status = 'error';
      this.hydrated = true;
      this.notify();
      throw error;
    }
  }

  set(value) {
    if (!this.hydrated) return;
    this.value = value;
    this.version += 1;
    this.status = 'pending';
    this.retryCount = 0;
    writePending(this.storage, this.storageKey, value);
    this.notify();
    this.scheduleFlush(this.saveDelay);
  }

  scheduleFlush(delay) {
    if (this.sending || this.timer !== null) return;
    this.timer = this.schedule(() => {
      this.timer = null;
      this.flush();
    }, delay);
  }

  scheduleRetry() {
    const delay = this.retryDelays[this.retryCount];
    if (delay === undefined) return;
    this.retryCount += 1;
    this.scheduleFlush(delay);
  }

  async flush() {
    if (this.sending || !this.hydrated || !readPending(this.storage, this.storageKey)) return;
    this.sending = true;
    const version = this.version;
    const value = this.value;
    let failed = false;
    try {
      const response = await this.save(value);
      if (!this.confirm(response, value)) throw new Error('Server did not confirm the saved value');
      this.retryCount = 0;
      if (version === this.version) {
        clearPending(this.storage, this.storageKey);
        if (this.legacyPending) this.clearLegacy?.();
        this.legacyPending = false;
        this.status = 'saved';
        this.notify();
      }
    } catch {
      failed = true;
      this.status = 'error';
      this.notify();
    } finally {
      this.sending = false;
      if (failed) this.scheduleRetry();
      else if (readPending(this.storage, this.storageKey)) this.scheduleFlush(0);
    }
  }

  retryNow() {
    if (this.loadFailed) {
      this.status = 'pending';
      this.notify();
      this.hydrate().catch(() => {});
      return;
    }
    if (!readPending(this.storage, this.storageKey)) return;
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
    this.retryCount = 0;
    this.status = 'pending';
    this.notify();
    this.scheduleFlush(0);
  }

  dispose() {
    if (this.timer !== null) this.cancel(this.timer);
    this.onlineTarget?.removeEventListener?.('online', this.onOnline);
    this.listeners.clear();
  }
}

export function usePendingSync(options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const queueRef = useRef(null);
  const [state, setState] = useState({ value: options.initialValue, status: 'saved', hydrated: false });

  useEffect(() => {
    const queue = new PendingSyncQueue(optionsRef.current);
    queueRef.current = queue;
    const unsubscribe = queue.subscribe(setState);
    queue.hydrate().catch(() => {});
    return () => {
      unsubscribe();
      queue.dispose();
      queueRef.current = null;
    };
  }, [options.storageKey]);

  return [state.value, (value) => queueRef.current?.set(value), state, () => queueRef.current?.retryNow()];
}
