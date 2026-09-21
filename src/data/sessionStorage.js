/**
 * Session Storage - AsyncStorage helpers for practice history & stats
 *
 * A session record:
 * {
 *   id: string,
 *   type: 'routine' | 'surya' | 'single' | 'custom',
 *   title: string,            // e.g. "Back Pain", "Surya Namaskar", "Morning Routine"
 *   posesCompleted: number,
 *   poseCount: number,        // planned poses (posesCompleted < poseCount = ended early)
 *   durationSec: number,
 *   completedAt: string,      // ISO timestamp
 * }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSIONS_KEY = '@yoga_practice_sessions';
const MAX_SESSIONS = 300; // keep storage bounded

/** Get all practice sessions, newest first */
export const getPracticeSessions = async () => {
  try {
    const json = await AsyncStorage.getItem(SESSIONS_KEY);
    return json ? JSON.parse(json) : [];
  } catch { return []; }
};

/** Save a completed (or partially completed) practice session */
export const savePracticeSession = async (session) => {
  const sessions = await getPracticeSessions();
  const record = {
    id: `session_${Date.now()}`,
    completedAt: new Date().toISOString(),
    ...session,
  };
  sessions.unshift(record);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  return record;
};

/** Delete all practice history */
export const clearPracticeSessions = async () => {
  await AsyncStorage.removeItem(SESSIONS_KEY);
};

/** Local calendar date key (YYYY-MM-DD) for a Date or ISO string */
const dateKey = (d) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Compute practice stats from stored sessions.
 * Returns:
 * {
 *   totalSessions, totalMinutes,
 *   currentStreakDays,        // consecutive days practiced ending today or yesterday
 *   weekSessions, weekMinutes,// last 7 days incl. today
 *   last7Days: [{ key, label, minutes, count }] // oldest → today, for activity bars
 * }
 */
export const getPracticeStats = async () => {
  const sessions = await getPracticeSessions();

  const totalSessions = sessions.length;
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 60);

  // Aggregate minutes/counts per day
  const byDay = {};
  sessions.forEach(s => {
    const key = dateKey(s.completedAt);
    if (!byDay[key]) byDay[key] = { minutes: 0, count: 0 };
    byDay[key].minutes += (s.durationSec || 0) / 60;
    byDay[key].count += 1;
  });

  // Last 7 days (oldest first)
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7Days = [];
  let weekSessions = 0;
  let weekMinutes = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const entry = byDay[key] || { minutes: 0, count: 0 };
    weekSessions += entry.count;
    weekMinutes += entry.minutes;
    last7Days.push({
      key,
      label: dayLabels[d.getDay()],
      minutes: Math.round(entry.minutes),
      count: entry.count,
    });
  }

  // Streak: consecutive practiced days ending today (or yesterday, so a
  // morning check-in doesn't show 0 before today's practice)
  let currentStreakDays = 0;
  const cursor = new Date();
  if (!byDay[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (byDay[dateKey(cursor)]) {
    currentStreakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalSessions,
    totalMinutes,
    currentStreakDays,
    weekSessions,
    weekMinutes: Math.round(weekMinutes),
    last7Days,
  };
};

/** Group sessions by day for the history list: [{ key, title, sessions: [...] }] */
export const groupSessionsByDay = (sessions) => {
  const todayKey = dateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);

  const groups = [];
  const index = {};
  sessions.forEach(s => {
    const key = dateKey(s.completedAt);
    if (!index[key]) {
      const d = new Date(s.completedAt);
      let title;
      if (key === todayKey) title = 'Today';
      else if (key === yesterdayKey) title = 'Yesterday';
      else title = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      index[key] = { key, title, sessions: [] };
      groups.push(index[key]);
    }
    index[key].sessions.push(s);
  });
  return groups;
};

/** Parse a pose duration string like "30 sec", "1 min", "30 sec each" into seconds */
export const parseDurationSec = (duration) => {
  if (typeof duration === 'number') return duration;
  if (!duration || typeof duration !== 'string') return 30;
  const match = duration.match(/(\d+)\s*(sec|min)/i);
  if (!match) return 30;
  let seconds = parseInt(match[1], 10) * (match[2].toLowerCase() === 'min' ? 60 : 1);
  // "30 sec each" = both sides
  if (/each/i.test(duration)) seconds *= 2;
  return Math.max(5, seconds);
};

/** Format seconds as "Xm Ys" / "45s" for display */
export const formatDuration = (totalSec) => {
  const sec = Math.max(0, Math.round(totalSec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
};
