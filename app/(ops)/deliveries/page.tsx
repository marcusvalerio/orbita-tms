import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { DeliveriesWorkspace } from "./DeliveriesWorkspace";

export const metadata = { title: "Entregas" };

export default function DeliveriesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DeliveriesWorkspace />
    </Suspense>
  );
}
