import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Camera,
  ChartColumn,
  ChevronRight,
  Footprints,
  Info,
  Sparkles,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { ExperienceBadge, levelLabel } from "@/components/ExperienceBadge";
import { PageHeader } from "@/components/PageHeader";
import { PoseImage } from "@/components/PoseImage";
import { ALL_POSES, poseById } from "@/content";
import { FavoriteButton } from "./FavoriteButton";

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_POSES.map((pose) => ({ id: pose.id }));
}

export async function generateMetadata({ params }: PageProps<"/poses/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pose = poseById(id);
  return pose ? { title: pose.name, description: pose.description } : {};
}

function Card({
  icon: Icon,
  title,
  tone = "default",
  children,
}: {
  icon: typeof Info;
  title: string;
  tone?: "default" | "caution";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-5 ${
        tone === "caution"
          ? "border-[#ffe0b2] bg-[#fff8e1] dark:border-[#5c4415] dark:bg-[#2b2210]"
          : "border-border bg-surface"
      }`}
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon
          aria-hidden="true"
          className={`size-4 ${tone === "caution" ? "text-warm" : "text-primary"}`}
        />
        {title}
      </h2>
      <div className="mt-3 text-muted">{children}</div>
    </section>
  );
}

export default async function PoseDetailPage({ params }: PageProps<"/poses/[id]">) {
  const { id } = await params;
  const pose = poseById(id);
  if (!pose) notFound();

  return (
    <article className="flex flex-col gap-6">
      <PageHeader title={pose.name} subtitle={pose.sanskritName} backHref="/" backLabel="Home" />

      <div className="relative overflow-hidden rounded-2xl border border-border">
        <PoseImage
          poseId={pose.id}
          image={pose.image}
          alt={`${pose.name} demonstration`}
          className="aspect-[4/3] h-auto w-full sm:aspect-[16/9]"
          sizes="(min-width: 896px) 896px, 100vw"
          priority
        />
        <span className="absolute left-3 top-3">
          <ExperienceBadge level={pose.difficulty} />
        </span>
        <span className="absolute right-3 top-3">
          <FavoriteButton poseId={pose.id} poseName={pose.name} />
        </span>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-border rounded-xl border border-border bg-surface text-center">
        <div className="flex flex-col items-center gap-1 p-4">
          <Timer aria-hidden="true" className="size-5 text-primary" />
          <dt className="text-xs text-muted">Duration</dt>
          <dd className="font-semibold">{pose.duration}</dd>
        </div>
        <div className="flex flex-col items-center gap-1 p-4">
          <ChartColumn aria-hidden="true" className="size-5 text-primary" />
          <dt className="text-xs text-muted">Level</dt>
          <dd className="font-semibold">{levelLabel(pose.difficulty)}</dd>
        </div>
      </dl>

      <Card icon={Info} title="About this pose">
        <p>{pose.description}</p>
      </Card>

      {pose.steps.length > 0 && (
        <Card icon={Footprints} title="How to do it">
          <ol className="flex flex-col gap-3">
            {pose.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
                  {index + 1}
                </span>
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {pose.benefits.length > 0 && (
        <Card icon={Sparkles} title="Benefits">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {pose.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </Card>
      )}

      {pose.precautions.length > 0 && (
        <Card icon={TriangleAlert} title="Precautions" tone="caution">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {pose.precautions.map((precaution) => (
              <li key={precaution}>{precaution}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/practice?pose=${pose.id}`}
          className="flex items-center gap-3 rounded-xl bg-primary p-4 text-on-primary hover:bg-primary-strong"
        >
          <Timer aria-hidden="true" className="size-6" />
          <span className="flex-1">
            <span className="block font-semibold">Practice with timer</span>
            <span className="block text-sm opacity-85">Guided hold for {pose.duration} with voice cues</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
        <Link
          href={`/corrector?pose=${pose.id}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-surface-alt"
        >
          <Camera aria-hidden="true" className="size-6 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">Try the pose corrector</span>
            <span className="block text-sm text-muted">Check your alignment with a camera</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 text-muted" />
        </Link>
      </div>
    </article>
  );
}
