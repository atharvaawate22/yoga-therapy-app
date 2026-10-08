/**
 * A daily practice reminder as an iCalendar (.ics) event.
 *
 * Browsers can't schedule a notification while the page is closed (the APK
 * uses expo-notifications), so the web app hands the reminder to the user's
 * calendar instead: a recurring event with an alarm, which every calendar app
 * imports.
 */

/** Same choices as the APK (src/utils/reminders.js), minus "Off". */
export const REMINDER_TIMES = [
  { key: "morning", label: "7:00 AM", hour: 7, minute: 0 },
  { key: "afternoon", label: "12:30 PM", hour: 12, minute: 30 },
  { key: "evening", label: "6:00 PM", hour: 18, minute: 0 },
  { key: "night", label: "9:00 PM", hour: 21, minute: 0 },
] as const;

export type ReminderTime = (typeof REMINDER_TIMES)[number];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local "floating" time: calendars show it at that wall-clock time wherever the user is. */
function localDateTime(date: Date, hour: number, minute: number): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(hour)}${pad(minute)}00`;
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Build the .ics text. The first occurrence is today if the time hasn't
 * passed yet, otherwise tomorrow. Lines end in CRLF, as RFC 5545 requires.
 */
export function buildDailyReminderIcs(
  time: Pick<ReminderTime, "key" | "hour" | "minute">,
  now = new Date(),
): string {
  const first = new Date(now);
  if (now.getHours() * 60 + now.getMinutes() >= time.hour * 60 + time.minute) {
    first.setDate(first.getDate() + 1);
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Yoga Therapy//Daily reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:yoga-therapy-daily-${time.key}-${utcStamp(now)}@yoga-therapy`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localDateTime(first, time.hour, time.minute)}`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Time for yoga",
    "DESCRIPTION:A few minutes of practice keeps your streak alive. Roll out your mat!",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Time for yoga",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Offer text as a file download. */
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
