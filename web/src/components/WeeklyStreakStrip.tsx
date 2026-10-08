import { Check, Flame } from "lucide-react";
import type { DayActivity } from "@/lib/storage";

/** Rolling last-7-days practice strip (today last) with the current streak. */
export function WeeklyStreakStrip({
  last7Days,
  currentStreakDays,
}: {
  last7Days: DayActivity[];
  currentStreakDays: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="bg-streak flex size-9 items-center justify-center rounded-full">
          <Flame aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="font-bold">
            {currentStreakDays} {currentStreakDays === 1 ? "day" : "days"}
          </p>
          <p className="text-xs text-muted">Current streak</p>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Practice over the last 7 days">
        {last7Days.map((day, i) => {
          const isToday = i === last7Days.length - 1;
          const practiced = day.count > 0;
          return (
            <li key={day.key} className="flex flex-col items-center gap-1">
              <span
                className={`flex size-8 items-center justify-center rounded-full border-2 ${
                  practiced ? "border-primary bg-primary text-on-primary" : "border-border"
                } ${isToday ? "ring-2 ring-warm ring-offset-2 ring-offset-surface" : ""}`}
              >
                {practiced && <Check aria-hidden="true" className="size-4" />}
              </span>
              <span className={`text-[11px] ${isToday ? "font-bold text-warm" : "text-muted"}`}>
                {day.label}
              </span>
              <span className="sr-only">
                {isToday ? "today, " : ""}
                {practiced ? "practiced" : "no practice"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
