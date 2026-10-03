import type { PersistStorage, StorageValue } from 'zustand/middleware';

interface DebouncedStorageOptions<S> {
  /** Delay before a write reaches localStorage. Rapid sets (drag frames) collapse into one write. */
  delayMs?: number;
  /** Runs at write time, so the store's partialize can stay a cheap reference pick. */
  serialize?: (state: S) => unknown;
  /** Called when a write fails (quota exceeded, storage disabled). */
  onError?: (err: unknown) => void;
}

const flushers = new Set<() => void>();

/** Writes every pending debounced value now. Called on pagehide and before a reload. */
export function flushPersistedState(): void {
  flushers.forEach(f => f());
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPersistedState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersistedState();
  });
}

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * localStorage-backed zustand storage that debounces writes, never throws into the caller,
 * and reports failures through onError instead.
 */
export function createDebouncedStorage<S>({ delayMs = 400, serialize, onError }: DebouncedStorageOptions<S> = {}): PersistStorage<S> {
  const pending = new Map<string, StorageValue<S>>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const ls = getLocalStorage();
    pending.forEach((value, name) => {
      try {
        const state = serialize ? serialize(value.state) : value.state;
        ls?.setItem(name, JSON.stringify({ state, version: value.version }));
      } catch (err) {
        onError?.(err);
      }
    });
    pending.clear();
  };
  flushers.add(flush);

  return {
    getItem: (name) => {
      try {
        const raw = getLocalStorage()?.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending.set(name, value);
      if (!timer) timer = setTimeout(flush, delayMs);
    },
    removeItem: (name) => {
      pending.delete(name);
      try {
        getLocalStorage()?.removeItem(name);
      } catch {
        // storage unavailable: nothing to remove
      }
    },
  };
}
