import type { Metadata } from "next";
import { InferenceLab } from "./InferenceLab";

export const metadata: Metadata = {
  title: "Inference lab",
  description: "Developer page: MoveNet in the browser, compared with the server.",
  robots: { index: false },
};

export default function LabPage() {
  return <InferenceLab />;
}
