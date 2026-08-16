"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, Location, Carrier, Vehicle } from "@/lib/domain/types";
import { quoteTransportOptions, findVehicleForWeight, type TransportOptionQuote } from "@/lib/planning/quote";
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
  const [pendingLoadKey, setPendingLoadKey] = useState<string | null>(null);
  const [chosenOption, setChosenOption] = useState<TransportOptionQuote | null>(null);

  useEffect(() => {
    if (preselectedOrderId && orders.some((o) => o.id === preselectedOrderId)) {
      setSelectedIds([preselectedOrderId]);
    }
  }, [preselectedOrderId, orders]);

  const toggle = (orderId: string) => {
    setSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));
  const totalWeightKg = selectedOrders.reduce((sum, o) => sum + o.totalWeightKg, 0);
  const totalVolumeM3 = Math.round(selectedOrders.reduce((sum, o) => sum + o.totalVolumeM3, 0) * 10) / 10;

  const matchedVehicle = useMemo(() => findVehicleForWeight(vehicles, totalWeightKg), [vehicles, totalWeightKg]);
  const capacityOk = totalWeightKg === 0 || !!matchedVehicle;
  const occupancyPercent = matchedVehicle ? Math.round((totalWeightKg / matchedVehicle.capacityKg) * 100) : 0;

  const options = useMemo(
    () => (capacityOk ? quoteTransportOptions(totalWeightKg, carriers) : []),
    [capacityOk, totalWeightKg, carriers]
  );

  const referenceOrder = selectedOrders[0];
  const compatibleOrderIds = new Set(
    referenceOrder
      ? orders
          .filter((o) => o.originId === referenceOrder.originId && o.destinationId === referenceOrder.destinationId)
          .map((o) => o.id)
      : orders.map((o) => o.id)
  );

  // Encontra a carga recém-criada procurando por um load cujo conjunto de pedidos
  // corresponda exatamente à seleção pendente (o reducer gera o id internamente).
  const createdLoad = pendingLoadKey
    ? data.loads.find((l) => [...l.orderIds].sort().join(",") === pendingLoadKey)
    : undefined;

  const handleConsolidate = () => {
    if (!capacityOk || selectedOrders.length === 0) return;
    const key = [...selectedIds].sort().join(",");
    setPendingLoadKey(key);
    createLoad(selectedIds);
  };

  const handleConfirmContracting = () => {
    if (!createdLoad || !chosenOption) return;
    createShipment(createdLoad.id, chosenOption);
    setTimeout(() => {
      const shipment = data.shipments.find((s) => s.loadId === createdLoad.id);
      if (shipment) router.push(`/shipments/${shipment.id}`);
    }, 0);
  };

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
              <button
                key={order.id}
                onClick={() => isCompatible && !createdLoad && toggle(order.id)}
                disabled={!isCompatible || !!createdLoad}
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

      {/* CENTRO — Composição da carga */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Composição da Carga
        </p>
        <div className="px-5 py-4">
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-cosmic-ink/45">Selecione pedidos compatíveis à esquerda.</p>
          ) : (
            <>
              {createdLoad && (
                <p className="mb-3 inline-block rounded-full bg-blue-opal/10 text-blue-opal text-xs font-medium px-2.5 py-1">
                  {createdLoad.id} criada
                </p>
              )}
              <p className="font-display font-semibold text-lg text-cosmic-ink mb-1">
                {selectedOrders.length} pedido{selectedOrders.length > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-cosmic-ink/60 mb-4">
                {locationById.get(referenceOrder!.originId)?.city} →{" "}
                {locationById.get(referenceOrder!.destinationId)?.city}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <MiniField label="Peso" value={`${totalWeightKg.toLocaleString("pt-BR")} kg`} />
                <MiniField label="Volume" value={`${totalVolumeM3} m³`} />
              </div>

              {capacityOk ? (
                matchedVehicle && (
                  <div className="rounded-md border border-cosmic-ink/10 bg-white/60 px-4 py-3 text-sm">
                    <p className="text-cosmic-ink/70">
                      Veículo compatível: <span className="font-medium text-cosmic-ink">{matchedVehicle.id}</span>{" "}
                      ({matchedVehicle.type})
                    </p>
                    <p className="text-cosmic-ink/55 mt-1">
                      Ocupação: <span className="tabular">{occupancyPercent}%</span> de{" "}
                      {matchedVehicle.capacityKg.toLocaleString("pt-BR")} kg
                    </p>
                  </div>
                )
              ) : (
                <div className="rounded-md border border-cinnamon/30 bg-cinnamon/8 px-4 py-3 text-sm text-cinnamon">
                  <p className="font-medium">CAPACIDADE INSUFICIENTE</p>
                  <p className="mt-1 tabular">
                    Carga: {totalWeightKg.toLocaleString("pt-BR")} kg · Nenhum veículo disponível comporta esse
                    volume
                  </p>
                </div>
              )}

              <ul className="mt-4 space-y-1">
                {selectedOrders.map((o) => (
                  <li key={o.id} className="text-sm text-cosmic-ink/70 flex justify-between">
                    <span>{o.id}</span>
                    <span className="tabular">{o.totalWeightKg.toLocaleString("pt-BR")} kg</span>
                  </li>
                ))}
              </ul>

              {!createdLoad && (
                <button
                  onClick={handleConsolidate}
                  disabled={!capacityOk}
                  className="mt-5 w-full rounded-md bg-blue-opal text-white text-sm font-medium py-2.5 hover:bg-blue-opal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Consolidar Carga
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* DIREITA — Cotação, comparação e contratação */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Opções de Transporte
        </p>
        <div className="px-5 py-4 space-y-3">
          {!createdLoad && (
            <p className="text-sm text-cosmic-ink/45">Consolide a carga para ver opções de transporte.</p>
          )}

          {createdLoad && !chosenOption && (
            <>
              <p className="text-xs text-cosmic-ink/45">
                Valor de frete simulado — não representa tabela real de nenhuma transportadora. Menor frete não é
                necessariamente a melhor opção: compare SLA e nível de serviço (OTIF).
              </p>
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setChosenOption(option)}
                  className="w-full text-left rounded-md border border-cosmic-ink/10 bg-white/60 px-4 py-3 hover:border-blue-opal/40 hover:bg-blue-opal/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-display font-medium text-sm text-cosmic-ink">{option.label}</p>
                    <p className="font-display font-semibold tabular text-cosmic-ink">
                      R$ {option.price.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-cosmic-ink/55">
                    <span>Prazo D+{option.etaDays}</span>
                    <span>SLA {option.slaPercent}%</span>
                    <span>Nível de Serviço (OTIF) {option.otifPercent}%</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {chosenOption && (
            <div className="rounded-md border border-blue-opal/25 bg-blue-opal/5 px-4 py-4">
              <p className="text-[11px] uppercase tracking-wider text-blue-opal/70 mb-1">Transporte Selecionado</p>
              <p className="font-display font-semibold text-cosmic-ink mb-3">{chosenOption.label}</p>

              <div className="space-y-1.5 text-sm">
                <BreakdownRow label="Frete peso" value={chosenOption.breakdown.freightWeight} />
                <BreakdownRow label="Ad Valorem" value={chosenOption.breakdown.adValorem} />
                <BreakdownRow label="GRIS" value={chosenOption.breakdown.gris} />
                <BreakdownRow label="Pedágio" value={chosenOption.breakdown.toll} />
                <BreakdownRow label="Taxa de entrega" value={chosenOption.breakdown.deliveryFee} />
                <div className="border-t border-blue-opal/20 pt-1.5 mt-1.5 flex justify-between font-display font-semibold text-cosmic-ink">
                  <span>Total</span>
                  <span className="tabular">R$ {chosenOption.breakdown.total.toLocaleString("pt-BR")}</span>
                </div>
              </div>

              <p className="text-[11px] text-cosmic-ink/40 mt-2">
                Frete simulado para fins didáticos · Prazo D+{chosenOption.etaDays} · SLA {chosenOption.slaPercent}%
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setChosenOption(null)}
                  className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2 hover:bg-cosmic-ink/5 transition-colors"
                >
                  Trocar
                </button>
                <button
                  onClick={handleConfirmContracting}
                  className="flex-1 rounded-md bg-blue-opal text-white text-sm font-medium py-2 hover:bg-blue-opal/90 transition-colors"
                >
                  Confirmar Contratação
                </button>
              </div>
            </div>
          )}
        </div>
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

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cosmic-ink/10 bg-white/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-cosmic-ink/40">{label}</p>
      <p className="text-sm font-medium tabular text-cosmic-ink">{value}</p>
    </div>
  );
}
