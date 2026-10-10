import type { Metadata } from "next";
import { Suspense } from "react";
import { CorrectorPlaceholder } from "./CorrectorPlaceholder";

export const metadata: Metadata = { title: "Pose corrector" };

export default function CorrectorPage() {
  return (
    <Suspense>
      <CorrectorPlaceholder />
    </Suspense>
  );
}
