"use client";

import { useMemo } from "react";
import { Building, Check, Truck } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { Field, Input, Select } from "@/components/ds";
import { quoteTransportOptions, findVehicleForWeight, type TransportOptionQuote } from "@/lib/planning/quote";
import { cn } from "@/lib/ui/cn";

// Contratação: o operador entende custo (com composição), transportadora,
// veículo, motorista e condições antes de confirmar. Valores de frete são
// simulados (sinalizado). A escolha final é do gestor; o domínio valida.

export interface TenderChoice {
  optionId: string | null;
  vehicleId?: string;
  driverId?: string;
  routeCode?: string;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function useTenderOptions(weightKg: number) {
  const { data } = useOperation();
  return useMemo(() => quoteTransportOptions(weightKg, data.carriers), [weightKg, data.carriers]);
}

export function TenderPanel({
  weightKg,
  value,
  onChange,
  recommendedId,
  options: optionsProp,
}: {
  weightKg: number;
  value: TenderChoice;
  onChange: (next: TenderChoice) => void;
  recommendedId?: string;
  options?: TransportOptionQuote[];
}) {
  const { data } = useOperation();
  const computed = useTenderOptions(weightKg);
  const options = optionsProp ?? computed;
  const selected = options.find((o) => o.id === value.optionId) ?? null;
  const cheapest = options[0]?.id;
  const vehicles = data.vehicles.filter((v) => v.status === "Disponível" && v.ownership === "Frota Própria" && v.capacityKg >= weightKg).sort((a, b) => a.capacityKg - b.capacityKg);
  const suggestedVehicle = findVehicleForWeight(data.vehicles, weightKg);
  const drivers = data.drivers.filter((d) => d.status === "Disponível");
  const vehicleId = value.vehicleId ?? suggestedVehicle?.id ?? "";
  const driverId = value.driverId ?? drivers[0]?.id ?? "";
  const vehicle = data.vehicles.find((v) => v.id === vehicleId);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Opções de transporte" className="space-y-1.5">
        {options.map((o) => {
          const carrier = data.carriers.find((c) => c.id === o.id);
          const on = o.id === value.optionId;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...value, optionId: o.id })}
              className={cn(
                "orb-focus-inset relative grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-md border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-(--orb-duration-fast)",
                on ? "border-fg bg-surface shadow-1" : "border-line-subtle bg-surface hover:border-line-strong"
              )}
            >
              <span aria-hidden className={cn("mt-0.5 grid size-4 place-items-center rounded-full border-2", on ? "border-fg bg-fg" : "border-line-strong")}>
                {on && <span className="size-1.5 rounded-full bg-fg-inverse" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  {o.isOwnFleet ? <Truck className="size-4 text-fg-muted" aria-hidden /> : <Building className="size-4 text-fg-muted" aria-hidden />}
                  <span className="text-body font-medium text-fg">{o.label}</span>
                  {o.id === recommendedId && <span className="rounded-xs bg-brand-subtle px-1.5 text-caption font-medium text-brand-fg">Recomendada</span>}
                  {o.id === cheapest && o.id !== recommendedId && <span className="rounded-xs bg-surface-sunken px-1.5 text-caption text-fg-muted">Menor custo</span>}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-fg-muted">
                  <span>Prazo D+{o.etaDays}</span>
                  <span>SLA {o.slaPercent}%</span>
                  <span>OTIF {o.otifPercent}%</span>
                  {carrier && <span>Ocorrências {(carrier.occurrenceRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>}
                </span>
              </span>
              <span className="orb-data text-body font-semibold text-fg">{brl(o.price)}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="grid gap-4 animate-orb-rise-in sm:grid-cols-2">
          <div className="rounded-md border border-line-subtle bg-surface p-3">
            <p className="mb-2 text-h3 text-fg">Composição do frete</p>
            <dl className="space-y-1 text-body-sm">
              {[
                ["Frete peso", selected.breakdown.freightWeight],
                ["Ad Valorem", selected.breakdown.adValorem],
                ["GRIS", selected.breakdown.gris],
                ["Pedágio", selected.breakdown.toll],
                ["Taxa de entrega", selected.breakdown.deliveryFee],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3">
                  <dt className="text-fg-muted">{k}</dt>
                  <dd className="orb-data text-fg">{brl(v as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-line-subtle pt-1.5 font-semibold">
                <dt className="text-fg">Total</dt>
                <dd className="orb-data text-fg">{brl(selected.breakdown.total)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-caption text-fg-subtle">Frete simulado para estudo · {(selected.price / Math.max(1, weightKg)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/kg</p>
          </div>

          <div className="rounded-md border border-line-subtle bg-surface p-3">
            <p className="mb-2 text-h3 text-fg">{selected.isOwnFleet ? "Veículo e motorista" : "Condições"}</p>
            {selected.isOwnFleet ? (
              <div className="space-y-3">
                <Field label="Veículo" hint={vehicle ? `Ocupação ${Math.round((weightKg / vehicle.capacityKg) * 100)}% de ${vehicle.capacityKg.toLocaleString("pt-BR")} kg` : undefined} error={vehicles.length === 0 ? "Nenhum veículo disponível comporta a carga." : undefined}>
                  <Select value={vehicleId} onChange={(e) => onChange({ ...value, vehicleId: e.target.value })} disabled={vehicles.length === 0}>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id} · {v.plate} · {v.type} · {v.capacityKg.toLocaleString("pt-BR")} kg{v.id === suggestedVehicle?.id ? " (sugerido)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Motorista" error={drivers.length === 0 ? "Nenhum motorista disponível." : undefined}>
                  <Select value={driverId} onChange={(e) => onChange({ ...value, driverId: e.target.value })} disabled={drivers.length === 0}>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · CNH {d.cnhCategory}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Código da rota" hint="Opcional — gerado automaticamente">
                  <Input value={value.routeCode ?? ""} onChange={(e) => onChange({ ...value, routeCode: e.target.value })} placeholder="Ex.: RJ-ZONA-OESTE-043" className="orb-data" />
                </Field>
              </div>
            ) : (
              <ul className="space-y-1.5 text-body-sm text-fg">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" aria-hidden /> Veículo e motorista fornecidos pela transportadora
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" aria-hidden /> Prazo D+{selected.etaDays} · SLA {selected.slaPercent}% · OTIF {selected.otifPercent}%
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" aria-hidden /> Regiões: {data.carriers.find((c) => c.id === selected.id)?.regions.join(", ") ?? "—"}
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Extras do CREATE_SHIPMENT a partir da escolha (frota própria leva veículo/motorista). */
export function tenderExtras(choice: TenderChoice, option: TransportOptionQuote | undefined) {
  // Sem escolha explícita, o domínio sugere o menor veículo que comporta e o primeiro motorista disponível.
  if (!option?.isOwnFleet) return { routeCode: choice.routeCode || undefined };
  return { vehicleId: choice.vehicleId, driverId: choice.driverId, routeCode: choice.routeCode || undefined };
}
