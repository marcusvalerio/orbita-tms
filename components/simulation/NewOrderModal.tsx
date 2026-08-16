"use client";

import { useState } from "react";
import { useSimulation } from "./SimulationProvider";

export function NewOrderModal({ onClose }: { onClose: () => void }) {
  const { data, createOrder } = useSimulation();
  const cds = data.locations.filter((l) => l.kind === "CD");
  const clientLocations = data.locations.filter((l) => l.kind === "Cliente");

  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? "");
  const [originId, setOriginId] = useState(cds[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState(clientLocations[0]?.id ?? "");
  const [weight, setWeight] = useState(500);
  const [priority, setPriority] = useState<"Normal" | "Alta" | "Urgente">("Normal");
  const [daysUntilDue, setDaysUntilDue] = useState(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dueDate = new Date(Date.now() + daysUntilDue * 86400000).toISOString();
    createOrder({
      customerId,
      originId,
      destinationId,
      totalWeightKg: weight,
      priority,
      dueDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-cosmic-ink/40 px-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white shadow-xl px-6 py-5"
      >
        <h2 className="font-display font-semibold text-lg text-cosmic-ink mb-4">Novo Pedido</h2>

        <div className="space-y-3">
          <Field label="Cliente">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectClass}>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem">
              <select value={originId} onChange={(e) => setOriginId(e.target.value)} className={selectClass}>
                {cds.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.city}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Destino">
              <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={selectClass}>
                {clientLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.city}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso (kg)">
              <input
                type="number"
                min={1}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className={selectClass}
              />
            </Field>
            <Field label="Prioridade">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className={selectClass}
              >
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </Field>
          </div>

          <Field label="Data de expedição">
            <select
              value={daysUntilDue}
              onChange={(e) => setDaysUntilDue(Number(e.target.value))}
              className={selectClass}
            >
              <option value={0}>Hoje</option>
              <option value={1}>Amanhã</option>
              <option value={2}>Em 2 dias</option>
              <option value={4}>Em 4 dias</option>
            </select>
          </Field>
        </div>

        <div className="mt-5 flex gap-2">
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
