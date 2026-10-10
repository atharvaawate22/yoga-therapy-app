"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, House, Settings, type LucideIcon } from "lucide-react";
import { useClientValue } from "@/lib/hooks/useClientValue";
import { useServiceWorker } from "@/lib/pwa/useServiceWorker";
import { isPersistent } from "@/lib/storage/asyncStorageShim";

const TABS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: House },
  { href: "/progress", label: "Progress", icon: ChartColumn },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * App frame: a top bar on wide screens and a bottom tab bar on phones
 * (Home / Progress / Settings, as in the APK).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const storageOk = useClientValue(isPersistent, true);
  const { updateReady, applyUpdate } = useServiceWorker();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-primary px-3 py-2 text-on-primary focus:not-sr-only focus:absolute focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/" className="font-bold text-primary">
            Yoga Therapy
          </Link>
          <nav aria-label="Main" className="hidden gap-1 sm:flex">
            {TABS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-alt aria-[current=page]:text-primary"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {updateReady && (
        <div role="status" className="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-sm text-on-primary">
          A new version of the app is ready.
          <button
            type="button"
            onClick={applyUpdate}
            className="rounded-md bg-on-primary px-3 py-1 font-semibold text-primary"
          >
            Reload
          </button>
        </div>
      )}

      {!storageOk && (
        <p role="status" className="bg-[#fff3e0] px-4 py-2 text-center text-sm text-[#7a3e00]">
          This browser is blocking site storage, so your progress won&apos;t be saved after you
          leave.
        </p>
      )}

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-6 sm:pb-12">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="grid grid-cols-3">
          {TABS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted aria-[current=page]:text-primary"
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
