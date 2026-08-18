"use client";

import Link from "next/link";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

const RESULT_LABELS: Record<string, string> = {
  Delivered: "Entregue",
  "Partial Delivery": "Entrega Parcial",
  Failed: "Não Realizada",
  Returned: "Devolvida",
};

const RESULT_STYLES: Record<string, string> = {
  Delivered: "bg-emerald-600/10 text-emerald-700",
  "Partial Delivery": "bg-rowdy-orange/15 text-rowdy-orange",
  Failed: "bg-cinnamon/15 text-cinnamon",
  Returned: "bg-cinnamon/15 text-cinnamon",
};

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function DeliveriesPage() {
  const { data } = useSimulation();
  const customerById = new Map(data.customers.map((c) => [c.id, c]));

  const deliveries = [...data.deliveries].sort((a, b) => (a.id < b.id ? 1 : -1));

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Central Operacional"
        title="Entregas"
        meta={<span className="tabular">{deliveries.length} entregas registradas</span>}
      />
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        <div className="overflow-x-auto rounded-lg border border-cosmic-ink/10 bg-white/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
                <th className="px-4 py-3 font-medium">Entrega</th>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Viagem</th>
                <th className="px-4 py-3 font-medium">Concluída em</th>
                <th className="px-4 py-3 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="border-b border-cosmic-ink/5 last:border-0 hover:bg-blue-opal/5 transition-colors">
                  <td className="px-4 py-3 font-display font-medium text-cosmic-ink whitespace-nowrap">{delivery.id}</td>
                  <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">{delivery.orderId}</td>
                  <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">
                    {customerById.get(delivery.customerId)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/shipments/${delivery.shipmentId}`} className="text-blue-opal hover:underline">
                      {delivery.shipmentId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular text-cosmic-ink/80 whitespace-nowrap">
                    {formatDateTime(delivery.completedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {delivery.result && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${RESULT_STYLES[delivery.result]}`}>
                        {RESULT_LABELS[delivery.result]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-cosmic-ink/45">
                    Nenhuma entrega concluída ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
