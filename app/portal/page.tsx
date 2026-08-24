"use client";

import { useMemo, useState } from "react";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import type { CargoCharacteristic, PartnerCompany } from "@/lib/domain/types";
import type { NewSolicitationInput } from "@/lib/sim/reducer";

const selectClass =
  "w-full rounded-md border border-cosmic-ink/15 bg-white px-3 py-2 text-sm text-cosmic-ink focus:outline-none focus:ring-1 focus:ring-blue-opal";

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function daysFromNowIso(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export default function PortalDoParceiroPage() {
  const { data, createSolicitation } = useSimulation();
  const [codeInput, setCodeInput] = useState("");
  const [activePartner, setActivePartner] = useState<PartnerCompany | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const partner = data.partnerCompanies.find(
      (p) => p.accessCode.toLowerCase() === codeInput.trim().toLowerCase()
    );
    if (!partner) {
      setCodeError("Código não encontrado. Confira com a empresa operadora.");
      return;
    }
    if (partner.status !== "Ativa") {
      setCodeError("Esta empresa está inativa e não pode enviar novas solicitações.");
      return;
    }
    setCodeError(null);
    setActivePartner(partner);
  };

  if (!activePartner) {
    return (
      <div className="h-screen flex items-center justify-center bg-milk-mustache px-4">
        <form onSubmit={handleEnter} className="w-full max-w-sm rounded-lg bg-white shadow-xl px-6 py-6">
          <p className="font-display font-semibold text-lg text-cosmic-ink mb-1">Portal do Parceiro</p>
          <p className="text-sm text-cosmic-ink/55 mb-4">Informe o código de acesso fornecido pela sua operadora.</p>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Ex.: FSC-4821"
            className={`${selectClass} text-center tabular font-display font-semibold`}
          />
          {codeError && <p className="text-sm text-cinnamon mt-2">{codeError}</p>}
          <button type="submit" className="mt-4 w-full rounded-md bg-blue-opal text-white text-sm font-medium py-2.5 hover:bg-blue-opal/90 transition-colors">
            Continuar
          </button>
        </form>
      </div>
    );
  }

  return (
    <PartnerWorkspace
      partner={activePartner}
      onExit={() => {
        setActivePartner(null);
        setCodeInput("");
      }}
      showForm={showForm}
      setShowForm={setShowForm}
      createSolicitation={createSolicitation}
      locations={data.locations}
      solicitations={data.solicitations.filter((s) => s.partnerCompanyId === activePartner.id)}
    />
  );
}

