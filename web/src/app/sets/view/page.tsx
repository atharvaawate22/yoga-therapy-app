import type { Metadata } from "next";
import { Suspense } from "react";
import { SetView } from "./SetView";

export const metadata: Metadata = { title: "Custom set" };

export default function ViewSetPage() {
  return (
    <Suspense>
      <SetView />
    </Suspense>
  );
}
