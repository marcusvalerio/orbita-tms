"use client";

import Link from "next/link";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function LoadsPage() {
  const { data } = useSimulation();
  const locationById = new Map(data.locations.map((l) => [l.id, l]));

  const loads = [...data.loads].sort((a, b) => (a.id < b.id ? 1 : -1));

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Central Operacional"
        title="Cargas"
        meta={<span className="tabular">{loads.length} cargas na operação</span>}
      />
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        <div className="overflow-x-auto rounded-lg border border-cosmic-ink/10 bg-white/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
                <th className="px-4 py-3 font-medium">Carga</th>
                <th className="px-4 py-3 font-medium">Rota</th>
                <th className="px-4 py-3 font-medium">Pedidos</th>
                <th className="px-4 py-3 font-medium">Peso</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => {
                const origin = locationById.get(load.originId);
                const destination = locationById.get(load.destinationId);
                const isPending = load.status === "Aguardando transporte";
                return (
                  <tr key={load.id} className="border-b border-cosmic-ink/5 last:border-0 hover:bg-blue-opal/5 transition-colors">
                    <td className="px-4 py-3 font-display font-medium text-cosmic-ink whitespace-nowrap">{load.id}</td>
                    <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">
                      {origin?.city} → {destination?.city}
                    </td>
                    <td className="px-4 py-3 tabular text-cosmic-ink/80 whitespace-nowrap">{load.orderIds.length}</td>
                    <td className="px-4 py-3 tabular text-cosmic-ink/80 whitespace-nowrap">
                      {load.totalWeightKg.toLocaleString("pt-BR")} kg
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={load.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {isPending ? (
                        <Link href={`/contratacao?load=${load.id}`} className="text-xs font-medium text-blue-opal hover:underline">
                          Contratar
                        </Link>
                      ) : load.shipmentId ? (
                        <Link href={`/shipments/${load.shipmentId}`} className="text-xs font-medium text-blue-opal hover:underline">
                          Ver viagem
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {loads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-cosmic-ink/45">
                    Nenhuma carga formada ainda.
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
