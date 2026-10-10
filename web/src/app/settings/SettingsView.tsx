"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  CalendarPlus,
  ChevronRight,
  Download,
  Leaf,
  Trash2,
  Upload,
  User,
  Volume2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExperienceBadge } from "@/components/ExperienceBadge";
import { InstallCard } from "@/components/InstallCard";
import { PageHeader } from "@/components/PageHeader";
import { REMINDER_TIMES, buildDailyReminderIcs, downloadText } from "@/lib/ics";
import { useStored } from "@/lib/hooks/useStored";
import { cachedModels } from "@/lib/pwa/offline";
import {
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  type Backup,
} from "@/lib/storage/backup";
import {
  clearPracticeSessions,
  getProfile,
  getVoiceEnabled,
  setVoiceEnabled,
} from "@/lib/storage";
import webPackage from "../../../package.json";

type Dialog =
  | { kind: "clear" }
  | { kind: "restore"; backup: Backup; sessionCount: number }
  | { kind: "notice"; title: string; body: string };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{children}</h2>;
}

export function SettingsView() {
  const { value: profile } = useStored(getProfile);
  const { value: voiceOn, reload: reloadVoice } = useStored(getVoiceEnabled);
  const { value: offlineModels } = useStored(cachedModels);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const backup = await createBackup();
    downloadText(backupFileName(), JSON.stringify(backup, null, 2), "application/json");
  };

  const importFile = async (file: File) => {
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setDialog({ kind: "notice", title: "Can't import that file", body: result.error });
      return;
    }
    setDialog({ kind: "restore", backup: result.backup, sessionCount: result.sessionCount });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" />

      <section aria-label="Profile" className="flex flex-col gap-3">
        <SectionLabel>Profile</SectionLabel>
        <Link
          href="/profile"
          className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 hover:bg-surface-alt"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-alt text-primary">
            <User aria-hidden="true" className="size-5" />
          </span>
          <span className="flex flex-1 flex-col items-start gap-1">
            <span className="font-semibold">{profile?.name ?? "Yogi"}</span>
            {profile && <ExperienceBadge level={profile.experience} small />}
          </span>
          <span className="sr-only">Edit profile</span>
          <ChevronRight aria-hidden="true" className="size-5 text-muted" />
        </Link>
      </section>

      <section aria-label="Practice" className="flex flex-col gap-3">
        <SectionLabel>Practice</SectionLabel>
        <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <span className="flex size-10 items-center justify-center rounded-lg bg-surface-alt text-primary">
            <Volume2 aria-hidden="true" className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Voice guidance</span>
            <span className="block text-sm text-muted">Spoken cues during guided practice</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={voiceOn ?? true}
            disabled={voiceOn === undefined}
            onChange={async (event) => {
              await setVoiceEnabled(event.target.checked);
              await reloadVoice();
            }}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full bg-border transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2"
          />
        </label>
      </section>

      <section aria-label="Daily reminder" className="flex flex-col gap-3">
        <SectionLabel>Daily reminder</SectionLabel>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="flex items-start gap-3">
            <CalendarPlus aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="text-sm text-muted">
              Browsers can&apos;t send a notification while the app is closed, so the reminder goes
              in your calendar instead: pick a time to download a daily event, then open it to add
              it.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {REMINDER_TIMES.map((time) => (
              <button
                key={time.key}
                type="button"
                onClick={() =>
                  downloadText(
                    `yoga-reminder-${time.key}.ics`,
                    buildDailyReminderIcs(time),
                    "text/calendar",
                  )
                }
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-alt"
              >
                {time.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="install" aria-label="Install the app" className="flex flex-col gap-3">
        <SectionLabel>Install the app</SectionLabel>
        <InstallCard />
      </section>

      <section aria-label="Offline" className="flex flex-col gap-3">
        <SectionLabel>Offline</SectionLabel>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Routines, practice and your progress work offline once the app has loaded.{" "}
          {offlineModels && offlineModels.length > 0
            ? `The pose corrector is ready offline too (${offlineModels.map((m) => `MoveNet ${m[0]!.toUpperCase()}${m.slice(1)}`).join(", ")} saved on this device).`
            : "Open the pose corrector once while online and it will work offline afterwards."}
        </p>
      </section>

      <section aria-label="Your data" className="flex flex-col gap-3">
        <SectionLabel>Your data</SectionLabel>
        <p className="text-sm text-muted">
          Everything is stored in this browser only. Export a backup to move it to another device or
          keep it safe if you clear your browser data.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void exportData()}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 font-semibold hover:bg-surface-alt"
          >
            <Download aria-hidden="true" className="size-5 text-primary" />
            Export backup
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 font-semibold hover:bg-surface-alt"
          >
            <Upload aria-hidden="true" className="size-5 text-primary" />
            Import backup
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Backup file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => setDialog({ kind: "clear" })}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 font-semibold text-danger hover:bg-surface-alt"
        >
          <Trash2 aria-hidden="true" className="size-5" />
          Clear practice history
        </button>
      </section>

      <p className="flex items-center justify-center gap-2 text-center text-sm text-muted">
        <Leaf aria-hidden="true" className="size-4" />
        Yoga Therapy web · v{webPackage.version} · Practice safely.
      </p>

      <ConfirmDialog
        open={dialog?.kind === "clear"}
        title="Clear practice history?"
        confirmLabel="Delete everything"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          await clearPracticeSessions();
          setDialog({
            kind: "notice",
            title: "History cleared",
            body: "Your practice history has been deleted.",
          });
        }}
      >
        This permanently deletes all sessions, streaks and stats. This cannot be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "restore"}
        title="Replace your data?"
        confirmLabel="Replace"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "restore") return;
          await restoreBackup(dialog.backup);
          // Reload so every screen re-reads the restored data.
          window.location.reload();
        }}
      >
        {dialog?.kind === "restore" &&
          `This backup from ${new Date(dialog.backup.exportedAt).toLocaleDateString()} has ${dialog.sessionCount} practice session${dialog.sessionCount === 1 ? "" : "s"}. It will replace everything stored in this browser.`}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "notice"}
        title={dialog?.kind === "notice" ? dialog.title : ""}
        confirmLabel="OK"
        hideCancel
        onCancel={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
      >
        {dialog?.kind === "notice" && dialog.body}
      </ConfirmDialog>
    </div>
  );
}
