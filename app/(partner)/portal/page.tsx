"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Inbox, LogOut, Plus } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { useOperation } from "@/components/operation/OperationProvider";
import { OrbitaMark } from "@/components/ui/OrbitaMark";
import { Button, Dialog, EmptyState, Field, Input, Select, SegmentedControl, Status, Textarea, DateInput } from "@/components/ds";
import type { CargoCharacteristic, PartnerCompany } from "@/lib/domain/types";
import type { NewSolicitationInput } from "@/lib/sim/reducer";
import { cn } from "@/lib/ui/cn";

// Portal do Parceiro: área separada do TMS (sem menu interno). O parceiro
// entra com o código de acesso (Modo Demo) ou autenticado (Produção), envia
// solicitações e acompanha o status.

const CHARACTERISTICS: CargoCharacteristic[] = ["Refrigerada", "Congelada", "Temperatura ambiente", "Frágil", "Alto valor", "Perigosa", "Perecível", "Sensível à umidade", "Manuseio especial"];
const isoDay = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export default function PortalDoParceiroPage() {
  const { data, createSolicitation, mode } = useOperation();
  const [code, setCode] = useState("");
  const [active, setActive] = useState<PartnerCompany | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (mode === "production") {
    const partner = data.partnerCompanies[0];
    if (!partner)
      return (
        <main id="conteudo" className="grid min-h-dvh place-items-center bg-canvas px-4">
          <p role="alert" className="max-w-sm text-center text-body text-fg-muted">
            Sua conta não está vinculada a uma empresa parceira ativa. Procure a operadora.
          </p>
        </main>
      );
    return <PartnerWorkspace partner={partner} onExit={() => signOut()} createSolicitation={createSolicitation} />;
  }

  if (!active) {
    const enter = (e: React.FormEvent) => {
      e.preventDefault();
      const partner = data.partnerCompanies.find((p) => p.accessCode.toLowerCase() === code.trim().toLowerCase());
      if (!partner) return setError("Código não encontrado. Confira com a empresa operadora.");
      if (partner.status !== "Ativa") return setError("Esta empresa está inativa e não pode enviar novas solicitações.");
      setError(null);
      setActive(partner);
    };
    return (
      <main id="conteudo" className="grid min-h-dvh place-items-center bg-canvas px-4">
        <form onSubmit={enter} className="w-full max-w-sm rounded-lg border border-line-subtle bg-surface p-6 shadow-2">
          <div className="mb-5 flex items-center gap-2">
            <OrbitaMark size={18} />
            <span className="font-display text-[15px] font-semibold text-fg">ÓRBITA</span>
          </div>
          <h1 className="font-display text-h1 text-fg">Portal do Parceiro</h1>
          <p className="mb-4 mt-1 text-body-sm text-fg-muted">Informe o código de acesso fornecido pela sua operadora.</p>
          <Field label="Código de acesso" error={error}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: FSC-4821" autoComplete="off" className="orb-data h-10 text-center text-h2 uppercase" autoFocus />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" trailing={<ArrowRight className="size-4" aria-hidden />}>
            Continuar
          </Button>
        </form>
      </main>
    );
  }

  return (
    <PartnerWorkspace
      partner={active}
      onExit={() => {
        setActive(null);
        setCode("");
      }}
      createSolicitation={createSolicitation}
    />
  );
}

