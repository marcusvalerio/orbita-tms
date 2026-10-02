"use client";

import { Suspense, useState } from "react";
import { Copy, Handshake, Plus, RefreshCw, KeyRound } from "lucide-react";
import type { PartnerCompany } from "@/lib/domain/types";
import type { NewPartnerCompanyInput } from "@/lib/sim/reducer";
import { useOperation } from "@/components/operation/OperationProvider";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, ConfirmDialog, DataTable, Dialog, Drawer, EmptyState, Field, Input, KeyValue, LoadingState, Textarea, type Column } from "@/components/ds";

const empty = (): NewPartnerCompanyInput => ({ legalName: "", tradeName: "", cnpj: "", responsibleName: "", phone: "", email: "", cep: "", address: "", addressNumber: "", complement: "", neighborhood: "", city: "", state: "", notes: "" });

function PartnersInner() {
  const { data, can } = useOperation();
  const [sel, setSel] = useUrlParam("parceiro");
  const [creating, setCreating] = useState(false);
  const open = data.partnerCompanies.find((p) => p.id === sel) ?? null;
  useBreadcrumb(open ? (open.tradeName || open.legalName) : null);
  const solicitations = (p: PartnerCompany) => data.solicitations.filter((s) => s.partnerCompanyId === p.id);

  const columns: Column<PartnerCompany>[] = [
    { id: "nome", header: "Empresa", cell: (p) => <span className="font-medium">{p.tradeName || p.legalName}</span>, sortValue: (p) => p.tradeName || p.legalName },
    { id: "razao", header: "Razão social", cell: (p) => p.legalName, hideBelow: "lg" },
    { id: "cidade", header: "Cidade", cell: (p) => (p.city ? `${p.city}${p.state ? `/${p.state}` : ""}` : "—"), hideBelow: "md" },
    { id: "codigo", header: "Código de acesso", cell: (p) => p.accessCode, mono: true },
    { id: "sol", header: "Solicitações", align: "right", cell: (p) => solicitations(p).length, sortValue: (p) => solicitations(p).length },
    { id: "status", header: "Situação", cell: (p) => <span className={p.status === "Ativa" ? "text-success-fg" : "text-fg-muted"}>{p.status}</span> },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Parceiros"
        meta={<span className="tabular">{data.partnerCompanies.length} empresa(s) parceira(s) · enviam solicitações pelo Portal do Parceiro</span>}
        actions={
          can("partners:manage") && (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
              Nova empresa parceira
            </Button>
          )
        }
      />
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Empresas parceiras"
          rows={data.partnerCompanies}
          rowKey={(p) => p.id}
          columns={columns}
          activeKey={sel}
          onRowClick={(p) => setSel(p.id)}
          className="h-full"
          empty={<EmptyState icon={<Handshake />} title="Nenhuma empresa parceira cadastrada." description="Cadastre a primeira para começar a receber solicitações de transporte pelo Portal." action={can("partners:manage") ? <Button variant="primary" onClick={() => setCreating(true)}>Nova empresa parceira</Button> : undefined} />}
          card={(p) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-fg">{p.tradeName || p.legalName}</p>
                <p className="orb-data text-caption text-fg-muted">{p.accessCode}</p>
              </div>
              <span className="text-caption text-fg-muted">{solicitations(p).length} solicitação(ões)</span>
            </div>
          )}
        />
      </div>
      <Drawer open={!!open} onOpenChange={(o) => !o && setSel(null)} title={open ? open.tradeName || open.legalName : ""} subtitle={open?.legalName}>
        {open && <PartnerDetail partner={open} />}
      </Drawer>
      {creating && <NewPartnerDialog open={creating} onOpenChange={setCreating} onCreated={(id) => setSel(id)} />}
    </div>
  );
}

