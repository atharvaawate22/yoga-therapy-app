/**
 * Export and import of everything the app stores.
 *
 * Browser storage is per browser and can be cleared by the user or, on iOS,
 * evicted, so the web app offers a JSON backup the APK doesn't need.
 */
import AsyncStorage, { allKeys } from "./asyncStorageShim";

/** Every key the app writes starts with this (same keys as the RN app). */
export const KEY_PREFIX = "@yoga_";
export const BACKUP_APP = "yoga-therapy";
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** Raw stored strings, keyed by storage key. */
  data: Record<string, string>;
}

export async function createBackup(now = new Date()): Promise<Backup> {
  const data: Record<string, string> = {};
  for (const key of allKeys().filter((k) => k.startsWith(KEY_PREFIX)).sort()) {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export function backupFileName(now = new Date()): string {
  return `yoga-therapy-backup-${now.toISOString().slice(0, 10)}.json`;
}

export type ParseResult =
  | { ok: true; backup: Backup; sessionCount: number }
  | { ok: false; error: string };

/**
 * Validate an uploaded backup before anything is written. Values must be the
 * strings the app itself stores; practice history must be a session array.
 */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "That file isn't a Yoga Therapy backup." };
  }
  const candidate = parsed as Partial<Backup>;
  if (candidate.app !== BACKUP_APP) {
    return { ok: false, error: "That file isn't a Yoga Therapy backup." };
  }
  if (candidate.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${String(candidate.version)}.` };
  }
  const data = candidate.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, error: "The backup has no data section." };
  }
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(KEY_PREFIX) || typeof value !== "string") {
      return { ok: false, error: `Unexpected entry in backup: ${key}` };
    }
  }

  let sessionCount = 0;
  const sessions = (data as Record<string, string>)["@yoga_practice_sessions"];
  if (sessions !== undefined) {
    let list: unknown;
    try {
      list = JSON.parse(sessions);
    } catch {
      return { ok: false, error: "The practice history in the backup is corrupted." };
    }
    const valid =
      Array.isArray(list) &&
      list.every(
        (s) =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as Record<string, unknown>).completedAt === "string" &&
          typeof (s as Record<string, unknown>).durationSec === "number",
      );
    if (!valid) return { ok: false, error: "The practice history in the backup is corrupted." };
    sessionCount = (list as unknown[]).length;
  }

  return {
    ok: true,
    backup: { ...(candidate as Backup), data: data as Record<string, string> },
    sessionCount,
  };
}

/** Replace all app data with the backup's (keys missing from it are removed). */
export async function restoreBackup(backup: Backup): Promise<void> {
  for (const key of allKeys().filter((k) => k.startsWith(KEY_PREFIX))) {
    if (!(key in backup.data)) await AsyncStorage.removeItem(key);
  }
  for (const [key, value] of Object.entries(backup.data)) {
    await AsyncStorage.setItem(key, value);
  }
}
