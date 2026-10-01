"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Snowflake, ArrowRight } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { Button, Dialog, Field, Input, Select, Textarea, DateInput, SegmentedControl, IconButton, Combobox, Kbd } from "@/components/ds";
import type { CargoCharacteristic } from "@/lib/domain/types";
import type { NewOrderItemInput } from "@/lib/sim/reducer";
import { cn } from "@/lib/ui/cn";

// Novo pedido como operação rápida: um formulário único (sem etapas
// escondidas), padrões sensatos, validação por campo antes de enviar, resumo
// sempre visível, ⌘/Ctrl+Enter para criar e "criar outro" para lançamentos
// em sequência. O domínio continua validando (erro aparece no formulário).

const CHARACTERISTICS: CargoCharacteristic[] = ["Refrigerada", "Congelada", "Temperatura ambiente", "Frágil", "Alto valor", "Perigosa", "Perecível", "Sensível à umidade", "Manuseio especial"];

const emptyItem = (): NewOrderItemInput => ({ productId: undefined, description: "", quantity: 1, unitWeightKg: 1, volumeM3: undefined });
const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

type Errors = Partial<Record<string, string>>;

export function NewOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, createOrder } = useOperation();
  const cds = data.locations.filter((l) => l.kind === "CD");
  const clients = data.locations.filter((l) => l.kind === "Cliente");

  const [operationType, setOperationType] = useState<"B2B" | "B2C" | "Outro">("B2C");
  const [customerId, setCustomerId] = useState<string | null>(data.customers[0]?.id ?? null);
  const [requestedBy, setRequestedBy] = useState("");
  const [priority, setPriority] = useState<"Normal" | "Alta" | "Urgente">("Normal");
  const [generalNotes, setGeneralNotes] = useState("");
  const [originId, setOriginId] = useState(cds[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState(isoDay());
  const [pickupWindowStart, setPickupWindowStart] = useState("08:00");
  const [pickupWindowEnd, setPickupWindowEnd] = useState("12:00");
  const [destinationId, setDestinationId] = useState<string | null>(clients[0]?.id ?? null);
  const [dueDate, setDueDate] = useState(isoDay(2));
  const [deliveryWindowStart, setDeliveryWindowStart] = useState("");
  const [deliveryWindowEnd, setDeliveryWindowEnd] = useState("");
  const [destinationContactName, setDestinationContactName] = useState("");
  const [destinationContactPhone, setDestinationContactPhone] = useState("");
  const [items, setItems] = useState<NewOrderItemInput[]>([emptyItem()]);
  const [characteristics, setCharacteristics] = useState<CargoCharacteristic[]>([]);
  const [temperatureMin, setTemperatureMin] = useState<string>("");
  const [temperatureMax, setTemperatureMax] = useState<string>("");
  const [temperatureNotes, setTemperatureNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [domainError, setDomainError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [another, setAnother] = useState(false);

  const needsTemperature = characteristics.includes("Refrigerada") || characteristics.includes("Congelada");
  const totals = useMemo(() => {
    const weight = items.reduce((s, it) => s + it.quantity * it.unitWeightKg, 0);
    const volume = items.reduce((s, it) => s + (it.volumeM3 ?? (it.quantity * it.unitWeightKg) / 140), 0);
    return { weight: Math.round(weight * 100) / 100, volume: Math.round(volume * 100) / 100 };
  }, [items]);
  const origin = data.locations.find((l) => l.id === originId);
  const destination = data.locations.find((l) => l.id === destinationId);

  const updateItem = (i: number, patch: Partial<NewOrderItemInput>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const validate = (): Errors => {
    const e: Errors = {};
    if (!customerId) e.customer = "Escolha o cliente.";
    if (!destinationId) e.destination = "Escolha o destino.";
    if (dueDate < pickupDate) e.dueDate = "A entrega não pode ser antes da coleta.";
    if (pickupWindowStart && pickupWindowEnd && pickupWindowEnd < pickupWindowStart) e.pickupWindow = "O fim da janela de coleta é antes do início.";
    if (deliveryWindowStart && deliveryWindowEnd && deliveryWindowEnd < deliveryWindowStart) e.deliveryWindow = "O fim da janela de entrega é antes do início.";
    items.forEach((it, i) => {
      if (!(it.quantity > 0)) e[`qty-${i}`] = "Maior que zero.";
      if (!(it.unitWeightKg > 0)) e[`weight-${i}`] = "Maior que zero.";
    });
    if (needsTemperature && temperatureMin && temperatureMax && Number(temperatureMax) < Number(temperatureMin)) e.temperature = "A máxima é menor que a mínima.";
    return e;
  };

  const reset = () => {
    setItems([emptyItem()]);
    setGeneralNotes("");
    setRequestedBy("");
    setDestinationContactName("");
    setDestinationContactPhone("");
    setErrors({});
    setDomainError(null);
  };

  const submit = async () => {
    if (busy) return;
    setDomainError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const outcome = await createOrder({
      customerId: customerId!,
      originId,
      destinationId: destinationId!,
      operationType,
      requestedBy: requestedBy || undefined,
      priority,
      generalNotes: generalNotes || undefined,
      pickupDate,
      pickupWindowStart: pickupWindowStart || undefined,
      pickupWindowEnd: pickupWindowEnd || undefined,
      dueDate,
      deliveryWindowStart: deliveryWindowStart || undefined,
      deliveryWindowEnd: deliveryWindowEnd || undefined,
      destinationContactName: destinationContactName || undefined,
      destinationContactPhone: destinationContactPhone || undefined,
      items,
      cargoCharacteristics: characteristics,
      temperatureMin: needsTemperature && temperatureMin ? Number(temperatureMin) : undefined,
      temperatureMax: needsTemperature && temperatureMax ? Number(temperatureMax) : undefined,
      temperatureNotes: needsTemperature ? temperatureNotes || undefined : undefined,
    });
    setBusy(false);
    if (!outcome.ok) {
      setDomainError(outcome.error);
      return;
    }
    reset();
    if (!another) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      size="lg"
      title="Novo pedido"
      description="Ordem de serviço: coleta, entrega e carga. Entra direto na fila de planejamento."
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          {domainError && (
            <p role="alert" className="w-full rounded-sm border border-danger-line bg-danger-subtle px-3 py-2 text-body-sm text-danger-fg">
              {domainError}
            </p>
          )}
          <label className="mr-auto flex items-center gap-2 text-body-sm text-fg-muted">
            <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="size-4 accent-(--orb-fg)" />
            Criar outro em seguida
          </label>
          <span className="hidden items-center gap-1 text-caption text-fg-subtle sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
          </span>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Criar pedido
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        className="grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]"
      >
        <div className="min-w-0 space-y-6">
          <Section title="Operação">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <SegmentedControl label="Tipo de operação" value={operationType} onChange={setOperationType} options={[{ value: "B2B", label: "B2B" }, { value: "B2C", label: "B2C" }, { value: "Outro", label: "Outro" }]} className="w-full" />
              </Field>
              <Field label="Prioridade">
                <SegmentedControl label="Prioridade" value={priority} onChange={setPriority} options={[{ value: "Normal", label: "Normal" }, { value: "Alta", label: "Alta" }, { value: "Urgente", label: "Urgente" }]} className="w-full" />
              </Field>
              <Field label="Cliente" required error={errors.customer} className="sm:col-span-2">
                <Combobox label="Cliente" value={customerId} onChange={setCustomerId} placeholder="Buscar cliente" options={data.customers.map((c) => ({ value: c.id, label: c.name }))} />
              </Field>
              <Field label="Responsável pela solicitação">
                <Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Opcional" />
              </Field>
              <Field label="Observações">
                <Input value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
          </Section>

          <Section title="Coleta">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Local (CD)" className="sm:col-span-2">
                <Select value={originId} onChange={(e) => setOriginId(e.target.value)}>
                  {cds.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data">
                <DateInput value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
              </Field>
              <Field label="Janela" error={errors.pickupWindow}>
                <div className="flex items-center gap-1">
                  <DateInput kind="time" aria-label="Início da janela de coleta" value={pickupWindowStart} onChange={(e) => setPickupWindowStart(e.target.value)} />
                  <DateInput kind="time" aria-label="Fim da janela de coleta" value={pickupWindowEnd} onChange={(e) => setPickupWindowEnd(e.target.value)} />
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Entrega">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Destino" required error={errors.destination} className="sm:col-span-2">
                <Combobox label="Destino" value={destinationId} onChange={setDestinationId} placeholder="Buscar destino" options={clients.map((l) => ({ value: l.id, label: l.name, hint: `${l.city}/${l.state}` }))} />
              </Field>
              <Field label="Prazo" error={errors.dueDate}>
                <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Janela" error={errors.deliveryWindow} hint="Opcional">
                <div className="flex items-center gap-1">
                  <DateInput kind="time" aria-label="Início da janela de entrega" value={deliveryWindowStart} onChange={(e) => setDeliveryWindowStart(e.target.value)} />
                  <DateInput kind="time" aria-label="Fim da janela de entrega" value={deliveryWindowEnd} onChange={(e) => setDeliveryWindowEnd(e.target.value)} />
                </div>
              </Field>
              <Field label="Contato no destino" className="sm:col-span-2">
                <Input value={destinationContactName} onChange={(e) => setDestinationContactName(e.target.value)} placeholder="Opcional" />
              </Field>
              <Field label="Telefone" className="sm:col-span-2">
                <Input type="tel" inputMode="tel" value={destinationContactPhone} onChange={(e) => setDestinationContactPhone(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
          </Section>

          <Section title="Carga">
            <div className="space-y-2">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_72px_96px_88px_32px] gap-2 px-0.5 text-label text-fg-muted sm:grid">
                <span>Item</span>
                <span>Qtd.</span>
                <span>Peso unit. (kg)</span>
                <span>Vol. (m³)</span>
                <span />
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-sm border border-line-subtle p-2 sm:grid-cols-[minmax(0,1.6fr)_72px_96px_88px_32px] sm:border-0 sm:p-0">
                  <div className="col-span-2 flex min-w-0 gap-1 sm:col-span-1">
                    <Select aria-label={`Produto do item ${i + 1}`} value={item.productId ?? ""} onChange={(e) => updateItem(i, { productId: e.target.value || undefined })} className={item.productId ? "" : "max-w-[44%]"}>
                      <option value="">Avulso</option>
                      {data.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                    {!item.productId && <Input aria-label={`Descrição do item ${i + 1}`} value={item.description ?? ""} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Descrição" />}
                  </div>
                  <Input
                    aria-label={`Quantidade do item ${i + 1}`}
                    aria-invalid={!!errors[`qty-${i}`] || undefined}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    className="tabular"
                  />
                  <Input
                    aria-label={`Peso unitário (kg) do item ${i + 1}`}
                    aria-invalid={!!errors[`weight-${i}`] || undefined}
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    step={0.1}
                    value={item.unitWeightKg}
                    onChange={(e) => updateItem(i, { unitWeightKg: Number(e.target.value) })}
                    className="tabular"
                  />
                  <Input
                    aria-label={`Volume (m³) do item ${i + 1}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={item.volumeM3 ?? ""}
                    onChange={(e) => updateItem(i, { volumeM3: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="auto"
                    className="tabular"
                  />
                  <IconButton label={`Remover item ${i + 1}`} size="md" icon={<Trash2 className="size-4" />} disabled={items.length === 1} onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} />
                  {(errors[`qty-${i}`] || errors[`weight-${i}`]) && <p className="col-span-full text-caption text-danger-fg">Quantidade e peso unitário precisam ser maiores que zero.</p>}
                </div>
              ))}
              <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden />} onClick={() => setItems((prev) => [...prev, emptyItem()])}>
                Adicionar item
              </Button>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-label text-fg-muted">Características</legend>
              <div className="flex flex-wrap gap-1.5">
                {CHARACTERISTICS.map((c) => {
                  const on = characteristics.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCharacteristics((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))}
                      className={cn("h-7 rounded-sm border px-2 text-body-sm transition-colors", on ? "border-fg bg-fg text-fg-inverse" : "border-line text-fg hover:border-line-strong")}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="orb-collapsible mt-3" data-open={needsTemperature}>
              <div>
                <div className="grid gap-3 rounded-sm border border-info-line bg-info-subtle p-3 sm:grid-cols-3">
                  <p className="flex items-center gap-1.5 text-body-sm font-medium text-info-fg sm:col-span-3">
                    <Snowflake className="size-4" aria-hidden /> Carga com controle de temperatura
                  </p>
                  <Field label="Mínima (°C)">
                    <Input type="number" value={temperatureMin} onChange={(e) => setTemperatureMin(e.target.value)} tabIndex={needsTemperature ? 0 : -1} />
                  </Field>
                  <Field label="Máxima (°C)" error={errors.temperature}>
                    <Input type="number" value={temperatureMax} onChange={(e) => setTemperatureMax(e.target.value)} tabIndex={needsTemperature ? 0 : -1} />
                  </Field>
                  <Field label="Observação">
                    <Textarea rows={1} value={temperatureNotes} onChange={(e) => setTemperatureNotes(e.target.value)} tabIndex={needsTemperature ? 0 : -1} className="min-h-8" />
                  </Field>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Resumo sempre visível */}
        <aside aria-label="Resumo do pedido" className="h-fit space-y-3 rounded-md border border-line-subtle bg-canvas p-3 md:sticky md:top-0">
          <p className="text-h3 text-fg">Resumo</p>
          <div className="text-body-sm text-fg">
            <p className="truncate">{origin?.name ?? "—"}</p>
            <ArrowRight className="my-0.5 size-3.5 text-fg-subtle" aria-hidden />
            <p className="truncate">{destination ? `${destination.name}` : "Destino?"}</p>
            {destination && <p className="text-caption text-fg-muted">{destination.city}/{destination.state}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-2 border-t border-line-subtle pt-3">
            <div>
              <dt className="text-caption text-fg-muted">Peso</dt>
              <dd className="orb-data text-body font-medium text-fg">{totals.weight.toLocaleString("pt-BR")} kg</dd>
            </div>
            <div>
              <dt className="text-caption text-fg-muted">Volume</dt>
              <dd className="orb-data text-body font-medium text-fg">{totals.volume.toLocaleString("pt-BR")} m³</dd>
            </div>
            <div>
              <dt className="text-caption text-fg-muted">Itens</dt>
              <dd className="tabular text-body text-fg">{items.length}</dd>
            </div>
            <div>
              <dt className="text-caption text-fg-muted">Prioridade</dt>
              <dd className={cn("text-body", priority === "Urgente" ? "font-semibold text-danger-fg" : priority === "Alta" ? "font-medium text-warning-fg" : "text-fg")}>{priority}</dd>
            </div>
          </dl>
          <p className="border-t border-line-subtle pt-3 text-caption text-fg-muted">
            Coleta <span className="orb-data text-fg">{new Date(`${pickupDate}T12:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span> · entrega até{" "}
            <span className="orb-data text-fg">{new Date(`${dueDate}T12:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
          </p>
        </aside>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 border-b border-line-subtle pb-1.5 text-h3 text-fg">{title}</h3>
      {children}
    </section>
  );
}
