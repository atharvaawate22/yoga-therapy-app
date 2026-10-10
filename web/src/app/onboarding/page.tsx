import type { Metadata } from "next";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return <ProfileForm mode="onboarding" />;
}
