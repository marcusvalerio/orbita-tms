"use client";

import { useMemo, useState } from "react";
import type { Order, Location, Carrier, Vehicle } from "@/lib/domain/types";
import { quoteTransportOptions, findVehicleForWeight } from "@/lib/planning/quote";

export function PlanningWorkspace({
  orders,
  locationById,
  carriers,
  vehicles,
}: {
  orders: Order[];
  locationById: Map<string, Location>;
  carriers: Carrier[];
  vehicles: Vehicle[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  // Só permite consolidar pedidos com a mesma origem/destino — coerência operacional.
  const referenceOrder = selectedOrders[0];
  const compatibleOrderIds = new Set(
    referenceOrder
      ? orders
          .filter((o) => o.originId === referenceOrder.originId && o.destinationId === referenceOrder.destinationId)
          .map((o) => o.id)
      : orders.map((o) => o.id)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-73px)] overflow-hidden divide-x divide-cosmic-ink/10">
      {/* LEFT — Orders awaiting planning */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Orders Awaiting Planning · {orders.length}
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
                onClick={() => isCompatible && toggle(order.id)}
                disabled={!isCompatible}
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

      {/* CENTER — Load composition */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Load Composition
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

              <button
                disabled={!capacityOk}
                className="mt-5 w-full rounded-md bg-blue-opal text-white text-sm font-medium py-2.5 hover:bg-blue-opal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Consolidar Carga
              </button>
            </>
          )}
        </div>
      </div>

      {/* RIGHT — Transport options */}
      <div className="overflow-y-auto">
        <p className="sticky top-0 bg-milk-mustache px-5 py-3 text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
          Transport Options
        </p>
        <div className="px-5 py-4 space-y-2">
          {!capacityOk && selectedOrders.length > 0 && (
            <p className="text-sm text-cosmic-ink/45">
              Resolva a capacidade da carga antes de contratar transporte.
            </p>
          )}
          {capacityOk && options.length === 0 && (
            <p className="text-sm text-cosmic-ink/45">Componha uma carga para ver opções de transporte.</p>
          )}
          {options.map((option) => (
            <div
              key={option.id}
              className="rounded-md border border-cosmic-ink/10 bg-white/60 px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="font-display font-medium text-sm text-cosmic-ink">{option.label}</p>
                <p className="text-xs text-cosmic-ink/55">
                  D+{option.etaDays} · SLA {option.slaPercent}%
                </p>
              </div>
              <p className="font-display font-semibold tabular text-cosmic-ink">
                R$ {option.price.toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      </div>
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
