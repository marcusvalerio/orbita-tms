import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { FleetWorkspace } from "./FleetWorkspace";

export const metadata = { title: "Frota" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FleetWorkspace />
    </Suspense>
  );
}
