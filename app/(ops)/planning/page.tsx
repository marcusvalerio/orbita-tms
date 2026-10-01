import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { PlanningFlow } from "./PlanningFlow";

export const metadata = { title: "Planejamento" };

export default function PlanningPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PlanningFlow />
    </Suspense>
  );
}
