"use client";

import { useMemo, useState } from "react";
import { useSimulation } from "./SimulationProvider";
import type { CargoCharacteristic } from "@/lib/domain/types";
import type { NewOrderItemInput } from "@/lib/sim/reducer";

const CARGO_CHARACTERISTICS: CargoCharacteristic[] = [
  "Refrigerada",
  "Congelada",
  "Temperatura ambiente",
  "Frágil",
  "Alto valor",
  "Perigosa",
  "Perecível",
  "Sensível à umidade",
  "Manuseio especial",
];

function emptyItem(): NewOrderItemInput {
  return { productId: undefined, description: "", quantity: 1, unitWeightKg: 1, volumeM3: undefined };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNowIso(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export function NewOrderModal({ onClose }: { onClose: () => void }) {
  const { data, createOrder } = useSimulation();
  const cds = data.locations.filter((l) => l.kind === "CD");
  const clientLocations = data.locations.filter((l) => l.kind === "Cliente");

  // Bloco 1 — Identificação
  const [operationType, setOperationType] = useState<"B2B" | "B2C" | "Outro">("B2C");
  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? "");
  const [requestedBy, setRequestedBy] = useState("");
  const [priority, setPriority] = useState<"Normal" | "Alta" | "Urgente">("Normal");
  const [generalNotes, setGeneralNotes] = useState("");

  // Bloco 2 — Coleta
  const [originId, setOriginId] = useState(cds[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState(todayIso());
  const [pickupWindowStart, setPickupWindowStart] = useState("08:00");
  const [pickupWindowEnd, setPickupWindowEnd] = useState("12:00");

  // Bloco 3 — Entrega
  const [destinationId, setDestinationId] = useState(clientLocations[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(daysFromNowIso(2));
  const [deliveryWindowStart, setDeliveryWindowStart] = useState("");
  const [deliveryWindowEnd, setDeliveryWindowEnd] = useState("");
  const [destinationContactName, setDestinationContactName] = useState("");
  const [destinationContactPhone, setDestinationContactPhone] = useState("");

  // Bloco 4 — Carga
  const [items, setItems] = useState<NewOrderItemInput[]>([emptyItem()]);
  const [characteristics, setCharacteristics] = useState<CargoCharacteristic[]>([]);
  const [temperatureMin, setTemperatureMin] = useState<number | undefined>(undefined);
  const [temperatureMax, setTemperatureMax] = useState<number | undefined>(undefined);
  const [temperatureNotes, setTemperatureNotes] = useState("");

  const [error, setError] = useState<string | null>(null);

  const needsTemperature = characteristics.includes("Refrigerada") || characteristics.includes("Congelada");

  const totals = useMemo(() => {
    const weight = items.reduce((sum, it) => sum + it.quantity * it.unitWeightKg, 0);
    const volume = items.reduce((sum, it) => sum + (it.volumeM3 ?? (it.quantity * it.unitWeightKg) / 140), 0);
    return { weight: Math.round(weight * 100) / 100, volume: Math.round(volume * 100) / 100 };
  }, [items]);

  const updateItem = (index: number, patch: Partial<NewOrderItemInput>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const toggleCharacteristic = (c: CargoCharacteristic) => {
    setCharacteristics((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.some((it) => it.quantity <= 0 || it.unitWeightKg <= 0)) {
      setError("Cada item precisa de quantidade e peso unitário maiores que zero.");
      return;
    }
    if (new Date(dueDate) < new Date(pickupDate)) {
      setError("A data de entrega não pode ser anterior à data de coleta.");
      return;
    }
    if (pickupWindowStart && pickupWindowEnd && pickupWindowEnd < pickupWindowStart) {
      setError("A janela de coleta tem horário final antes do inicial.");
      return;
    }
    if (deliveryWindowStart && deliveryWindowEnd && deliveryWindowEnd < deliveryWindowStart) {
      setError("A janela de entrega tem horário final antes do inicial.");
      return;
    }

    createOrder({
      customerId,
      originId,
      destinationId,
      operationType,
      requestedBy: requestedBy || undefined,
      priority,
      generalNotes: generalNotes || undefined,
      pickupDate: new Date(pickupDate).toISOString(),
      pickupWindowStart: pickupWindowStart || undefined,
      pickupWindowEnd: pickupWindowEnd || undefined,
      dueDate: new Date(dueDate).toISOString(),
      deliveryWindowStart: deliveryWindowStart || undefined,
      deliveryWindowEnd: deliveryWindowEnd || undefined,
      destinationContactName: destinationContactName || undefined,
      destinationContactPhone: destinationContactPhone || undefined,
      items,
      cargoCharacteristics: characteristics,
      temperatureMin: needsTemperature ? temperatureMin : undefined,
      temperatureMax: needsTemperature ? temperatureMax : undefined,
      temperatureNotes: needsTemperature ? temperatureNotes || undefined : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-cosmic-ink/40 px-4 py-8" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-full overflow-y-auto rounded-lg bg-white shadow-xl px-6 py-5"
      >
        <h2 className="font-display font-semibold text-lg text-cosmic-ink mb-1">Nova Solicitação de Transporte</h2>
        <p className="text-sm text-cosmic-ink/55 mb-5">Ordem de serviço — coleta, carga e entrega.</p>

        {/* BLOCO 1 — IDENTIFICAÇÃO */}
        <FormSection title="01 · Identificação da Operação">
          <div className="grid grid-cols-3 gap-3">
            {(["B2B", "B2C", "Outro"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOperationType(t)}
                className={`rounded-md border text-sm font-medium py-2 transition-colors ${
                  operationType === t
                    ? "border-blue-opal bg-blue-opal/10 text-blue-opal"
                    : "border-cosmic-ink/15 text-cosmic-ink/60 hover:bg-cosmic-ink/5"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Field label="Empresa solicitante / Cliente">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectClass}>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsável pela solicitação">
              <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className={selectClass} placeholder="Opcional" />
            </Field>
            <Field label="Prioridade">
              <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className={selectClass}>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </Field>
          </div>
          <Field label="Observações gerais">
            <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} className={`${selectClass} min-h-16`} placeholder="Opcional" />
          </Field>
        </FormSection>

        {/* BLOCO 2 — COLETA */}
        <FormSection title="02 · Coleta">
          <Field label="Local de coleta (CD)">
            <select value={originId} onChange={(e) => setOriginId(e.target.value)} className={selectClass}>
              {cds.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.city}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Data prevista">
              <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={selectClass} />
            </Field>
            <Field label="Janela — início">
              <input type="time" value={pickupWindowStart} onChange={(e) => setPickupWindowStart(e.target.value)} className={selectClass} />
            </Field>
            <Field label="Janela — fim">
              <input type="time" value={pickupWindowEnd} onChange={(e) => setPickupWindowEnd(e.target.value)} className={selectClass} />
            </Field>
          </div>
        </FormSection>

        {/* BLOCO 3 — ENTREGA */}
        <FormSection title="03 · Entrega">
          <Field label="Destino">
            <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={selectClass}>
              {clientLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.city}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Data prevista">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={selectClass} />
            </Field>
            <Field label="Janela — início">
              <input type="time" value={deliveryWindowStart} onChange={(e) => setDeliveryWindowStart(e.target.value)} className={selectClass} />
            </Field>
            <Field label="Janela — fim">
              <input type="time" value={deliveryWindowEnd} onChange={(e) => setDeliveryWindowEnd(e.target.value)} className={selectClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pessoa de contato">
              <input value={destinationContactName} onChange={(e) => setDestinationContactName(e.target.value)} className={selectClass} placeholder="Opcional" />
            </Field>
            <Field label="Telefone">
              <input value={destinationContactPhone} onChange={(e) => setDestinationContactPhone(e.target.value)} className={selectClass} placeholder="Opcional" />
            </Field>
          </div>
        </FormSection>

        {/* BLOCO 4 — CARGA */}
        <FormSection title="04 · Carga">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-md border border-cosmic-ink/10 p-2.5">
                <div className="col-span-4">
                  <MiniLabel>Produto</MiniLabel>
                  <select
                    value={item.productId ?? ""}
                    onChange={(e) => updateItem(i, { productId: e.target.value || undefined })}
                    className={selectClass}
                  >
                    <option value="">Item avulso (descrever)</option>
                    {data.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!item.productId && (
                  <div className="col-span-3">
                    <MiniLabel>Descrição</MiniLabel>
                    <input
                      value={item.description ?? ""}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      className={selectClass}
                    />
                  </div>
                )}
                <div className={item.productId ? "col-span-2" : "col-span-1"}>
                  <MiniLabel>Qtd.</MiniLabel>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    className={selectClass}
                  />
                </div>
                <div className="col-span-2">
                  <MiniLabel>Peso unit. (kg)</MiniLabel>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={item.unitWeightKg}
                    onChange={(e) => updateItem(i, { unitWeightKg: Number(e.target.value) })}
                    className={selectClass}
                  />
                </div>
                <div className="col-span-2">
                  <MiniLabel>Volume (m³)</MiniLabel>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={item.volumeM3 ?? ""}
                    onChange={(e) => updateItem(i, { volumeM3: e.target.value ? Number(e.target.value) : undefined })}
                    className={selectClass}
                    placeholder="Estimado"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-cosmic-ink/40 hover:text-cinnamon text-sm px-1"
                      aria-label="Remover item"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="text-xs font-medium text-blue-opal hover:underline"
          >
            + Adicionar item
          </button>

          <div className="grid grid-cols-2 gap-3">
            <MiniField label="Peso total" value={`${totals.weight.toLocaleString("pt-BR")} kg`} />
            <MiniField label="Volume total" value={`${totals.volume.toLocaleString("pt-BR")} m³`} />
          </div>

          <div>
            <MiniLabel>Características da carga</MiniLabel>
            <div className="flex flex-wrap gap-2 mt-1">
              {CARGO_CHARACTERISTICS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCharacteristic(c)}
                  className={`rounded-full border text-xs font-medium px-3 py-1.5 transition-colors ${
                    characteristics.includes(c)
                      ? "border-blue-opal bg-blue-opal/10 text-blue-opal"
                      : "border-cosmic-ink/15 text-cosmic-ink/60 hover:bg-cosmic-ink/5"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {needsTemperature && (
            <div className="rounded-md border border-blue-opal/25 bg-blue-opal/5 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Temperatura mínima (°C)">
                  <input
                    type="number"
                    value={temperatureMin ?? ""}
                    onChange={(e) => setTemperatureMin(e.target.value ? Number(e.target.value) : undefined)}
                    className={selectClass}
                  />
                </Field>
                <Field label="Temperatura máxima (°C)">
                  <input
                    type="number"
                    value={temperatureMax ?? ""}
                    onChange={(e) => setTemperatureMax(e.target.value ? Number(e.target.value) : undefined)}
                    className={selectClass}
                  />
                </Field>
              </div>
              <Field label="Observação de conservação">
                <input value={temperatureNotes} onChange={(e) => setTemperatureNotes(e.target.value)} className={selectClass} placeholder="Opcional" />
              </Field>
            </div>
          )}
        </FormSection>

        {error && (
          <p className="text-sm text-cinnamon bg-cinnamon/8 border border-cinnamon/25 rounded-md px-3 py-2 mb-4">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2.5 hover:bg-cosmic-ink/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-md bg-blue-opal text-white text-sm font-medium py-2.5 hover:bg-blue-opal/90 transition-colors"
          >
            Criar Pedido
          </button>
        </div>
      </form>
    </div>
  );
}

const selectClass =
  "w-full rounded-md border border-cosmic-ink/15 bg-white px-3 py-2 text-sm text-cosmic-ink focus:outline-none focus:ring-1 focus:ring-blue-opal";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-1">{label}</span>
      {children}
    </label>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] uppercase tracking-wider text-cosmic-ink/40 mb-0.5">{children}</span>;
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cosmic-ink/10 bg-white/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-cosmic-ink/40">{label}</p>
      <p className="text-sm font-medium tabular text-cosmic-ink">{value}</p>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 pb-5 border-b border-cosmic-ink/10 last:border-0 last:mb-4 last:pb-0 space-y-3">
      <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-cosmic-ink/50">{title}</h3>
      {children}
    </div>
  );
}
