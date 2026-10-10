/**
 * AsyncStorage's API on top of localStorage.
 *
 * next.config.ts aliases `@react-native-async-storage/async-storage` to this
 * file, so the RN app's own storage helpers (src/data/userStorage.js and
 * sessionStorage.js, covered by its Jest tests) run unchanged in the browser.
 * Keys and value formats are therefore identical across both clients.
 *
 * localStorage can be missing or throw (Safari private mode, blocked site
 * data, quota). Then values live in memory for the rest of the visit, and
 * `isPersistent()` lets the UI say that progress won't be kept.
 */

const memory = new Map<string, string>();
let persistent: boolean | undefined;

function backend(): Storage | null {
  if (persistent === false) return null;
  try {
    const storage = globalThis.localStorage;
    if (!storage) throw new Error("no localStorage");
    if (persistent === undefined) {
      const probe = "@yoga_storage_probe";
      storage.setItem(probe, "1");
      storage.removeItem(probe);
      persistent = true;
    }
    return storage;
  } catch {
    persistent = false;
    return null;
  }
}

/** Whether values survive a reload (false = in-memory fallback). */
export function isPersistent(): boolean {
  return backend() !== null;
}

/** Every stored key, from whichever backend is active. */
export function allKeys(): string[] {
  const storage = backend();
  if (!storage) return [...memory.keys()];
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

function getItemSync(key: string): string | null {
  const storage = backend();
  return storage ? storage.getItem(key) : (memory.get(key) ?? null);
}

function setItemSync(key: string, value: string): void {
  const storage = backend();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // Quota exceeded or storage revoked mid-visit: keep the value in
      // memory rather than lose it, and stop claiming persistence.
      persistent = false;
    }
  }
  memory.set(key, value);
}

function removeItemSync(key: string): void {
  backend()?.removeItem(key);
  memory.delete(key);
}

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => getItemSync(key),
  setItem: async (key: string, value: string): Promise<void> => setItemSync(key, value),
  removeItem: async (key: string): Promise<void> => removeItemSync(key),
};

export default AsyncStorage;

/** Test hook: forget the cached backend decision and in-memory values. */
export function resetStorageForTests(): void {
  persistent = undefined;
  memory.clear();
}
