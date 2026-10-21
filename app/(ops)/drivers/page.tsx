import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { DriversWorkspace } from "./DriversWorkspace";

export const metadata = { title: "Motoristas" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DriversWorkspace />
    </Suspense>
  );
}
