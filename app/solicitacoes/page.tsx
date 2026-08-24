"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

const selectClass =
  "w-full rounded-md border border-cosmic-ink/15 bg-white px-3 py-2 text-sm text-cosmic-ink focus:outline-none focus:ring-1 focus:ring-blue-opal";

const STATUS_STYLES: Record<string, string> = {
  Solicitada: "bg-rowdy-orange/15 text-rowdy-orange",
  "Em análise": "bg-blue-opal/10 text-blue-opal",
  "Convertida em Pedido": "bg-emerald-600/10 text-emerald-700",
  Recusada: "bg-cinnamon/15 text-cinnamon",
};

export default function SolicitacoesRecebidasPage() {
  const { data, convertSolicitationToOrder } = useSimulation();
  const router = useRouter();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? "");
  const [priority, setPriority] = useState<"Normal" | "Alta" | "Urgente">("Normal");

  const locationById = new Map(data.locations.map((l) => [l.id, l]));
  const partnerById = new Map(data.partnerCompanies.map((p) => [p.id, p]));

  const pending = data.solicitations.filter((s) => s.status !== "Convertida em Pedido");
  const converted = data.solicitations.filter((s) => s.status === "Convertida em Pedido");

  const handleConvert = (solicitationId: string) => {
    if (!customerId) return;
    convertSolicitationToOrder(solicitationId, customerId, priority);
    setAnalyzingId(null);
    router.push("/orders");
  };

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Central Operacional"
        title="Solicitações Recebidas"
        meta={<span className="tabular">{pending.length} aguardando análise</span>}
      />
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-3xl space-y-8">
        <section>
          {pending.length === 0 ? (
            <p className="text-sm text-cosmic-ink/45">Nenhuma solicitação aguardando análise.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((s) => {
                const partner = partnerById.get(s.partnerCompanyId);
                const origin = locationById.get(s.originId);
                const destination = locationById.get(s.destinationId);
                return (
                  <div key={s.id} className="rounded-lg border border-cosmic-ink/10 bg-white/60 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display font-semibold text-cosmic-ink">{s.id}</p>
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                    </div>
                    <p className="text-sm text-cosmic-ink/70 mt-1">{partner?.tradeName || partner?.legalName}</p>
                    <p className="text-xs text-cosmic-ink/55 mt-0.5">
                      {origin?.city} → {destination?.city} · {new Date(s.pickupDate).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-xs text-cosmic-ink/55">
                      {s.productDescription} · {s.totalWeightKg.toLocaleString("pt-BR")} kg
                      {s.totalVolumeM3 ? ` · ${s.totalVolumeM3} m³` : ""}
                    </p>

                    {analyzingId === s.id ? (
                      <div className="mt-3 rounded-md border border-blue-opal/20 bg-blue-opal/5 p-3 space-y-2">
                        <label className="block">
                          <span className="block text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-1">
                            Cliente (destinatário) para o pedido
                          </span>
                          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectClass}>
                            {data.customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="block text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-1">Prioridade</span>
                          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className={selectClass}>
                            <option value="Normal">Normal</option>
                            <option value="Alta">Alta</option>
                            <option value="Urgente">Urgente</option>
                          </select>
                        </label>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setAnalyzingId(null)}
                            className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConvert(s.id)}
                            disabled={!customerId}
                            className="flex-1 rounded-md bg-blue-opal text-white text-sm font-medium py-2 hover:bg-blue-opal/90 transition-colors disabled:opacity-40"
                          >
                            Converter em Pedido
                          </button>
                        </div>
                        {data.customers.length === 0 && (
                          <p className="text-xs text-cinnamon">
                            Cadastre ao menos um cliente antes de converter — ainda não há nenhum cadastrado.
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAnalyzingId(s.id)}
                        className="mt-3 text-xs font-medium text-blue-opal hover:underline"
                      >
                        Analisar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {converted.length > 0 && (
          <section>
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
              Convertidas
            </h2>
            <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60">
              {converted.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                  <p className="text-sm text-cosmic-ink/80">
                    {s.id} → {s.orderId}
                  </p>
                  <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-emerald-600/10 text-emerald-700">
                    Convertida
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
