"use client";

import Link from "next/link";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function ShipmentsPage() {
  const { data } = useSimulation();
  const locationById = new Map(data.locations.map((l) => [l.id, l]));
  const carrierById = new Map(data.carriers.map((c) => [c.id, c]));

  const shipments = [...data.shipments].sort(
    (a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime()
  );

  return (
    <>
      <WorkspaceHeader
        section="Operations"
        title="Shipments"
        meta={<span className="tabular">{shipments.length} viagens na operação</span>}
      />
      <div className="px-6 md:px-10 py-6">
        <div className="overflow-x-auto rounded-lg border border-cosmic-ink/10 bg-white/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
                <th className="px-4 py-3 font-medium">Viagem</th>
                <th className="px-4 py-3 font-medium">Rota</th>
                <th className="px-4 py-3 font-medium">Transportadora</th>
                <th className="px-4 py-3 font-medium">Carga</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => {
                const origin = locationById.get(shipment.originId);
                const destination = locationById.get(shipment.destinationId);
                const carrier = carrierById.get(shipment.carrierId);
                return (
                  <tr key={shipment.id} className="border-b border-cosmic-ink/5 last:border-0 hover:bg-blue-opal/5 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/shipments/${shipment.id}`} className="font-display font-medium text-cosmic-ink hover:text-blue-opal">
                        {shipment.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">
                      {origin?.city} → {destination?.city}
                    </td>
                    <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">{carrier?.name ?? "Frota Própria"}</td>
                    <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">{shipment.loadId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={shipment.status} />
                    </td>
                  </tr>
                );
              })}
              {shipments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-cosmic-ink/45">
                    Nenhuma viagem ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
