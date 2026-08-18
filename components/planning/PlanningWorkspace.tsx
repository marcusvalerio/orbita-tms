"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, Location, Carrier, Vehicle } from "@/lib/domain/types";
import { analyzePlanning, explainPlan, type PlanOption } from "@/lib/planning/plans";
import { useSimulation } from "@/components/simulation/SimulationProvider";

export function PlanningWorkspace({
  orders,
  locationById,
  carriers,
  vehicles,
  preselectedOrderId,
}: {
  orders: Order[];
  locationById: Map<string, Location>;
  carriers: Carrier[];
  vehicles: Vehicle[];
  preselectedOrderId?: string | null;
}) {
  const { data, createLoad, createShipment } = useSimulation();
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedOrderId ? [preselectedOrderId] : []);
  const [analyzed, setAnalyzed] = useState(false);
  const [chosenPlanKey, setChosenPlanKey] = useState<PlanOption["key"] | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<PlanOption["key"] | null>(null);
  const [pendingLoadKey, setPendingLoadKey] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedOrderId && orders.some((o) => o.id === preselectedOrderId)) {
      setSelectedIds([preselectedOrderId]);
    }
  }, [preselectedOrderId, orders]);

  const toggle = (orderId: string) => {
    if (analyzed) return;
    setSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));
  const referenceOrder = selectedOrders[0];
  const compatibleOrderIds = new Set(
    referenceOrder
      ? orders
          .filter((o) => o.originId === referenceOrder.originId && o.destinationId === referenceOrder.destinationId)
          .map((o) => o.id)
      : orders.map((o) => o.id)
  );

  const analysis = useMemo(
    () => (analyzed && selectedOrders.length > 0 ? analyzePlanning(selectedOrders, carriers, vehicles) : null),
    [analyzed, selectedOrders, carriers, vehicles]
  );

  const chosenPlan = analysis?.plans.find((p) => p.key === chosenPlanKey) ?? null;

  const createdLoad = pendingLoadKey
    ? data.loads.find((l) => [...l.orderIds].sort().join(",") === pendingLoadKey)
    : undefined;

  const handleReset = () => {
    setAnalyzed(false);
    setChosenPlanKey(null);
    setExpandedReasons(null);
    setPendingLoadKey(null);
  };

  const handleConfirmPlan = () => {
    if (!chosenPlan) return;
    const key = [...chosenPlan.orderIds].sort().join(",");
    setPendingLoadKey(key);
    createLoad(chosenPlan.orderIds);
  };

  // Depois que a carga é criada, dispara a contratação da opção do plano escolhido.
  useEffect(() => {
    if (createdLoad && chosenPlan && !createdLoad.shipmentId) {
      createShipment(createdLoad.id, chosenPlan.transportOption);
    }
  }, [createdLoad, chosenPlan, createShipment]);

  useEffect(() => {
    if (createdLoad?.shipmentId) {
      router.push(`/shipments/${createdLoad.shipmentId}`);
    }
  }, [createdLoad, router]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 flex-1 min-h-0 overflow-hidden divide-x divide-cosmic-ink/10">
      {/* ESQUERDA — Pedidos aguardando planejamento */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Pedidos Aguardando Planejamento · {orders.length}
        </p>
        <div className="divide-y divide-cosmic-ink/5">
          {orders.map((order) => {
            const origin = locationById.get(order.originId);
            const destination = locationById.get(order.destinationId);
            const isSelected = selectedIds.includes(order.id);
            const isCompatible = compatibleOrderIds.has(order.id);
            return (
              <button type="button"
                key={order.id}
                onClick={() => isCompatible && toggle(order.id)}
                disabled={!isCompatible || analyzed}
                className={`w-full text-left px-5 py-3 transition-colors ${
                  isSelected
                    ? "bg-blue-opal/10"
                    : isCompatible
                    ? "hover:bg-blue-opal/5"
                    : "opacity-35 cursor-not-allowed"
                }`}
              >
                <p className="font-display font-medium text-sm text-cosmic-ink">{order.id}</p>
                <p className="text-xs text-cosmic-ink/55">
                  {origin?.city} → {destination?.city} · {order.totalWeightKg.toLocaleString("pt-BR")} kg
                </p>
              </button>
            );
          })}
          {orders.length === 0 && (
            <p className="px-5 py-4 text-sm text-cosmic-ink/45">Nenhum pedido aguardando planejamento.</p>
          )}
        </div>
      </div>

      {/* CENTRO — Pedidos selecionados e compatibilidade */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Pedidos Selecionados
        </p>
        <div className="px-5 py-4">
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-cosmic-ink/45">Selecione pedidos compatíveis à esquerda.</p>
          ) : (
            <>
              <p className="font-display font-semibold text-lg text-cosmic-ink mb-1">
                {selectedOrders.length} pedido{selectedOrders.length > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-cosmic-ink/60 mb-4">
                {locationById.get(referenceOrder!.originId)?.city} →{" "}
                {locationById.get(referenceOrder!.destinationId)?.city}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <MiniField
                  label="Peso total"
                  value={`${selectedOrders.reduce((s, o) => s + o.totalWeightKg, 0).toLocaleString("pt-BR")} kg`}
                />
                <MiniField
                  label="Volume total"
                  value={`${Math.round(selectedOrders.reduce((s, o) => s + o.totalVolumeM3, 0) * 10) / 10} m³`}
                />
              </div>

              <ul className="space-y-1 mb-5">
                {selectedOrders.map((o) => (
                  <li key={o.id} className="text-sm text-cosmic-ink/70 flex justify-between">
                    <span>{o.id}</span>
                    <span className="tabular">{o.totalWeightKg.toLocaleString("pt-BR")} kg</span>
                  </li>
                ))}
              </ul>

              {!analyzed ? (
                <button type="button"
                  onClick={() => setAnalyzed(true)}
                  className="w-full rounded-md bg-blue-opal text-white text-sm font-medium py-2.5 hover:bg-blue-opal/90 transition-colors"
                >
                  Analisar Consolidação
                </button>
              ) : (
                <>
                  {analysis?.compatible ? (
                    <div className="rounded-md border border-emerald-600/25 bg-emerald-600/5 px-4 py-3 text-sm">
                      <p className="font-medium text-emerald-700 mb-1.5">Consolidação Viável</p>
                      <ul className="space-y-1 text-emerald-700/90 text-xs">
                        <li>✓ mesma origem e destino</li>
                        <li>✓ capacidade disponível ({analysis.vehicle?.id} · {analysis.vehicle?.type})</li>
                        <li>
                          ✓ ocupação estimada:{" "}
                          {Math.round((analysis.totalWeightKg / (analysis.vehicle?.capacityKg ?? 1)) * 100)}%
                        </li>
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-md border border-cinnamon/30 bg-cinnamon/8 px-4 py-3 text-sm text-cinnamon">
                      <p className="font-medium">CAPACIDADE EXCEDIDA</p>
                      <p className="mt-1 tabular">
                        Carga: {analysis?.totalWeightKg.toLocaleString("pt-BR")} kg · Nenhum veículo disponível
                        comporta esse volume.
                      </p>
                    </div>
                  )}
                  <button type="button"
                    onClick={handleReset}
                    className="mt-3 w-full rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2 hover:bg-cosmic-ink/5 transition-colors"
                  >
                    Refazer Seleção
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* DIREITA — Planos, comparação e contratação */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Alternativas de Planejamento
        </p>
        <div className="px-5 py-4 space-y-3">
          {!analysis?.compatible && (
            <p className="text-sm text-cosmic-ink/45">
              Analise a consolidação dos pedidos selecionados para ver alternativas de planejamento.
            </p>
          )}

          {analysis?.compatible && !chosenPlan && (
            <>
              <p className="text-xs text-cosmic-ink/45">
                Valores e pesos do índice de adequação são parâmetros simulados para fins de estudo. Menor frete não
                é necessariamente o melhor plano.
              </p>
              {analysis.plans.map((plan) => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  isRecommended={plan.key === analysis.recommendedKey}
                  isExpanded={expandedReasons === plan.key}
                  reasons={explainPlan(plan, analysis.plans)}
                  onToggleReasons={() => setExpandedReasons((prev) => (prev === plan.key ? null : plan.key))}
                  onSelect={() => setChosenPlanKey(plan.key)}
                />
              ))}
            </>
          )}

          {chosenPlan && (
            <div className="rounded-md border border-blue-opal/25 bg-blue-opal/5 px-4 py-4">
              <p className="text-[11px] uppercase tracking-wider text-blue-opal/70 mb-1">
                Plano {chosenPlan.key} Selecionado
              </p>
              <p className="font-display font-semibold text-cosmic-ink mb-3">
                {chosenPlan.name} · {chosenPlan.transportOption.label}
              </p>

              <div className="space-y-1.5 text-sm">
                <BreakdownRow label="Frete peso" value={chosenPlan.transportOption.breakdown.freightWeight} />
                <BreakdownRow label="Ad Valorem" value={chosenPlan.transportOption.breakdown.adValorem} />
                <BreakdownRow label="GRIS" value={chosenPlan.transportOption.breakdown.gris} />
                <BreakdownRow label="Pedágio" value={chosenPlan.transportOption.breakdown.toll} />
                <BreakdownRow label="Taxa de entrega" value={chosenPlan.transportOption.breakdown.deliveryFee} />
                <div className="border-t border-blue-opal/20 pt-1.5 mt-1.5 flex justify-between font-display font-semibold text-cosmic-ink">
                  <span>Total</span>
                  <span className="tabular">R$ {chosenPlan.transportOption.breakdown.total.toLocaleString("pt-BR")}</span>
                </div>
              </div>

              <p className="text-[11px] text-cosmic-ink/40 mt-2">
                Valores simulados para fins de estudo · Prazo D+{chosenPlan.transportOption.etaDays} · SLA{" "}
                {chosenPlan.transportOption.slaPercent}%
              </p>

              <div className="mt-4 flex gap-2">
                <button type="button"
                  onClick={() => setChosenPlanKey(null)}
                  className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2 hover:bg-cosmic-ink/5 transition-colors"
                >
                  Trocar Plano
                </button>
                <button type="button"
                  onClick={handleConfirmPlan}
                  disabled={!!pendingLoadKey}
                  className="flex-1 rounded-md bg-blue-opal text-white text-sm font-medium py-2 hover:bg-blue-opal/90 transition-colors disabled:opacity-50"
                >
                  Confirmar Planejamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isRecommended,
  isExpanded,
  reasons,
  onToggleReasons,
  onSelect,
}: {
  plan: PlanOption;
  isRecommended: boolean;
  isExpanded: boolean;
  reasons: string[];
  onToggleReasons: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={`rounded-md border px-4 py-3 ${
        isRecommended ? "border-blue-opal/40 bg-blue-opal/5" : "border-cosmic-ink/10 bg-white/60"
      }`}
    >
      {isRecommended && (
        <p className="text-[10px] uppercase tracking-wider font-medium text-blue-opal mb-1.5">Plano Recomendado</p>
      )}
      <div className="flex items-center justify-between">
        <p className="font-display font-medium text-sm text-cosmic-ink">
          Plano {plan.key} · {plan.name}
        </p>
        <p className="font-display font-semibold tabular text-cosmic-ink">{plan.score}/100</p>
      </div>
      <p className="text-xs text-cosmic-ink/55 mt-1">{plan.strategy}</p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-cosmic-ink/60">
        <span>{plan.transportOption.label}</span>
        <span>R$ {plan.transportOption.price.toLocaleString("pt-BR")}</span>
        <span>D+{plan.transportOption.etaDays}</span>
        <span>SLA {plan.transportOption.slaPercent}%</span>
        <span>OTIF {plan.transportOption.otifPercent}%</span>
        <span>Ocupação {plan.occupancyPercent}%</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button"
          onClick={onToggleReasons}
          className="text-xs font-medium text-blue-opal hover:underline"
        >
          Por que este plano?
        </button>
        <button type="button"
          onClick={onSelect}
          className="ml-auto rounded-md bg-blue-opal text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-opal/90 transition-colors"
        >
          Selecionar Plano
        </button>
      </div>

      {isExpanded && (
        <ul className="mt-3 space-y-1 border-t border-cosmic-ink/10 pt-2">
          {reasons.map((reason, i) => (
            <li key={i} className="text-xs text-cosmic-ink/70">
              ✓ {reason}
            </li>
          ))}
        </ul>
      )}
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

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cosmic-ink/10 bg-white/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-cosmic-ink/40">{label}</p>
      <p className="text-sm font-medium tabular text-cosmic-ink">{value}</p>
    </div>
  );
}
