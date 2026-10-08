import type { Metadata } from "next";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata: Metadata = { title: "Edit profile" };

export default function ProfilePage() {
  return <ProfileForm mode="edit" />;
}
