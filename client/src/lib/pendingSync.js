import { useEffect, useRef, useState } from 'react';

const DEFAULT_RETRY_DELAYS = [250, 500, 1_000, 2_000, 4_000];

function defaultRetryableError(error) {
  const status = error?.response?.status;
  return !Number.isInteger(status) || status >= 500;
}

function readPending(storage, key) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    clearPending(storage, key);
    return null;
  }
}

function writePending(storage, key, pending) {
  try {
    storage?.setItem(key, JSON.stringify(pending));
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
  constructor({ storage = globalThis.localStorage, storageKey, load, save, confirm = () => true, isBackendEmpty, isValid = () => true, normalizeValue = (value) => value, isRetryableError = defaultRetryableError, createPending = (value) => ({ value }), shouldUsePending = () => true, getLoadedValue = (value) => value, readLegacy, clearLegacy, saveDelay = 0, retryDelays = DEFAULT_RETRY_DELAYS, refreshInterval = 0, schedule = (...args) => globalThis.setTimeout(...args), cancel = (timer) => globalThis.clearTimeout(timer), onlineTarget = globalThis.window, visibilityTarget = globalThis.document }) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.load = load;
    this.save = save;
    this.confirm = confirm;
    this.isBackendEmpty = isBackendEmpty;
    this.isValid = isValid;
    this.normalizeValue = normalizeValue;
    this.isRetryableError = isRetryableError;
    this.createPending = createPending;
    this.shouldUsePending = shouldUsePending;
    this.getLoadedValue = getLoadedValue;
    this.readLegacy = readLegacy;
    this.clearLegacy = clearLegacy;
    this.saveDelay = saveDelay;
    this.retryDelays = retryDelays;
    this.schedule = schedule;
    this.cancel = cancel;
    this.listeners = new Set();
    this.value = undefined;
    this.status = 'saved';
    this.errorKind = null;
    this.hydrated = false;
    this.version = 0;
    this.sending = false;
    this.loading = false;
    this.retryCount = 0;
    this.timer = null;
    this.refreshTimer = null;
    this.refreshInterval = refreshInterval;
    this.legacyPending = false;
    this.loadFailed = false;
    this.onlineTarget = onlineTarget;
    this.visibilityTarget = visibilityTarget;
    this.onOnline = () => this.retryNow();
    this.onFocus = () => this.refresh().finally(() => this.scheduleRefresh());
    this.onVisibilityChange = () => {
      if (!this.visibilityTarget?.hidden) this.refresh().finally(() => this.scheduleRefresh());
    };
    onlineTarget?.addEventListener?.('online', this.onOnline);
    onlineTarget?.addEventListener?.('focus', this.onFocus);
    visibilityTarget?.addEventListener?.('visibilitychange', this.onVisibilityChange);
  }

  snapshot() {
    return { value: this.value, status: this.status, errorKind: this.errorKind, hydrated: this.hydrated };
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
    if (this.loading) return this.snapshot();
    this.loading = true;
    try {
      const loadedBackendValue = await this.load();
      const backendValue = this.normalizeValue(loadedBackendValue);
      this.loadFailed = false;
      const storedPending = readPending(this.storage, this.storageKey);
      const pendingValue = storedPending && this.normalizeValue(storedPending.value);
      const pending = pendingValue !== null && pendingValue !== undefined && this.isValid(pendingValue)
        ? { ...storedPending, value: pendingValue }
        : null;
      const usePending = pending && this.shouldUsePending(pending, backendValue, loadedBackendValue);
      if (storedPending && !usePending) clearPending(this.storage, this.storageKey);
      const rawLegacyValue = !usePending && this.isBackendEmpty(backendValue) ? this.readLegacy?.() : undefined;
      const legacyValue = rawLegacyValue === undefined || rawLegacyValue === null
        ? rawLegacyValue
        : this.normalizeValue(rawLegacyValue);
      const shouldMigrateLegacy = !usePending && legacyValue !== undefined && legacyValue !== null;
      this.value = usePending ? pending.value : (shouldMigrateLegacy ? legacyValue : this.getLoadedValue(backendValue));
      this.hydrated = true;
      if (usePending || shouldMigrateLegacy) {
        this.status = 'pending';
        this.errorKind = null;
        this.legacyPending = shouldMigrateLegacy;
        writePending(this.storage, this.storageKey, usePending ? pending : this.createPending(this.value));
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
        this.errorKind = 'network';
        this.hydrated = true;
        this.notify();
        this.scheduleRetry();
        return this.snapshot();
      }
      this.status = 'error';
      this.errorKind = 'network';
      this.hydrated = true;
      this.notify();
      throw error;
    } finally {
      this.loading = false;
      this.scheduleRefresh();
    }
  }

  hasPendingEdit() {
    return Boolean(readPending(this.storage, this.storageKey));
  }

  scheduleRefresh() {
    if (!this.refreshInterval || this.refreshTimer !== null || this.visibilityTarget?.hidden) return;
    this.refreshTimer = this.schedule(() => {
      this.refreshTimer = null;
      this.refresh().catch(() => {}).finally(() => this.scheduleRefresh());
    }, this.refreshInterval);
  }

  async refresh() {
    if (this.loading || this.sending || !this.hydrated || this.visibilityTarget?.hidden) return this.snapshot();
    this.loading = true;
    try {
      const backendValue = this.normalizeValue(await this.load());
      this.loadFailed = false;
      if (!this.hasPendingEdit()) {
        this.value = this.getLoadedValue(backendValue);
        this.status = 'saved';
        this.errorKind = null;
        this.notify();
      }
      return this.snapshot();
    } catch (error) {
      // A background read must not look like a failed user save. Only surface
      // the retry state when this device actually has unsynchronised edits.
      if (this.hasPendingEdit()) {
        this.status = 'error';
        this.notify();
      }
      throw error;
    } finally {
      this.loading = false;
    }
  }

  set(value) {
    if (!this.hydrated) return;
    // Keep the active request as the single writer. New edits are versioned
    // and sent immediately after it finishes; clearing this flag here would
    // start concurrent SQLite writes and intermittently return a 500 error.
    this.value = this.normalizeValue(value);
    this.version += 1;
    this.status = 'pending';
    this.errorKind = null;
    this.retryCount = 0;
    writePending(this.storage, this.storageKey, this.createPending(this.value));
    this.notify();
    this.scheduleFlush(this.saveDelay, { replace: true });
  }

  scheduleFlush(delay, { replace = false } = {}) {
    if (this.sending) return;
    if (this.timer !== null) {
      if (!replace) return;
      this.cancel(this.timer);
      this.timer = null;
    }
    this.timer = this.schedule(() => {
      this.timer = null;
      this.flush();
    }, delay);
  }

  scheduleRetry() {
    const delay = this.retryDelays[this.retryCount];
    if (delay === undefined) return false;
    this.retryCount += 1;
    this.scheduleFlush(delay);
    return true;
  }

  async flush() {
    if (this.sending || !this.hydrated || !readPending(this.storage, this.storageKey)) return;
    this.sending = true;
    const version = this.version;
    const value = this.normalizeValue(this.value);
    let failed = false;
    let retryDelay;
    try {
      const response = await this.save(value);
      if (!this.confirm(response, value)) throw new Error('Server did not confirm the saved value');
      this.retryCount = 0;
      if (version === this.version) {
        clearPending(this.storage, this.storageKey);
        if (this.legacyPending) this.clearLegacy?.();
        this.legacyPending = false;
        this.status = 'saved';
        this.errorKind = null;
        this.notify();
      }
    } catch (error) {
      failed = true;
      console.warn('[LehrerMaps sync] save failed', { storageKey: this.storageKey, status: error?.response?.status, message: error?.message });
      // A transient transport failure is not yet a failed save: keep the
      // edit visibly pending while the bounded retry queue is still active.
      // Only expose the error state after every automatic retry was used.
      retryDelay = this.isRetryableError(error) ? this.retryDelays[this.retryCount] : undefined;
      if (retryDelay === undefined) {
        this.status = 'error';
        this.errorKind = this.isRetryableError(error) ? 'network' : 'rejected';
      } else {
        this.retryCount += 1;
        this.status = 'pending';
        this.errorKind = null;
      }
      this.notify();
    } finally {
      this.sending = false;
      if (failed && retryDelay !== undefined) this.scheduleFlush(retryDelay);
      else if (!failed && readPending(this.storage, this.storageKey)) this.scheduleFlush(0);
    }
  }

  retryNow() {
    if (this.loadFailed) {
      this.status = 'pending';
      this.errorKind = null;
      this.notify();
      this.hydrate().catch(() => {});
      return;
    }
    if (!readPending(this.storage, this.storageKey)) {
      this.refresh().catch(() => {});
      return;
    }
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
    this.retryCount = 0;
    this.status = 'pending';
    this.errorKind = null;
    this.notify();
    this.scheduleFlush(0);
  }

  dispose() {
    if (this.timer !== null) this.cancel(this.timer);
    if (this.refreshTimer !== null) this.cancel(this.refreshTimer);
    this.onlineTarget?.removeEventListener?.('online', this.onOnline);
    this.onlineTarget?.removeEventListener?.('focus', this.onFocus);
    this.visibilityTarget?.removeEventListener?.('visibilitychange', this.onVisibilityChange);
    this.listeners.clear();
  }
}

export function usePendingSync(options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const queueRef = useRef(null);
  const [state, setState] = useState({ value: options.initialValue, status: 'saved', errorKind: null, hydrated: false });

  useEffect(() => {
    if (optionsRef.current.enabled === false) {
      queueRef.current = null;
      setState({ value: optionsRef.current.initialValue, status: 'saved', errorKind: null, hydrated: false });
      return undefined;
    }
    const queue = new PendingSyncQueue(optionsRef.current);
    queueRef.current = queue;
    const unsubscribe = queue.subscribe(setState);
    queue.hydrate().catch(() => {});
    return () => {
      unsubscribe();
      queue.dispose();
      queueRef.current = null;
    };
  }, [options.storageKey, options.enabled]);

  return [state.value, (value) => queueRef.current?.set(value), state, () => queueRef.current?.retryNow()];
}
