import type { Metadata } from "next";
import { ProgressView } from "./ProgressView";

export const metadata: Metadata = { title: "My progress" };

export default function ProgressPage() {
  return <ProgressView />;
}
