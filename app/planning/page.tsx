import { getOperationData } from "@/lib/data/atlas";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { PlanningWorkspace } from "@/components/planning/PlanningWorkspace";

export default function PlanningPage() {
  const data = getOperationData();
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
      />
    </>
  );
}
