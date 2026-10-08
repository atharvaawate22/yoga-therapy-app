/**
 * Typed wrappers over the RN app's storage helpers, which run unchanged on
 * localStorage (see asyncStorageShim.ts). Streaks, weekly stats and session
 * grouping therefore come from the same code, and the same Jest tests, as
 * the APK.
 */
import * as userStorage from "@app-data/userStorage";
import * as sessionStorage from "@app-data/sessionStorage";
import { toPose, type Pose } from "@/content";

export interface Profile {
  name: string;
  experience: string;
}

export type SessionType = "routine" | "custom" | "single" | "surya" | "corrector";

export interface PracticeSession {
  id: string;
  type: SessionType;
  title: string;
  posesCompleted: number;
  poseCount: number;
  durationSec: number;
  completedAt: string;
}

export interface DayActivity {
  key: string;
  label: string;
  minutes: number;
  count: number;
}

export interface PracticeStats {
  totalSessions: number;
  totalMinutes: number;
  currentStreakDays: number;
  weekSessions: number;
  weekMinutes: number;
  last7Days: DayActivity[];
}

export interface SessionGroup {
  key: string;
  title: string;
  sessions: PracticeSession[];
}

export interface CustomSet {
  id: string;
  name: string;
  poseIds: string[];
  createdAt: string;
  poses: Pose[];
}

export const isOnboarded = userStorage.isOnboarded as () => Promise<boolean>;
export const setOnboarded = userStorage.setOnboarded as () => Promise<void>;

export async function getProfile(): Promise<Profile> {
  const raw = (await userStorage.getUserProfile()) as Partial<Profile> | null;
  return { name: raw?.name || "Yogi", experience: raw?.experience || "beginner" };
}

/**
 * Saves name and level. The web app doesn't ask for age (the RN app stores it
 * but never uses it), so any age already saved is kept rather than erased.
 */
export async function saveProfile(profile: Profile): Promise<void> {
  const existing = ((await userStorage.getUserProfile()) ?? {}) as Record<string, unknown>;
  await userStorage.setUserProfile({ ...existing, ...profile });
}

export async function getCustomSets(): Promise<CustomSet[]> {
  const sets = (await userStorage.getCustomSets()) as Array<
    Omit<CustomSet, "poses"> & { poses: Parameters<typeof toPose>[0][] }
  >;
  return sets.map((set) => ({ ...set, poses: set.poses.map(toPose) }));
}

export const saveCustomSet = userStorage.saveCustomSet as (set: {
  name: string;
  poseIds: string[];
}) => Promise<Omit<CustomSet, "poses">>;
export const updateCustomSet = userStorage.updateCustomSet as (
  id: string,
  updates: Partial<Pick<CustomSet, "name" | "poseIds">>,
) => Promise<void>;
export const deleteCustomSet = userStorage.deleteCustomSet as (id: string) => Promise<void>;

export const getFavoriteIds = userStorage.getFavoriteIds as () => Promise<string[]>;
export const toggleFavorite = userStorage.toggleFavorite as (poseId: string) => Promise<boolean>;
export const getVoiceEnabled = userStorage.getVoiceEnabled as () => Promise<boolean>;
export const setVoiceEnabled = userStorage.setVoiceEnabled as (on: boolean) => Promise<void>;

export const getPracticeSessions = sessionStorage.getPracticeSessions as () => Promise<
  PracticeSession[]
>;
export const savePracticeSession = sessionStorage.savePracticeSession as (
  session: Omit<PracticeSession, "id" | "completedAt">,
) => Promise<PracticeSession>;
export const clearPracticeSessions = sessionStorage.clearPracticeSessions as () => Promise<void>;
export const getPracticeStats = sessionStorage.getPracticeStats as () => Promise<PracticeStats>;
export const groupSessionsByDay = sessionStorage.groupSessionsByDay as (
  sessions: PracticeSession[],
) => SessionGroup[];
export const parseDurationSec = sessionStorage.parseDurationSec as (
  duration: string | number,
) => number;
export const formatDuration = sessionStorage.formatDuration as (seconds: number) => string;
