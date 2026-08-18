"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { quoteTransportOptions, type TransportOptionQuote } from "@/lib/planning/quote";

function ContratacaoPageInner() {
  const { data, createShipment } = useSimulation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselected = searchParams.get("load");

  const pendingLoads = data.loads.filter((l) => l.status === "Aguardando transporte");
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(
    preselected && pendingLoads.some((l) => l.id === preselected)
      ? preselected
      : pendingLoads.length === 1
      ? pendingLoads[0].id
      : null
  );
  const [viewingOption, setViewingOption] = useState<TransportOptionQuote | null>(null);

  const selectedLoad = pendingLoads.find((l) => l.id === selectedLoadId) ?? null;
  const locationById = new Map(data.locations.map((l) => [l.id, l]));

  const handleConfirm = (option: TransportOptionQuote) => {
    if (!selectedLoad) return;
    createShipment(selectedLoad.id, option);
    setTimeout(() => {
      const shipment = data.shipments.find((s) => s.loadId === selectedLoad.id);
      if (shipment) router.push(`/shipments/${shipment.id}`);
    }, 0);
  };

  if (pendingLoads.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <WorkspaceHeader section="Planejamento" title="Contratação de Transporte" />
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-cosmic-ink/45">Nenhuma carga aguardando contratação no momento.</p>
        </div>
      </div>
    );
  }

  // Lista de cargas pendentes — só aparece quando há mais de uma e nenhuma foi escolhida ainda.
  if (!selectedLoad) {
    return (
      <div className="h-full flex flex-col">
        <WorkspaceHeader
          section="Planejamento"
          title="Contratação de Transporte"
          meta={<span className="tabular">{pendingLoads.length} cargas aguardando contratação</span>}
        />
        <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-2xl">
          <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60">
            {pendingLoads.map((load) => {
              const origin = locationById.get(load.originId);
              const destination = locationById.get(load.destinationId);
              return (
                <button
                  type="button"
                  key={load.id}
                  onClick={() => setSelectedLoadId(load.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-opal/5 transition-colors"
                >
                  <div>
                    <p className="font-display font-medium text-sm text-cosmic-ink">{load.id}</p>
                    <p className="text-xs text-cosmic-ink/55">
                      {origin?.city} → {destination?.city} · {load.orderIds.length} pedido
                      {load.orderIds.length > 1 ? "s" : ""} · {load.totalWeightKg.toLocaleString("pt-BR")} kg
                    </p>
                  </div>
                  <span className="text-xs font-medium text-blue-opal shrink-0">Contratar →</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Carga escolhida — ocupa o workspace principal sozinha (sem empilhar com a lista).
  const origin = locationById.get(selectedLoad.originId);
  const destination = locationById.get(selectedLoad.destinationId);
  const options = quoteTransportOptions(selectedLoad.totalWeightKg, data.carriers);

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Planejamento"
        title="Contratação de Transporte"
        actions={
          pendingLoads.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setSelectedLoadId(null);
                setViewingOption(null);
              }}
              className="text-xs font-medium text-blue-opal hover:underline"
            >
              Ver outras cargas
            </button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-2xl">
        <div className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-4 py-3 mb-6">
          <p className="font-display font-semibold text-cosmic-ink">{selectedLoad.id}</p>
          <p className="text-sm text-cosmic-ink/60 mt-0.5">
            {selectedLoad.orderIds.length} pedido{selectedLoad.orderIds.length > 1 ? "s" : ""} ·{" "}
            {selectedLoad.totalWeightKg.toLocaleString("pt-BR")} kg · {selectedLoad.totalVolumeM3} m³
          </p>
          <p className="text-sm text-cosmic-ink/60">
            {origin?.city} → {destination?.city}
          </p>
        </div>

        {!viewingOption ? (
          <>
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
              Transportadoras Disponíveis
            </h2>
            <div className="space-y-2">
              {options.map((option) => (
                <div key={option.id} className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-medium text-cosmic-ink">{option.label}</p>
                    <p className="font-display font-semibold tabular text-cosmic-ink">
                      R$ {option.price.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-cosmic-ink/55">
                    <span>Prazo D+{option.etaDays}</span>
                    <span>SLA {option.slaPercent}%</span>
                    <span>OTIF {option.otifPercent}%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingOption(option)}
                    className="mt-3 text-xs font-medium text-blue-opal hover:underline"
                  >
                    Ver Opção
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-blue-opal/25 bg-blue-opal/5 px-5 py-4">
            <p className="text-[11px] uppercase tracking-wider text-blue-opal/70 mb-1">{viewingOption.label}</p>
            <p className="font-display font-semibold text-cosmic-ink mb-3">Composição do Frete</p>

            <div className="space-y-1.5 text-sm">
              <BreakdownRow label="Frete peso" value={viewingOption.breakdown.freightWeight} />
              <BreakdownRow label="Ad Valorem" value={viewingOption.breakdown.adValorem} />
              <BreakdownRow label="GRIS" value={viewingOption.breakdown.gris} />
              <BreakdownRow label="Pedágio" value={viewingOption.breakdown.toll} />
              <BreakdownRow label="Taxa de entrega" value={viewingOption.breakdown.deliveryFee} />
              <div className="border-t border-blue-opal/20 pt-1.5 mt-1.5 flex justify-between font-display font-semibold text-cosmic-ink">
                <span>Total</span>
                <span className="tabular">R$ {viewingOption.breakdown.total.toLocaleString("pt-BR")}</span>
              </div>
            </div>

            <p className="text-[11px] text-cosmic-ink/40 mt-2">
              Valores simulados para fins de estudo · Prazo D+{viewingOption.etaDays} · SLA {viewingOption.slaPercent}% ·
              OTIF {viewingOption.otifPercent}%
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setViewingOption(null)}
                className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2 hover:bg-cosmic-ink/5 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleConfirm(viewingOption)}
                className="flex-1 rounded-md bg-blue-opal text-white text-sm font-medium py-2 hover:bg-blue-opal/90 transition-colors"
              >
                Confirmar Transportadora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-cosmic-ink/70">
      <span>{label}</span>
      <span className="tabular">R$ {value.toLocaleString("pt-BR")}</span>
    </div>
  );
}

export default function ContratacaoPage() {
  return (
    <Suspense fallback={null}>
      <ContratacaoPageInner />
    </Suspense>
  );
}
