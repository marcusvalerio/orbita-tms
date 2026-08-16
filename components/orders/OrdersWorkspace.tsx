"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Order, Location, Customer, Load, Shipment, OrderEvent } from "@/lib/domain/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

const LIFECYCLE_STAGES = ["Criado", "Validado", "Planejamento", "Carga", "Embarque", "Entrega"] as const;

function stageIndexForOrder(order: Order, hasLoad: boolean, hasShipment: boolean): number {
  if (order.status === "Entregue") return 5;
  if (hasShipment) return 4;
  if (hasLoad) return 3;
  if (order.status === "Planejado" || order.status === "Em transporte" || order.status === "Com ocorrência") return 2;
  return 1;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function OrdersWorkspace({
  orders,
  locationById,
  customerById,
  loadByOrderId,
  shipmentByLoadId,
  orderEvents,
}: {
  orders: Order[];
  locationById: Map<string, Location>;
  customerById: Map<string, Customer>;
  loadByOrderId: Map<string, Load>;
  shipmentByLoadId: Map<string, Shipment>;
  orderEvents: OrderEvent[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="overflow-x-auto rounded-lg border border-cosmic-ink/10 bg-white/60 m-6 md:m-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Rota</th>
                <th className="px-4 py-3 font-medium">Peso</th>
                <th className="px-4 py-3 font-medium">Prazo</th>
                <th className="px-4 py-3 font-medium">Prioridade</th>
                <th className="px-4 py-3 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const origin = locationById.get(order.originId);
                const destination = locationById.get(order.destinationId);
                const isSelected = order.id === selectedId;
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`cursor-pointer border-b border-cosmic-ink/5 last:border-0 transition-colors ${
                      isSelected ? "bg-blue-opal/10" : "hover:bg-blue-opal/5"
                    }`}
                  >
                    <td className="px-4 py-3 font-display font-medium text-cosmic-ink whitespace-nowrap">
                      {order.id}
                    </td>
                    <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">
                      {origin?.city} → {destination?.city}
                    </td>
                    <td className="px-4 py-3 tabular text-cosmic-ink/80 whitespace-nowrap">
                      {order.totalWeightKg.toLocaleString("pt-BR")} kg
                    </td>
                    <td className="px-4 py-3 tabular text-cosmic-ink/80 whitespace-nowrap">
                      {formatDate(order.dueDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PriorityTag priority={order.priority} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <OrderDetailPanel
          order={selected}
          origin={locationById.get(selected.originId)}
          destination={locationById.get(selected.destinationId)}
          customer={customerById.get(selected.customerId)}
          load={loadByOrderId.get(selected.id)}
          shipment={
            loadByOrderId.get(selected.id)
              ? shipmentByLoadId.get(loadByOrderId.get(selected.id)!.id)
              : undefined
          }
          events={orderEvents.filter((e) => e.orderId === selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function OrderDetailPanel({
  order,
  origin,
  destination,
  customer,
  load,
  shipment,
  events,
  onClose,
}: {
  order: Order;
  origin?: Location;
  destination?: Location;
  customer?: Customer;
  load?: Load;
  shipment?: Shipment;
  events: OrderEvent[];
  onClose: () => void;
}) {
  const stageIndex = stageIndexForOrder(order, !!load, !!shipment);
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <aside className="w-full max-w-sm shrink-0 border-l border-cosmic-ink/10 bg-white/70 overflow-y-auto">
      <div className="px-6 py-5 border-b border-cosmic-ink/10 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-1">Detalhes do Pedido</p>
          <h2 className="font-display font-semibold text-lg text-cosmic-ink">{order.id}</h2>
          <p className="text-sm text-cosmic-ink/60 mt-0.5">{customer?.name ?? "Cliente"}</p>
        </div>
        <button
          onClick={onClose}
          className="text-cosmic-ink/40 hover:text-cosmic-ink text-sm"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>

      <div className="px-6 py-5 border-b border-cosmic-ink/10">
        <p className="text-sm text-cosmic-ink/80 mb-3">
          {origin?.city} → {destination?.city}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-2">Situação atual</p>
        <StatusBadge status={order.status} />
      </div>

      <div className="px-6 py-5 border-b border-cosmic-ink/10">
        <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-3">Ciclo de Vida do Pedido</p>
        <ol className="space-y-2">
          {LIFECYCLE_STAGES.map((stage, i) => {
            const isDone = i < stageIndex;
            const isCurrent = i === stageIndex;
            return (
              <li key={stage} className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    isDone
                      ? "bg-blue-opal"
                      : isCurrent
                      ? "bg-rowdy-orange"
                      : "bg-cosmic-ink/15"
                  }`}
                />
                <span
                  className={
                    isCurrent
                      ? "font-medium text-cosmic-ink"
                      : isDone
                      ? "text-cosmic-ink/70"
                      : "text-cosmic-ink/35"
                  }
                >
                  {stage}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-6 py-5 border-b border-cosmic-ink/10 grid grid-cols-2 gap-y-3 text-sm">
        <DetailField label="Peso" value={`${order.totalWeightKg.toLocaleString("pt-BR")} kg`} />
        <DetailField label="Volume" value={`${order.totalVolumeM3} m³`} />
        <DetailField label="Prioridade" value={order.priority} />
        <DetailField label="Prazo" value={formatDate(order.dueDate)} />
        {load && <DetailField label="Carga" value={load.id} />}
        {shipment && <DetailField label="Embarque" value={shipment.id} />}
      </div>

      {sortedEvents.length > 0 && (
        <div className="px-6 py-5 border-b border-cosmic-ink/10">
          <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-3">Histórico</p>
          <ol className="space-y-3">
            {sortedEvents.map((event) => (
              <li key={event.id} className="text-sm">
                <p className="text-cosmic-ink/40 text-xs tabular">{formatDateTime(event.timestamp)}</p>
                <p className="text-cosmic-ink/80">{event.message}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {order.status === "Aguardando planejamento" && (
        <div className="px-6 py-5">
          <PlanTransportButton orderId={order.id} />
        </div>
      )}
      {shipment && (
        <div className="px-6 py-5">
          <Link
            href={`/shipments/${shipment.id}`}
            className="block w-full text-center rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2.5 hover:bg-cosmic-ink/5 transition-colors"
          >
            Ver Embarque {shipment.id}
          </Link>
        </div>
      )}
    </aside>
  );
}

function PlanTransportButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/planning?order=${orderId}`)}
      className="w-full rounded-md bg-blue-opal text-white text-sm font-medium py-2.5 hover:bg-blue-opal/90 transition-colors"
    >
      Planejar Transporte
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/40">{label}</p>
      <p className="text-cosmic-ink/85 tabular">{value}</p>
    </div>
  );
}

function PriorityTag({ priority }: { priority: "Normal" | "Alta" | "Urgente" }) {
  const style =
    priority === "Urgente"
      ? "text-cinnamon"
      : priority === "Alta"
      ? "text-rowdy-orange"
      : "text-cosmic-ink/50";
  return <span className={`text-xs font-medium ${style}`}>{priority}</span>;
}
