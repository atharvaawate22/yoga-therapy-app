import Link from "next/link";
import { Timer } from "lucide-react";
import type { Pose } from "@/content";
import { ExperienceBadge } from "./ExperienceBadge";
import { PoseImage } from "./PoseImage";

export function PoseCard({ pose, position }: { pose: Pose; position?: number }) {
  return (
    <Link
      href={`/poses/${pose.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:bg-surface-alt"
    >
      <div className="relative">
        <PoseImage
          poseId={pose.id}
          image={pose.image}
          alt=""
          className="aspect-[4/3] h-auto w-full"
          sizes="(min-width: 640px) 50vw, 100vw"
        />
        {position !== undefined && (
          <span className="absolute left-3 top-3 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
            {position}
          </span>
        )}
        <span className="absolute right-3 top-3">
          <ExperienceBadge level={pose.difficulty} small />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold">{pose.name}</h3>
        {pose.sanskritName && <p className="text-sm italic text-muted">{pose.sanskritName}</p>}
        <p className="line-clamp-2 text-sm text-muted">{pose.description}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
          <span className="inline-flex items-center gap-1 text-muted">
            <Timer aria-hidden="true" className="size-4" />
            {pose.duration}
          </span>
          <span className="font-semibold text-primary group-hover:underline">View steps →</span>
        </div>
      </div>
    </Link>
  );
}
