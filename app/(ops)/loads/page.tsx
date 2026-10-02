import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { LoadsWorkspace } from "./LoadsWorkspace";

export const metadata = { title: "Cargas" };

export default function LoadsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoadsWorkspace />
    </Suspense>
  );
}
