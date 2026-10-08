import type { Metadata } from "next";
import { Suspense } from "react";
import { SetEditor } from "./SetEditor";

export const metadata: Metadata = { title: "Edit custom set" };

export default function EditSetPage() {
  return (
    <Suspense>
      <SetEditor />
    </Suspense>
  );
}
