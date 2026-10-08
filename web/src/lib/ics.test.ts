import { describe, expect, it } from "vitest";
import { REMINDER_TIMES, buildDailyReminderIcs } from "./ics";

const morning = REMINDER_TIMES[0];

describe("buildDailyReminderIcs", () => {
  it("is a recurring daily event with an alarm, CRLF line endings", () => {
    const ics = buildDailyReminderIcs(morning, new Date(2026, 9, 8, 6, 0));
    const lines = ics.split("\r\n");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("RRULE:FREQ=DAILY");
    expect(lines).toContain("BEGIN:VALARM");
    expect(lines).toContain("SUMMARY:Time for yoga");
  });

  it("starts today if the time hasn't passed yet", () => {
    const ics = buildDailyReminderIcs(morning, new Date(2026, 9, 8, 6, 59));
    expect(ics).toContain("DTSTART:20261008T070000");
  });

  it("starts tomorrow once the time has passed, across month ends", () => {
    expect(buildDailyReminderIcs(morning, new Date(2026, 9, 8, 7, 0))).toContain(
      "DTSTART:20261009T070000",
    );
    expect(buildDailyReminderIcs(morning, new Date(2026, 9, 31, 22, 0))).toContain(
      "DTSTART:20261101T070000",
    );
  });

  it("uses floating local time (no Z), so the alarm follows the user's clock", () => {
    const evening = REMINDER_TIMES.find((t) => t.key === "afternoon")!;
    const ics = buildDailyReminderIcs(evening, new Date(2026, 9, 8, 9, 0));
    expect(ics).toMatch(/^DTSTART:\d{8}T123000$/m);
  });

  it("offers the same four times as the APK", () => {
    expect(REMINDER_TIMES.map((t) => t.label)).toEqual([
      "7:00 AM",
      "12:30 PM",
      "6:00 PM",
      "9:00 PM",
    ]);
  });
});
