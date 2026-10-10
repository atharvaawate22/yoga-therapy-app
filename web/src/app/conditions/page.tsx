import type { Metadata } from "next";
import { HealthScanner } from "./HealthScanner";

export const metadata: Metadata = { title: "Health Scanner" };

export default function ConditionsPage() {
  return <HealthScanner />;
}
