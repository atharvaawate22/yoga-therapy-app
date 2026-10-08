import type { Metadata } from "next";
import { Suspense } from "react";
import { CorrectorView } from "./CorrectorView";

export const metadata: Metadata = { title: "Pose corrector" };

export default function CorrectorPage() {
  return (
    <Suspense>
      <CorrectorView />
    </Suspense>
  );
}
