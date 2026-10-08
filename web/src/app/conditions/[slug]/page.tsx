import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONDITIONS, conditionBySlug } from "@/content";
import { ConditionRoutine } from "./ConditionRoutine";

export const dynamicParams = false;

export function generateStaticParams() {
  return CONDITIONS.map((condition) => ({ slug: condition.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/conditions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const condition = conditionBySlug(slug);
  return condition
    ? { title: `Yoga for ${condition.name}`, description: `Recommended yoga poses for ${condition.name}.` }
    : {};
}

export default async function ConditionPage({ params }: PageProps<"/conditions/[slug]">) {
  const { slug } = await params;
  if (!conditionBySlug(slug)) notFound();
  return <ConditionRoutine slug={slug} />;
}
