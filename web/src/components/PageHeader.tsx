import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  /** Where "Back" goes. Links rather than history.back(), so deep links work. */
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({ title, subtitle, backHref, backLabel = "Back" }: Props) {
  return (
    <header className="flex flex-col gap-1">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      )}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </header>
  );
}
