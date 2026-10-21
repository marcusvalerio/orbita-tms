import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { OccurrencesWorkspace } from "./OccurrencesWorkspace";

export const metadata = { title: "Ocorrências" };

export default function OccurrencesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <OccurrencesWorkspace />
    </Suspense>
  );
}
