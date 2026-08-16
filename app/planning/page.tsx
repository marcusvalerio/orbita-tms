"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { PlanningWorkspace } from "@/components/planning/PlanningWorkspace";

function PlanningPageInner() {
  const { data } = useSimulation();
  const searchParams = useSearchParams();
  const preselectedOrderId = searchParams.get("order");

  const locationById = new Map(data.locations.map((l) => [l.id, l]));
  const ordersAwaiting = data.orders.filter((o) => o.status === "Aguardando planejamento");

  return (
    <>
      <WorkspaceHeader
        section="Planning"
        title="Planning"
        meta={<span className="tabular">{ordersAwaiting.length} pedidos aguardando planejamento</span>}
      />
      <PlanningWorkspace
        orders={ordersAwaiting}
        locationById={locationById}
        carriers={data.carriers}
        vehicles={data.vehicles}
        preselectedOrderId={preselectedOrderId}
      />
    </>
  );
}

export default function PlanningPage() {
  return (
    <Suspense fallback={null}>
      <PlanningPageInner />
    </Suspense>
  );
}
