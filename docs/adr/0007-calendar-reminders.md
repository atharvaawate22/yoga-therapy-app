# 0007 · Calendar reminders instead of push notifications

**Context.**
- The APK schedules a local daily reminder.
- A browser can't show a notification while the page is closed unless it uses Web Push.
- Web Push needs a server, VAPID keys and a subscription store, and on iOS it only works for installed apps.

**Decision.** Settings offers "Add a daily reminder to your calendar". It
generates an `.ics` file with a daily `RRULE`, which every phone and desktop
calendar understands.

**Consequences.**
- There is no backend and no permission prompt.
- The reminder survives clearing the browser's data.
- It is a weaker version of the APK's feature, and the README's Web vs Android table says so.