function PartnerWorkspace({
  partner,
  onExit,
  showForm,
  setShowForm,
  createSolicitation,
  locations,
  solicitations,
}: {
  partner: PartnerCompany;
  onExit: () => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  createSolicitation: (input: NewSolicitationInput) => void;
  locations: ReturnType<typeof useSimulation>["data"]["locations"];
  solicitations: ReturnType<typeof useSimulation>["data"]["solicitations"];
}) {
  const cds = useMemo(() => locations.filter((l) => l.kind === "CD"), [locations]);
  const clientLocations = useMemo(() => locations.filter((l) => l.kind === "Cliente"), [locations]);

  return (
    <div className="min-h-screen bg-milk-mustache">
      <header className="border-b border-cosmic-ink/10 bg-white/60 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/45">Portal do Parceiro</p>
          <p className="font-display font-semibold text-cosmic-ink">{partner.tradeName || partner.legalName}</p>
        </div>
        <button type="button" onClick={onExit} className="text-xs font-medium text-cosmic-ink/50 hover:text-cosmic-ink">
          Sair
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display font-semibold text-lg text-cosmic-ink">Minhas Solicitações</h1>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-blue-opal text-white text-sm font-medium px-3.5 py-1.5 hover:bg-blue-opal/90 transition-colors"
          >
            + Nova solicitação
          </button>
        </div>

        {showForm && (
          <NewSolicitationForm
            partnerId={partner.id}
            cds={cds}
            clientLocations={clientLocations}
            onSubmit={(input) => {
              createSolicitation(input);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {solicitations.length === 0 ? (
          <p className="text-sm text-cosmic-ink/45 mt-4">Nenhuma solicitação enviada ainda.</p>
        ) : (
          <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60 mt-4">
            {[...solicitations].reverse().map((s) => {
              const origin = locations.find((l) => l.id === s.originId);
              const destination = locations.find((l) => l.id === s.destinationId);
              return (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-medium text-sm text-cosmic-ink">{s.id}</p>
                    <StatusTag status={s.status} />
                  </div>
                  <p className="text-xs text-cosmic-ink/55 mt-0.5">
                    {origin?.city} → {destination?.city} · {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Solicitada: "bg-rowdy-orange/15 text-rowdy-orange",
    "Em análise": "bg-blue-opal/10 text-blue-opal",
    "Convertida em Pedido": "bg-emerald-600/10 text-emerald-700",
    Recusada: "bg-cinnamon/15 text-cinnamon",
  };
  return <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${styles[status] ?? ""}`}>{status}</span>;
}

function NewSolicitationForm({
  partnerId,
  cds,
  clientLocations,
  onSubmit,
  onCancel,
}: {
  partnerId: string;
  cds: ReturnType<typeof useSimulation>["data"]["locations"];
  clientLocations: ReturnType<typeof useSimulation>["data"]["locations"];
  onSubmit: (input: NewSolicitationInput) => void;
  onCancel: () => void;
}) {
  const [operationType, setOperationType] = useState<"B2B" | "B2C">("B2C");
  const [requestedBy, setRequestedBy] = useState("");
  const [contact, setContact] = useState("");
  const [originId, setOriginId] = useState(cds[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState(todayIso());
  const [pickupWindowStart, setPickupWindowStart] = useState("08:00");
  const [pickupWindowEnd, setPickupWindowEnd] = useState("12:00");
  const [destinationId, setDestinationId] = useState(clientLocations[0]?.id ?? "");
  const [deliveryDate, setDeliveryDate] = useState(daysFromNowIso(2));
  const [destinationContactName, setDestinationContactName] = useState("");
  const [destinationContactPhone, setDestinationContactPhone] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [totalWeightKg, setTotalWeightKg] = useState(1);
  const [totalVolumeM3, setTotalVolumeM3] = useState<number | undefined>(undefined);
  const [characteristics, setCharacteristics] = useState<CargoCharacteristic[]>([]);
  const [nfeNumber, setNfeNumber] = useState("");
  const [romaneioNumber, setRomaneioNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleCharacteristic = (c: CargoCharacteristic) =>
    setCharacteristics((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originId || !destinationId) {
      setError("Selecione origem e destino.");
      return;
    }
    if (quantity <= 0 || totalWeightKg <= 0) {
      setError("Quantidade e peso precisam ser maiores que zero.");
      return;
    }
    if (new Date(deliveryDate) < new Date(pickupDate)) {
      setError("A data de entrega não pode ser anterior à coleta.");
      return;
    }
    onSubmit({
      partnerCompanyId: partnerId,
      requestedBy: requestedBy || undefined,
      contact: contact || undefined,
      operationType,
      originId,
      destinationId,
      pickupDate: new Date(pickupDate).toISOString(),
      pickupWindowStart,
      pickupWindowEnd,
      deliveryDate: new Date(deliveryDate).toISOString(),
      destinationContactName: destinationContactName || undefined,
      destinationContactPhone: destinationContactPhone || undefined,
      productDescription,
      quantity,
      totalWeightKg,
      totalVolumeM3,
      cargoCharacteristics: characteristics,
      nfeNumber: nfeNumber || undefined,
      romaneioNumber: romaneioNumber || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-cosmic-ink/10 bg-white/60 p-5 space-y-4 mb-4">
      <div>
        <p className="text-xs font-medium text-cosmic-ink/50 uppercase tracking-wider mb-2">Tipo de operação</p>
        <div className="flex gap-2">
          {(["B2B", "B2C"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setOperationType(t)}
              className={`rounded-md border text-sm font-medium px-4 py-2 ${
                operationType === t ? "border-blue-opal bg-blue-opal/10 text-blue-opal" : "border-cosmic-ink/15 text-cosmic-ink/60"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsável pela solicitação">
          <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className={selectClass} />
        </Field>
        <Field label="Contato">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={selectClass} />
        </Field>
      </div>

      <Field label="Local de retirada">
        <select value={originId} onChange={(e) => setOriginId(e.target.value)} className={selectClass}>
          {cds.length === 0 && <option value="">Nenhum local cadastrado pela operadora</option>}
          {cds.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {l.city}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Data de retirada">
          <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={selectClass} />
        </Field>
        <Field label="Janela — início">
          <input type="time" value={pickupWindowStart} onChange={(e) => setPickupWindowStart(e.target.value)} className={selectClass} />
        </Field>
        <Field label="Janela — fim">
          <input type="time" value={pickupWindowEnd} onChange={(e) => setPickupWindowEnd(e.target.value)} className={selectClass} />
        </Field>
      </div>

      <Field label="Destino">
        <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={selectClass}>
          {clientLocations.length === 0 && <option value="">Nenhum destino cadastrado pela operadora</option>}
          {clientLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {l.city}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Data prevista">
          <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={selectClass} />
        </Field>
        <Field label="Contato no destino">
          <input value={destinationContactName} onChange={(e) => setDestinationContactName(e.target.value)} className={selectClass} />
        </Field>
        <Field label="Telefone">
          <input value={destinationContactPhone} onChange={(e) => setDestinationContactPhone(e.target.value)} className={selectClass} />
        </Field>
      </div>

      <Field label="Produto / descrição da carga">
        <input required value={productDescription} onChange={(e) => setProductDescription(e.target.value)} className={selectClass} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Quantidade">
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={selectClass} />
        </Field>
        <Field label="Peso total (kg)">
          <input type="number" min={0.1} step={0.1} value={totalWeightKg} onChange={(e) => setTotalWeightKg(Number(e.target.value))} className={selectClass} />
        </Field>
        <Field label="Volume (m³)">
          <input
            type="number"
            min={0}
            step={0.1}
            value={totalVolumeM3 ?? ""}
            onChange={(e) => setTotalVolumeM3(e.target.value ? Number(e.target.value) : undefined)}
            className={selectClass}
            placeholder="Opcional"
          />
        </Field>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-1">Características</p>
        <div className="flex flex-wrap gap-2">
          {CARGO_CHARACTERISTICS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCharacteristic(c)}
              className={`rounded-full border text-xs font-medium px-3 py-1.5 ${
                characteristics.includes(c) ? "border-blue-opal bg-blue-opal/10 text-blue-opal" : "border-cosmic-ink/15 text-cosmic-ink/60"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Número da NF-e">
          <input value={nfeNumber} onChange={(e) => setNfeNumber(e.target.value)} className={selectClass} placeholder="Opcional" />
        </Field>
        <Field label="Número do romaneio">
          <input value={romaneioNumber} onChange={(e) => setRomaneioNumber(e.target.value)} className={selectClass} placeholder="Opcional" />
        </Field>
      </div>

      <Field label="Observações">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${selectClass} min-h-16`} />
      </Field>

      {error && <p className="text-sm text-cinnamon bg-cinnamon/8 border border-cinnamon/25 rounded-md px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2.5">
          Cancelar
        </button>
        <button type="submit" className="flex-1 rounded-md bg-blue-opal text-white text-sm font-medium py-2.5 hover:bg-blue-opal/90 transition-colors">
          Enviar Solicitação
        </button>
      </div>
    </form>
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
