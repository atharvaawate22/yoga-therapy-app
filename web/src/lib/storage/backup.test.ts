import { afterEach, describe, expect, it, vi } from "vitest";
import AsyncStorage, { isPersistent, resetStorageForTests } from "./asyncStorageShim";
import { backupFileName, createBackup, parseBackup, restoreBackup } from "./backup";
import { getPracticeStats, savePracticeSession, saveProfile, getProfile } from "./index";

const session = { type: "routine" as const, title: "Back Pain", posesCompleted: 3, poseCount: 5, durationSec: 300 };

describe("storage shim", () => {
  afterEach(() => vi.restoreAllMocks());

  it("persists through localStorage with the RN app's keys", async () => {
    await savePracticeSession(session);
    expect(JSON.parse(localStorage.getItem("@yoga_practice_sessions")!)).toHaveLength(1);
    expect(isPersistent()).toBe(true);
  });

  it("falls back to memory when the browser blocks storage", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    resetStorageForTests();
    await AsyncStorage.setItem("@yoga_voice_enabled", "false");
    expect(await AsyncStorage.getItem("@yoga_voice_enabled")).toBe("false");
    expect(isPersistent()).toBe(false);
  });

  it("runs the RN app's streak logic unchanged", async () => {
    await savePracticeSession(session);
    const stats = await getPracticeStats();
    expect(stats).toMatchObject({ totalSessions: 1, totalMinutes: 5, currentStreakDays: 1 });
    expect(stats.last7Days).toHaveLength(7);
  });

  it("saving a profile keeps an age saved by the APK", async () => {
    localStorage.setItem(
      "@yoga_user_profile",
      JSON.stringify({ name: "A", age: 30, ageRange: "26-35", experience: "beginner" }),
    );
    await saveProfile({ name: "Asha", experience: "expert" });
    expect(JSON.parse(localStorage.getItem("@yoga_user_profile")!)).toEqual({
      name: "Asha",
      age: 30,
      ageRange: "26-35",
      experience: "expert",
    });
    expect(await getProfile()).toEqual({ name: "Asha", experience: "expert" });
  });
});

describe("backup", () => {
  it("round-trips everything the app stores, and nothing else", async () => {
    await savePracticeSession(session);
    await saveProfile({ name: "Asha", experience: "intermediate" });
    localStorage.setItem("unrelated", "x");

    const backup = await createBackup(new Date("2026-10-08T10:00:00Z"));
    expect(Object.keys(backup.data).sort()).toEqual(["@yoga_practice_sessions", "@yoga_user_profile"]);

    localStorage.clear();
    localStorage.setItem("@yoga_favorite_poses", '["tree_pose"]');
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.sessionCount).toBe(1);

    await restoreBackup(parsed.backup);
    expect(await getProfile()).toEqual({ name: "Asha", experience: "intermediate" });
    // Restore replaces: keys absent from the backup are removed.
    expect(localStorage.getItem("@yoga_favorite_poses")).toBeNull();
  });

  it.each([
    ["not JSON", "{oops", "isn't valid JSON"],
    ["another app's file", JSON.stringify({ app: "other", version: 1, data: {} }), "isn't a Yoga Therapy backup"],
    ["a newer version", JSON.stringify({ app: "yoga-therapy", version: 2, data: {} }), "Unsupported backup version"],
    [
      "a foreign key",
      JSON.stringify({ app: "yoga-therapy", version: 1, data: { token: "x" } }),
      "Unexpected entry",
    ],
    [
      "corrupted history",
      JSON.stringify({
        app: "yoga-therapy",
        version: 1,
        data: { "@yoga_practice_sessions": JSON.stringify([{ title: "no dates" }]) },
      }),
      "corrupted",
    ],
  ])("rejects %s", (_label, text, message) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("names files by date", () => {
    expect(backupFileName(new Date("2026-10-08T23:00:00Z"))).toBe("yoga-therapy-backup-2026-10-08.json");
  });
});
