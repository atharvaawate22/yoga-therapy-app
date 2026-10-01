import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  formatDuration,
  getPracticeStats,
  groupSessionsByDay,
  parseDurationSec,
  savePracticeSession,
} from '../sessionStorage';

const daysAgo = (n, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const seed = (completedAts) => AsyncStorage.setItem(
  '@yoga_practice_sessions',
  JSON.stringify(completedAts.map((completedAt, i) => ({
    id: `s${i}`, type: 'routine', title: 'T', posesCompleted: 1, poseCount: 1,
    durationSec: 120, completedAt,
  }))),
);

beforeEach(() => AsyncStorage.clear());

describe('parseDurationSec', () => {
  it.each([
    ['30 sec', 30],
    ['1 min', 60],
    ['2 min', 120],
    ['30 sec each', 60],
    ['45 sec each side', 90],
    ['20–30 sec', 30],
    [undefined, 30],
    [15, 15],
  ])('%p -> %p', (input, expected) => {
    expect(parseDurationSec(input)).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([[45, '45s'], [60, '1m'], [95, '1m 35s'], [0, '0s'], [-5, '0s']])('%p -> %p', (sec, text) => {
    expect(formatDuration(sec)).toBe(text);
  });
});

describe('getPracticeStats', () => {
  it('counts a streak ending today', async () => {
    await seed([daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(4)]);
    expect((await getPracticeStats()).currentStreakDays).toBe(3);
  });

  it('keeps yesterday\'s streak alive before today\'s practice', async () => {
    await seed([daysAgo(1), daysAgo(2)]);
    expect((await getPracticeStats()).currentStreakDays).toBe(2);
  });

  it('resets the streak after a missed day', async () => {
    await seed([daysAgo(2), daysAgo(3)]);
    expect((await getPracticeStats()).currentStreakDays).toBe(0);
  });

  it('sums the last 7 days, oldest first, with today last', async () => {
    await seed([daysAgo(0), daysAgo(0, 18), daysAgo(6), daysAgo(7)]);
    const stats = await getPracticeStats();
    expect(stats.last7Days).toHaveLength(7);
    expect(stats.last7Days[6].count).toBe(2);
    expect(stats.last7Days[0].count).toBe(1);
    expect(stats.weekSessions).toBe(3);
    expect(stats.weekMinutes).toBe(6);
    expect(stats.totalSessions).toBe(4);
  });
});

describe('savePracticeSession', () => {
  it('stores newest first', async () => {
    await savePracticeSession({ title: 'first' });
    await savePracticeSession({ title: 'second' });
    const stored = JSON.parse(await AsyncStorage.getItem('@yoga_practice_sessions'));
    expect(stored.map(s => s.title)).toEqual(['second', 'first']);
  });
});

describe('groupSessionsByDay', () => {
  it('labels today and yesterday and keeps order', () => {
    const groups = groupSessionsByDay([
      { id: 'a', completedAt: daysAgo(0) },
      { id: 'b', completedAt: daysAgo(1) },
      { id: 'c', completedAt: daysAgo(1, 7) },
    ]);
    expect(groups.map(g => g.title)).toEqual(['Today', 'Yesterday']);
    expect(groups[1].sessions.map(s => s.id)).toEqual(['b', 'c']);
  });
});
