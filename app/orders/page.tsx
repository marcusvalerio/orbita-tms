"use client";

import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { OrdersWorkspace } from "@/components/orders/OrdersWorkspace";

export default function OrdersPage() {
  const { data } = useSimulation();

  const locationById = new Map(data.locations.map((l) => [l.id, l]));
  const customerById = new Map(data.customers.map((c) => [c.id, c]));
  const loadByOrderId = new Map(
    data.loads.flatMap((load) => load.orderIds.map((orderId) => [orderId, load] as const))
  );
  const shipmentByLoadId = new Map(data.shipments.map((s) => [s.loadId, s]));

  const orders = [...data.orders].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const awaitingPlanning = orders.filter((o) => o.status === "Aguardando planejamento").length;
  const planned = orders.filter((o) => o.status === "Planejado").length;
  const inTransit = orders.filter((o) => o.status === "Em transporte").length;
  const completed = orders.filter((o) => o.status === "Entregue").length;

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Operações"
        title="Pedidos"
        meta={
          <span className="tabular">
            {orders.length} total · {awaitingPlanning} aguardando planejamento · {planned} planejados ·{" "}
            {inTransit} em transporte · {completed} concluídos
          </span>
        }
      />
      <OrdersWorkspace
        orders={orders}
        locationById={locationById}
        customerById={customerById}
        loadByOrderId={loadByOrderId}
        shipmentByLoadId={shipmentByLoadId}
        orderEvents={data.orderEvents}
      />
    </div>
  );
}
