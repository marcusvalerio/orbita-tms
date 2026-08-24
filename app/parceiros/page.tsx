"use client";

import { useState } from "react";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import type { NewPartnerCompanyInput } from "@/lib/sim/reducer";

const selectClass =
  "w-full rounded-md border border-cosmic-ink/15 bg-white px-3 py-2 text-sm text-cosmic-ink focus:outline-none focus:ring-1 focus:ring-blue-opal";

function emptyForm(): NewPartnerCompanyInput {
  return {
    legalName: "",
    tradeName: "",
    cnpj: "",
    responsibleName: "",
    phone: "",
    email: "",
    cep: "",
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    notes: "",
  };
}

export default function ParceirosPage() {
  const { data, createPartnerCompany, regeneratePartnerCode } = useSimulation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewPartnerCompanyInput>(emptyForm());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.legalName.trim()) return;
    createPartnerCompany(form);
    setForm(emptyForm());
    setShowForm(false);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Cadastros"
        title="Empresas Parceiras"
        meta={<span className="tabular">{data.partnerCompanies.length} cadastradas</span>}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-blue-opal text-white text-sm font-medium px-3.5 py-1.5 hover:bg-blue-opal/90 transition-colors"
          >
            + Nova empresa parceira
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-3xl">
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-cosmic-ink/10 bg-white/60 p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Razão social">
                <input
                  required
                  value={form.legalName}
                  onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                  className={selectClass}
                />
              </Field>
              <Field label="Nome fantasia">
                <input value={form.tradeName} onChange={(e) => setForm((f) => ({ ...f, tradeName: e.target.value }))} className={selectClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CNPJ">
                <input value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} className={selectClass} placeholder="Opcional" />
              </Field>
              <Field label="Responsável">
                <input value={form.responsibleName} onChange={(e) => setForm((f) => ({ ...f, responsibleName: e.target.value }))} className={selectClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone">
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={selectClass} />
              </Field>
              <Field label="E-mail">
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={selectClass} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="CEP">
                <input value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))} className={selectClass} />
              </Field>
              <Field label="Cidade">
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={selectClass} />
              </Field>
              <Field label="Estado">
                <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className={selectClass} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Endereço">
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={selectClass} />
              </Field>
              <Field label="Número">
                <input value={form.addressNumber} onChange={(e) => setForm((f) => ({ ...f, addressNumber: e.target.value }))} className={selectClass} />
              </Field>
              <Field label="Complemento">
                <input value={form.complement} onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))} className={selectClass} />
              </Field>
            </div>
            <Field label="Observações">
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={`${selectClass} min-h-16`} />
            </Field>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2 hover:bg-cosmic-ink/5 transition-colors"
              >
                Cancelar
              </button>
              <button type="submit" className="flex-1 rounded-md bg-blue-opal text-white text-sm font-medium py-2 hover:bg-blue-opal/90 transition-colors">
                Cadastrar
              </button>
            </div>
          </form>
        )}

        {data.partnerCompanies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-cosmic-ink/20 bg-white/40 px-6 py-8 text-center">
            <p className="font-display font-semibold text-cosmic-ink mb-1">Nenhuma empresa parceira cadastrada.</p>
            <p className="text-sm text-cosmic-ink/55">
              Cadastre sua primeira empresa para começar a receber solicitações de transporte.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.partnerCompanies.map((partner) => (
              <div key={partner.id} className="rounded-lg border border-cosmic-ink/10 bg-white/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold text-cosmic-ink">{partner.tradeName || partner.legalName}</p>
                    {partner.tradeName && <p className="text-xs text-cosmic-ink/50">{partner.legalName}</p>}
                  </div>
                  <span
                    className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                      partner.status === "Ativa" ? "bg-emerald-600/10 text-emerald-700" : "bg-cosmic-ink/8 text-cosmic-ink/50"
                    }`}
                  >
                    {partner.status}
                  </span>
                </div>

                <div className="mt-3 rounded-md border border-blue-opal/20 bg-blue-opal/5 px-3 py-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-blue-opal/70">Código de Acesso</p>
                    <p className="font-display font-semibold tabular text-blue-opal">{partner.accessCode}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(partner.accessCode, partner.id)}
                      className="text-xs font-medium text-blue-opal hover:underline"
                    >
                      {copiedId === partner.id ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => regeneratePartnerCode(partner.id)}
                      className="text-xs font-medium text-cosmic-ink/50 hover:text-cosmic-ink"
                    >
                      Regenerar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-1">{label}</span>
      {children}
    </label>
  );
}
