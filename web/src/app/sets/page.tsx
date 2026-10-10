import type { Metadata } from "next";
import { Suspense } from "react";
import { SetList } from "./SetList";

export const metadata: Metadata = { title: "My custom sets" };

export default function SetsPage() {
  return (
    <Suspense>
      <SetList />
    </Suspense>
  );
}