function PartnerDetail({ partner }: { partner: PartnerCompany }) {
  const { data, can, regeneratePartnerCode, notify } = useOperation();
  const [confirm, setConfirm] = useState(false);
  const sols = data.solicitations.filter((s) => s.partnerCompanyId === partner.id);
  const copy = () => {
    navigator.clipboard?.writeText(partner.accessCode).then(
      () => notify(`Código ${partner.accessCode} copiado.`, "success"),
      () => notify("Não foi possível copiar — selecione o código manualmente.", "error")
    );
  };
  return (
    <div className="space-y-5 px-5 py-4">
      <section aria-label="Código de acesso" className="rounded-md border border-line-subtle bg-canvas p-4">
        <p className="flex items-center gap-1.5 text-caption text-fg-muted">
          <KeyRound className="size-3.5" aria-hidden /> Código de acesso ao Portal do Parceiro
        </p>
        <p className="orb-data mt-1 text-display font-semibold text-fg">{partner.accessCode}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" icon={<Copy className="size-3.5" aria-hidden />} onClick={copy}>
            Copiar
          </Button>
          {can("partners:manage") && (
            <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={() => setConfirm(true)}>
              Regenerar
            </Button>
          )}
        </div>
        <p className="mt-2 text-caption text-fg-subtle">Mecanismo provisório de acesso. Regenerar invalida o código anterior.</p>
      </section>
      <dl className="grid grid-cols-2 gap-3">
        <KeyValue label="CNPJ" value={partner.cnpj || "—"} mono />
        <KeyValue label="Responsável" value={partner.responsibleName || "—"} />
        <KeyValue label="Telefone" value={partner.phone || "—"} />
        <KeyValue label="E-mail" value={partner.email || "—"} />
        <KeyValue label="Endereço" value={[partner.address, partner.addressNumber, partner.city, partner.state].filter(Boolean).join(", ") || "—"} className="col-span-2" />
      </dl>
      <section aria-label="Solicitações">
        <p className="mb-2 text-h3 text-fg">
          Solicitações <span className="tabular font-normal text-fg-subtle">{sols.length}</span>
        </p>
        {sols.length === 0 ? (
          <p className="text-body-sm text-fg-muted">Nenhuma solicitação enviada ainda.</p>
        ) : (
          <ul className="divide-y divide-line-subtle rounded-md border border-line-subtle">
            {sols.map((s) => (
              <li key={s.id}>
                <a href={`/orders?aba=entrada&solicitacao=${s.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm hover:bg-surface-hover">
                  <span className="orb-data text-fg">{s.id}</span>
                  <span className="truncate text-fg-muted">{s.productDescription}</span>
                  <span className="shrink-0 text-caption text-fg-muted">{s.status}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Regenerar código de acesso?"
        description={`O código ${partner.accessCode} deixa de funcionar imediatamente. Informe o novo código ao parceiro.`}
        confirmLabel="Regenerar código"
        tone="danger"
        onConfirm={() => void regeneratePartnerCode(partner.id)}
      />
    </div>
  );
}

function NewPartnerDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { createPartnerCompany } = useOperation();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof NewPartnerCompanyInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    if (!form.legalName.trim()) {
      setError("Informe a razão social.");
      return;
    }
    setBusy(true);
    const outcome = await createPartnerCompany(form);
    setBusy(false);
    if (!outcome.ok) return;
    const created = outcome.data.partnerCompanies.find((p) => p.legalName === form.legalName.trim() || p.legalName === form.legalName);
    onOpenChange(false);
    if (created) onCreated(created.id);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      title="Nova empresa parceira"
      description="Um código de acesso ao Portal é gerado automaticamente."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Cadastrar
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
        <Field label="Razão social" required error={error}>
          <Input value={form.legalName} onChange={set("legalName")} autoFocus />
        </Field>
        <Field label="Nome fantasia">
          <Input value={form.tradeName} onChange={set("tradeName")} />
        </Field>
        <Field label="CNPJ">
          <Input value={form.cnpj} onChange={set("cnpj")} inputMode="numeric" placeholder="Opcional" className="orb-data" />
        </Field>
        <Field label="Responsável">
          <Input value={form.responsibleName} onChange={set("responsibleName")} />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" />
        </Field>
        <Field label="E-mail">
          <Input value={form.email} onChange={set("email")} type="email" />
        </Field>
        <Field label="CEP">
          <Input value={form.cep} onChange={set("cep")} inputMode="numeric" className="orb-data" />
        </Field>
        <Field label="Cidade / UF">
          <div className="flex gap-2">
            <Input value={form.city} onChange={set("city")} aria-label="Cidade" />
            <Input value={form.state} onChange={set("state")} aria-label="UF" maxLength={2} className="w-16 uppercase" />
          </div>
        </Field>
        <Field label="Endereço">
          <Input value={form.address} onChange={set("address")} />
        </Field>
        <Field label="Número · complemento">
          <div className="flex gap-2">
            <Input value={form.addressNumber} onChange={set("addressNumber")} aria-label="Número" className="w-24" />
            <Input value={form.complement} onChange={set("complement")} aria-label="Complemento" />
          </div>
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={set("notes")} />
        </Field>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

export default function ParceirosPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PartnersInner />
    </Suspense>
  );
}
