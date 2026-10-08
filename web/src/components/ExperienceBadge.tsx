import { Flame, Leaf, Trophy, type LucideIcon } from "lucide-react";

const LEVELS: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  beginner: {
    label: "Beginner",
    icon: Leaf,
    color: "var(--level-beginner)",
    bg: "var(--level-beginner-bg)",
  },
  intermediate: {
    label: "Intermediate",
    icon: Flame,
    color: "var(--level-intermediate)",
    bg: "var(--level-intermediate-bg)",
  },
  expert: {
    label: "Expert",
    icon: Trophy,
    color: "var(--level-expert)",
    bg: "var(--level-expert-bg)",
  },
  advanced: {
    label: "Advanced",
    icon: Trophy,
    color: "var(--level-expert)",
    bg: "var(--level-expert-bg)",
  },
};

export function levelLabel(level: string): string {
  return (LEVELS[level] ?? LEVELS.beginner!).label;
}

export function ExperienceBadge({ level, small = false }: { level: string; small?: boolean }) {
  const config = LEVELS[level] ?? LEVELS.beginner!;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      <Icon aria-hidden="true" className={small ? "size-3" : "size-3.5"} />
      {config.label}
    </span>
  );
}
