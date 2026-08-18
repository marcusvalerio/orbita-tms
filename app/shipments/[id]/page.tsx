"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { OccurrenceType, OccurrenceAction } from "@/lib/domain/types";

const TIMELINE_STAGES = ["Planejada", "Coleta", "Em Trânsito", "Em Entrega", "Entregue"] as const;

function stageIndexForStatus(status: string): number {
  switch (status) {
    case "Planned":
      return 0;
    case "Awaiting Pickup":
    case "Pickup Completed":
      return 1;
    case "In Transit":
    case "Exception":
      return 2;
    case "At Delivery":
      return 3;
    case "Delivered":
    case "Closed":
      return 4;
    default:
      return 0;
  }
}

const OCCURRENCE_TYPES: OccurrenceType[] = [
  "Atraso",
  "Avaria",
  "Destinatário ausente",
  "Endereço incorreto",
  "Problema mecânico",
  "Acidente",
  "Extravio",
  "Roubo",
  "Recusa",
  "Devolução",
];

const RESOLUTION_ACTIONS: OccurrenceAction[] = ["Reagendar", "Nova tentativa", "Devolver", "Contatar cliente"];

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, startShipment, createOccurrence, resolveOccurrence, completeDelivery } = useSimulation();

  const shipment = data.shipments.find((s) => s.id === params.id);
  const [showOccurrenceForm, setShowOccurrenceForm] = useState(false);

  if (!shipment) {
    return (
      <div className="h-full flex flex-col">
        <WorkspaceHeader section="Operações" title="Viagem não encontrada" />
        <div className="px-6 md:px-10 py-6">
          <Link href="/shipments" className="text-sm text-blue-opal hover:underline">
            ← Voltar para Viagens
          </Link>
        </div>
      </div>
    );
  }

  const load = data.loads.find((l) => l.id === shipment.loadId);
  const orders = load ? data.orders.filter((o) => load.orderIds.includes(o.id)) : [];
  const origin = data.locations.find((l) => l.id === shipment.originId);
  const destination = data.locations.find((l) => l.id === shipment.destinationId);
  const carrier = data.carriers.find((c) => c.id === shipment.carrierId);
  const vehicle = data.vehicles.find((v) => v.id === shipment.vehicleId);
  const driver = data.drivers.find((d) => d.id === shipment.driverId);
  const occurrences = data.occurrences.filter((o) => shipment.occurrenceIds.includes(o.id));
  const unresolvedOccurrence = occurrences.find((o) => !o.resolved);
  const deliveries = data.deliveries.filter((d) => d.shipmentId === shipment.id);

  const stageIndex = stageIndexForStatus(shipment.status);

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Operações · Viagens"
        title={shipment.id}
        meta={
          <span>
            {origin?.city} → {destination?.city}
          </span>
        }
        actions={<StatusBadge status={shipment.status} />}
      />

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-4xl space-y-8">
        {/* TIMELINE */}
        <section>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-4">
            Linha do Tempo
          </h2>
          <ol className="flex items-center gap-1">
            {TIMELINE_STAGES.map((stage, i) => {
              const isDone = i < stageIndex;
              const isCurrent = i === stageIndex;
              return (
                <li key={stage} className="flex-1 flex items-center gap-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isDone ? "bg-blue-opal" : isCurrent ? "bg-rowdy-orange" : "bg-cosmic-ink/15"
                      }`}
                    />
                    <span
                      className={`text-xs whitespace-nowrap ${
                        isCurrent ? "font-medium text-cosmic-ink" : isDone ? "text-cosmic-ink/60" : "text-cosmic-ink/35"
                      }`}
                    >
                      {stage}
                    </span>
                  </div>
                  {i < TIMELINE_STAGES.length - 1 && (
                    <div className={`h-px flex-1 -mt-4 ${isDone ? "bg-blue-opal" : "bg-cosmic-ink/15"}`} />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex gap-2">
            {shipment.status === "Planned" && (
              <button type="button"
                onClick={() => startShipment(shipment.id)}
                className="rounded-md bg-blue-opal text-white text-sm font-medium px-4 py-2 hover:bg-blue-opal/90 transition-colors"
              >
                Iniciar Viagem
              </button>
            )}
            {(shipment.status === "In Transit" || shipment.status === "At Delivery") && !unresolvedOccurrence && (
              <button type="button"
                onClick={() => completeDelivery(shipment.id)}
                className="rounded-md bg-blue-opal text-white text-sm font-medium px-4 py-2 hover:bg-blue-opal/90 transition-colors"
              >
                Concluir Entrega
              </button>
            )}
            {(shipment.status === "In Transit" || shipment.status === "At Delivery") && !unresolvedOccurrence && (
              <button type="button"
                onClick={() => setShowOccurrenceForm((v) => !v)}
                className="rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium px-4 py-2 hover:bg-cosmic-ink/5 transition-colors"
              >
                Registrar Ocorrência
              </button>
            )}
          </div>
        </section>

        {/* DETAILS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DetailField label="Veículo" value={vehicle ? `${vehicle.id} · ${vehicle.type}` : "—"} />
          <DetailField label="Motorista responsável" value={driver?.name ?? "—"} />
          <DetailField label="Transportadora" value={carrier?.name ?? "Frota Própria"} />
          <DetailField label="Carga" value={load?.id ?? "—"} />
        </section>

        {/* OCCURRENCE FORM */}
        {showOccurrenceForm && (
          <section className="rounded-lg border border-cinnamon/25 bg-cinnamon/5 px-5 py-4">
            <h2 className="font-display font-semibold text-sm text-cosmic-ink mb-3">Registrar Ocorrência</h2>
            <div className="flex flex-wrap gap-2">
              {OCCURRENCE_TYPES.map((type) => (
                <button type="button"
                  key={type}
                  onClick={() => {
                    createOccurrence(shipment.id, type);
                    setShowOccurrenceForm(false);
                  }}
                  className="rounded-full border border-cinnamon/30 text-cinnamon text-xs font-medium px-3 py-1.5 hover:bg-cinnamon/10 transition-colors"
                >
                  {type}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* EXCEPTIONS */}
        <section>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
            Ocorrências
          </h2>
          {occurrences.length === 0 ? (
            <p className="text-sm text-cosmic-ink/45">Nenhuma ocorrência registrada nesta viagem.</p>
          ) : (
            <div className="space-y-2">
              {occurrences.map((occurrence) => (
                <div key={occurrence.id} className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-medium text-sm text-cosmic-ink">{occurrence.type}</p>
                    <span className={`text-xs font-medium ${occurrence.resolved ? "text-emerald-700" : "text-cinnamon"}`}>
                      {occurrence.resolved ? `Resolvida · ${occurrence.action}` : "Em Aberto"}
                    </span>
                  </div>
                  {!occurrence.resolved && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {RESOLUTION_ACTIONS.map((action) => (
                        <button type="button"
                          key={action}
                          onClick={() => resolveOccurrence(occurrence.id, action)}
                          className="rounded-md border border-cosmic-ink/15 text-cosmic-ink text-xs font-medium px-3 py-1.5 hover:bg-cosmic-ink/5 transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ORDERS / DELIVERY */}
        <section>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
            Pedidos nesta viagem
          </h2>
          <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60">
            {orders.map((order) => {
              const delivery = deliveries.find((d) => d.orderId === order.id);
              return (
                <div key={order.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <Link href="/orders" className="font-display font-medium text-sm text-cosmic-ink hover:text-blue-opal">
                      {order.id}
                    </Link>
                    {delivery?.podDocumentId && (
                      <p className="text-xs text-cosmic-ink/45 mt-0.5">POD {delivery.podDocumentId} (simulado)</p>
                    )}
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/40 mb-1">{label}</p>
      <p className="text-sm font-medium text-cosmic-ink">{value}</p>
    </div>
  );
}
