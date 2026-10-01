/**
 * Daily practice reminder helpers (expo-notifications, local only)
 *
 * Note: local scheduled notifications work in Expo Go and dev/production
 * builds; no push infrastructure is needed.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const REMINDER_KEY = '@yoga_daily_reminder';
const CHANNEL_ID = 'practice-reminders';

export const REMINDER_OPTIONS = [
  { key: 'off', label: 'Off' },
  { key: 'morning', label: '7:00 AM', hour: 7, minute: 0 },
  { key: 'afternoon', label: '12:30 PM', hour: 12, minute: 30 },
  { key: 'evening', label: '6:00 PM', hour: 18, minute: 0 },
  { key: 'night', label: '9:00 PM', hour: 21, minute: 0 },
];

/** Get saved reminder setting: { key: 'off' | option key } */
export const getReminderSetting = async () => {
  try {
    const json = await AsyncStorage.getItem(REMINDER_KEY);
    return json ? JSON.parse(json) : { key: 'off' };
  } catch { return { key: 'off' }; }
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Practice Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
};

/**
 * Apply a reminder choice (one of REMINDER_OPTIONS keys).
 * Returns { ok: boolean, reason?: 'permission-denied' | 'error' }
 *
 * If permission is denied, the previous reminder is left exactly as it was
 * (still scheduled and still saved), so callers can simply restore their UI.
 */
export const applyReminderSetting = async (key) => {
  const option = REMINDER_OPTIONS.find(o => o.key === key) || REMINDER_OPTIONS[0];
  try {
    if (option.key === 'off') {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ key: 'off' }));
      return { ok: true };
    }

    // Check permission before touching the existing schedule: cancelling
    // first meant a denial silently removed a reminder the UI still showed.
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, reason: 'permission-denied' };
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for yoga 🧘',
        body: 'A few minutes of practice keeps your streak alive. Roll out your mat!',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: option.hour,
        minute: option.minute,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });

    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ key: option.key }));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
};
