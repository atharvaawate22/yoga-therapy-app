import Link from "next/link";
import {
  Apple,
  BicepsFlexed,
  Bone,
  Brain,
  ChevronRight,
  Flame,
  Footprints,
  Leaf,
  Moon,
  PersonStanding,
  Ruler,
  Waves,
  type LucideIcon,
} from "lucide-react";

// Web stand-ins for the RN app's per-condition icons (components/ProblemCard.js).
const CONDITION_ICONS: Record<string, LucideIcon> = {
  "Back Pain": PersonStanding,
  "Hip Alignment Issue": Footprints,
  "Scapula Winging": BicepsFlexed,
  Headache: Brain,
  Stress: Waves,
  Anxiety: Leaf,
  "Poor Posture": Ruler,
  Insomnia: Moon,
  "Knee Pain": Bone,
  "Digestion Issues": Apple,
  "Weight Loss": Flame,
};

interface Props {
  name: string;
  href: string;
  poseCount: number;
}

export function ConditionCard({ name, href, poseCount }: Props) {
  const Icon = CONDITION_ICONS[name] ?? PersonStanding;
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-alt"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-primary">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{name}</span>
        <span className="block text-sm text-muted">
          {poseCount} {poseCount === 1 ? "pose" : "poses"} available
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 text-muted" />
    </Link>
  );
}
