import type { Metadata } from "next";
import { SuryaPractice } from "./SuryaPractice";

export const metadata: Metadata = { title: "Surya Namaskar" };

export default function SuryaPage() {
  return <SuryaPractice />;
}
