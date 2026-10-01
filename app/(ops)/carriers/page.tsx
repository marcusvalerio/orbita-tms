import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { CarriersWorkspace } from "./CarriersWorkspace";

export const metadata = { title: "Transportadoras" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CarriersWorkspace />
    </Suspense>
  );
}