function PartnerWorkspace({ partner, onExit, createSolicitation }: { partner: PartnerCompany; onExit: () => void; createSolicitation: (input: NewSolicitationInput) => Promise<{ ok: boolean }> }) {
  const { data, mode } = useOperation();
  const [creating, setCreating] = useState(false);
  const mine = (mode === "production" ? data.solicitations : data.solicitations.filter((s) => s.partnerCompanyId === partner.id)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const loc = (id: string) => data.locations.find((l) => l.id === id);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <OrbitaMark size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-fg-muted">Portal do Parceiro</p>
            <p className="truncate text-h3 text-fg">{partner.tradeName || partner.legalName}</p>
          </div>
          <Button variant="ghost" icon={<LogOut className="size-4" aria-hidden />} onClick={onExit}>
            Sair
          </Button>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-h1 text-fg">Minhas solicitações</h1>
            <p className="text-body-sm text-fg-muted">Acompanhe o andamento de cada solicitação enviada à operadora.</p>
          </div>
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
            Nova solicitação
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-line-subtle bg-surface">
          {mine.length === 0 ? (
            <EmptyState icon={<Inbox />} title="Nenhuma solicitação enviada ainda." description="Envie a primeira — ela chega na caixa de entrada da operadora." />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {mine.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="orb-data text-body-sm font-medium text-fg">{s.id}</span>
                      <span className="truncate text-body-sm text-fg">{s.productDescription}</span>
                    </p>
                    <p className="text-caption text-fg-muted">
                      {loc(s.originId)?.city} → {loc(s.destinationId)?.city} · {s.totalWeightKg.toLocaleString("pt-BR")} kg · enviada em <span className="orb-data">{new Date(s.createdAt).toLocaleDateString("pt-BR")}</span>
                      {s.orderId && (
                        <>
                          {" "}
                          · pedido <span className="orb-data">{s.orderId}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <Status entity="solicitation" value={s.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      {creating && <NewSolicitationDialog partnerId={partner.id} open={creating} onOpenChange={setCreating} createSolicitation={createSolicitation} />}
    </div>
  );
}

function NewSolicitationDialog({ partnerId, open, onOpenChange, createSolicitation }: { partnerId: string; open: boolean; onOpenChange: (o: boolean) => void; createSolicitation: (input: NewSolicitationInput) => Promise<{ ok: boolean }> }) {
  const { data } = useOperation();
  const cds = useMemo(() => data.locations.filter((l) => l.kind === "CD"), [data.locations]);
  const clients = useMemo(() => data.locations.filter((l) => l.kind === "Cliente"), [data.locations]);
  const [f, setF] = useState({
    operationType: "B2C" as "B2B" | "B2C",
    requestedBy: "",
    contact: "",
    originId: cds[0]?.id ?? "",
    pickupDate: isoDay(),
    pickupWindowStart: "08:00",
    pickupWindowEnd: "12:00",
    destinationId: clients[0]?.id ?? "",
    deliveryDate: isoDay(2),
    destinationContactName: "",
    destinationContactPhone: "",
    productDescription: "",
    quantity: 1,
    totalWeightKg: 1,
    totalVolumeM3: "",
    nfeNumber: "",
    romaneioNumber: "",
    notes: "",
  });
  const [chars, setChars] = useState<CargoCharacteristic[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.originId || !f.destinationId) e.route = "Selecione origem e destino.";
    if (!f.productDescription.trim()) e.product = "Descreva a carga.";
    if (!(f.quantity > 0)) e.quantity = "Maior que zero.";
    if (!(f.totalWeightKg > 0)) e.weight = "Maior que zero.";
    if (f.deliveryDate < f.pickupDate) e.date = "A entrega não pode ser antes da retirada.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const outcome = await createSolicitation({
      partnerCompanyId: partnerId,
      requestedBy: f.requestedBy || undefined,
      contact: f.contact || undefined,
      operationType: f.operationType,
      originId: f.originId,
      destinationId: f.destinationId,
      pickupDate: new Date(f.pickupDate).toISOString(),
      pickupWindowStart: f.pickupWindowStart,
      pickupWindowEnd: f.pickupWindowEnd,
      deliveryDate: new Date(f.deliveryDate).toISOString(),
      destinationContactName: f.destinationContactName || undefined,
      destinationContactPhone: f.destinationContactPhone || undefined,
      productDescription: f.productDescription,
      quantity: f.quantity,
      totalWeightKg: f.totalWeightKg,
      totalVolumeM3: f.totalVolumeM3 ? Number(f.totalVolumeM3) : undefined,
      cargoCharacteristics: chars,
      nfeNumber: f.nfeNumber || undefined,
      romaneioNumber: f.romaneioNumber || undefined,
      notes: f.notes || undefined,
    });
    setBusy(false);
    if (outcome.ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      size="lg"
      title="Nova solicitação de transporte"
      description="A operadora analisa e converte em pedido."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Enviar solicitação
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Tipo de operação">
          <SegmentedControl label="Tipo de operação" value={f.operationType} onChange={(v) => set("operationType", v)} options={[{ value: "B2B", label: "B2B" }, { value: "B2C", label: "B2C" }]} className="w-full" />
        </Field>
        <Field label="Responsável">
          <Input value={f.requestedBy} onChange={(e) => set("requestedBy", e.target.value)} />
        </Field>
        <Field label="Local de retirada" error={errors.route}>
          <Select value={f.originId} onChange={(e) => set("originId", e.target.value)}>
            {cds.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.city}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Destino">
          <Select value={f.destinationId} onChange={(e) => set("destinationId", e.target.value)}>
            {clients.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.city}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Retirada">
          <div className="flex gap-1">
            <DateInput value={f.pickupDate} onChange={(e) => set("pickupDate", e.target.value)} aria-label="Data de retirada" />
            <DateInput kind="time" value={f.pickupWindowStart} onChange={(e) => set("pickupWindowStart", e.target.value)} aria-label="Início da janela de retirada" />
            <DateInput kind="time" value={f.pickupWindowEnd} onChange={(e) => set("pickupWindowEnd", e.target.value)} aria-label="Fim da janela de retirada" />
          </div>
        </Field>
        <Field label="Entrega prevista" error={errors.date}>
          <DateInput value={f.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} />
        </Field>
        <Field label="Contato no destino">
          <Input value={f.destinationContactName} onChange={(e) => set("destinationContactName", e.target.value)} />
        </Field>
        <Field label="Telefone">
          <Input type="tel" inputMode="tel" value={f.destinationContactPhone} onChange={(e) => set("destinationContactPhone", e.target.value)} />
        </Field>
        <Field label="Produto / descrição da carga" required error={errors.product} className="sm:col-span-2">
          <Input value={f.productDescription} onChange={(e) => set("productDescription", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <Field label="Quantidade" error={errors.quantity}>
            <Input type="number" min={1} value={f.quantity} onChange={(e) => set("quantity", Number(e.target.value))} className="tabular" />
          </Field>
          <Field label="Peso total (kg)" error={errors.weight}>
            <Input type="number" min={0.1} step={0.1} value={f.totalWeightKg} onChange={(e) => set("totalWeightKg", Number(e.target.value))} className="tabular" />
          </Field>
          <Field label="Volume (m³)">
            <Input type="number" min={0} step={0.1} value={f.totalVolumeM3} onChange={(e) => set("totalVolumeM3", e.target.value)} placeholder="Opcional" className="tabular" />
          </Field>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-label text-fg-muted">Características</legend>
          <div className="flex flex-wrap gap-1.5">
            {CHARACTERISTICS.map((c) => {
              const on = chars.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => setChars((p) => (on ? p.filter((x) => x !== c) : [...p, c]))} className={cn("h-7 rounded-sm border px-2 text-body-sm", on ? "border-fg bg-fg text-fg-inverse" : "border-line text-fg hover:border-line-strong")}>
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="NF-e">
          <Input value={f.nfeNumber} onChange={(e) => set("nfeNumber", e.target.value)} placeholder="Opcional" className="orb-data" />
        </Field>
        <Field label="Romaneio">
          <Input value={f.romaneioNumber} onChange={(e) => set("romaneioNumber", e.target.value)} placeholder="Opcional" className="orb-data" />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
