import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeLoader } from "./PracticeLoader";

export const metadata: Metadata = { title: "Guided practice" };

export default function PracticePage() {
  // The routine comes from the query string, which only exists in the
  // browser for a static export.
  return (
    <Suspense fallback={<p className="text-muted">Loading practice…</p>}>
      <PracticeLoader />
    </Suspense>
  );
}
