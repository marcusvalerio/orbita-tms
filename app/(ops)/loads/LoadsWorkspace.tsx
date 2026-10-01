"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, ClipboardList, Route as RouteIcon } from "lucide-react";
import { LOAD_STATUSES, type Load } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, DataTable, Drawer, EmptyState, FilterBar, MetricGrid, Status, type Column } from "@/components/ds";
import { TenderPanel, tenderExtras, useTenderOptions, type TenderChoice } from "@/components/patterns/TenderPanel";
import { findVehicleForWeight } from "@/lib/planning/quote";
import { statusSpec } from "@/lib/ui/status";

// Cargas: o que já foi consolidado. A contratação (antes uma página solta)
// acontece no contexto da carga — custo, transportadora, veículo, motorista.

export function LoadsWorkspace() {
  const { data } = useOperation();
  const [filtroRaw, setFiltro] = useUrlParam("filtro");
  const [carga, setCarga] = useUrlParam("carga");
  const filtro = filtroRaw === "aguardando" ? "Aguardando transporte" : filtroRaw;
  const rows = useMemo(() => [...data.loads].filter((l) => !filtro || l.status === filtro).sort((a, b) => (a.status === "Aguardando transporte" ? -1 : 0) - (b.status === "Aguardando transporte" ? -1 : 0) || b.id.localeCompare(a.id)), [data.loads, filtro]);
  const open = data.loads.find((l) => l.id === carga) ?? null;
  useBreadcrumb(open?.id ?? null);
  const loc = (id: string) => data.locations.find((l) => l.id === id);

  const options = [
    { value: "", label: "Todas", tone: "all" as const, count: data.loads.length },
    ...LOAD_STATUSES.map((s) => ({ value: s === "Aguardando transporte" ? "aguardando" : s, label: statusSpec("load", s).label, tone: statusSpec("load", s).tone, count: data.loads.filter((l) => l.status === s).length })).filter((o) => o.count > 0 || o.value === filtroRaw),
  ];

  const columns: Column<Load>[] = [
    { id: "id", header: "Carga", cell: (l) => <span className="orb-data font-medium">{l.id}</span>, sortValue: (l) => l.id },
    { id: "trecho", header: "Origem → destino", cell: (l) => `${loc(l.originId)?.city} → ${loc(l.destinationId)?.city}` },
    { id: "pedidos", header: "Pedidos", align: "right", cell: (l) => l.orderIds.length, sortValue: (l) => l.orderIds.length, hideBelow: "md" },
    { id: "peso", header: "Peso", align: "right", cell: (l) => `${l.totalWeightKg.toLocaleString("pt-BR")} kg`, mono: true, sortValue: (l) => l.totalWeightKg },
    { id: "volume", header: "Volume", align: "right", cell: (l) => `${l.totalVolumeM3.toLocaleString("pt-BR")} m³`, mono: true, hideBelow: "lg" },
    { id: "situacao", header: "Situação", cell: (l) => <Status entity="load" value={l.status} size="sm" /> },
    {
      id: "viagem",
      header: "Viagem",
      cell: (l) =>
        l.shipmentId ? (
          <Link href={`/shipments/${l.shipmentId}`} onClick={(e) => e.stopPropagation()} className="orb-data hover:underline">
            {data.shipments.find((s) => s.id === l.shipmentId)?.routeCode ?? l.shipmentId}
          </Link>
        ) : l.status === "Aguardando transporte" ? (
          <span className="text-body-sm font-medium text-warning-fg">Contratar →</span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader title="Cargas" meta={<span className="tabular">{data.loads.length} cargas · {data.loads.filter((l) => l.status === "Aguardando transporte").length} aguardando contratação</span>}>
        <FilterBar label="Situação da carga" value={filtroRaw ?? ""} onChange={(v) => setFiltro(v || null)} options={options} />
      </WorkspaceHeader>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Cargas"
          rows={rows}
          rowKey={(l) => l.id}
          columns={columns}
          activeKey={carga}
          onRowClick={(l) => setCarga(l.id)}
          className="h-full"
          empty={
            <EmptyState
              icon={<Boxes />}
              title={data.loads.length ? "Nenhuma carga neste filtro." : "Nenhuma carga formada ainda."}
              description="Cargas nascem no planejamento, ao consolidar pedidos."
              action={
                <Button asChild>
                  <Link href="/planning">Ir para o planejamento</Link>
                </Button>
              }
            />
          }
          card={(l) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="orb-data text-body-sm font-medium text-fg">{l.id}</p>
                <p className="truncate text-caption text-fg-muted">
                  {loc(l.originId)?.city} → {loc(l.destinationId)?.city} · {l.totalWeightKg.toLocaleString("pt-BR")} kg
                </p>
              </div>
              <Status entity="load" value={l.status} size="sm" />
            </div>
          )}
        />
      </div>
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setCarga(null)}
        width="560px"
        title={<span className="orb-data">{open?.id}</span>}
        status={open ? <Status entity="load" value={open.status} size="sm" /> : null}
        subtitle={open ? `${loc(open.originId)?.name} → ${loc(open.destinationId)?.name}` : null}
      >
        {open && <LoadDetail load={open} onDone={() => setCarga(null)} />}
      </Drawer>
    </div>
  );
}

function LoadDetail({ load, onDone }: { load: Load; onDone: () => void }) {
  const { data, can, createShipment } = useOperation();
  const router = useRouter();
  const options = useTenderOptions(load.totalWeightKg);
  const tender = data.tenders.find((t) => t.loadId === load.id);
  const [choice, setChoice] = useState<TenderChoice>({ optionId: options[0]?.id ?? null });
  const [busy, setBusy] = useState(false);
  const orders = data.orders.filter((o) => load.orderIds.includes(o.id));
  const vehicle = findVehicleForWeight(data.vehicles, load.totalWeightKg);
  const pending = load.status === "Aguardando transporte";

  const confirm = async () => {
    const option = options.find((o) => o.id === choice.optionId);
    if (!option || busy) return;
    setBusy(true);
    const outcome = await createShipment(load.id, option, tenderExtras(choice, option));
    setBusy(false);
    if (!outcome.ok) return;
    const shipment = outcome.data.shipments.find((s) => s.loadId === load.id);
    onDone();
    if (shipment) router.push(`/shipments/${shipment.id}`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 px-5 py-4">
        <MetricGrid
          columns={4}
          items={[
            { label: "Pedidos", value: load.orderIds.length },
            { label: "Peso", value: `${load.totalWeightKg.toLocaleString("pt-BR")} kg`, mono: true },
            { label: "Volume", value: `${load.totalVolumeM3.toLocaleString("pt-BR")} m³`, mono: true },
            { label: "Veículo sugerido", value: vehicle ? vehicle.type : "—", hint: vehicle ? `${Math.round((load.totalWeightKg / vehicle.capacityKg) * 100)}% de ocupação` : "Nenhum comporta" },
          ]}
        />
        <section aria-label="Pedidos da carga">
          <p className="mb-2 text-h3 text-fg">Pedidos</p>
          <ul className="divide-y divide-line-subtle rounded-md border border-line-subtle">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm">
                <Link href={`/orders?pedido=${o.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                  <ClipboardList className="size-3.5 text-fg-muted" aria-hidden />
                  <span className="orb-data text-fg">{o.id}</span>
                  <span className="truncate text-fg-muted">{data.locations.find((l) => l.id === o.destinationId)?.name}</span>
                </Link>
                <span className="orb-data shrink-0 text-caption text-fg-muted">{o.totalWeightKg.toLocaleString("pt-BR")} kg</span>
              </li>
            ))}
          </ul>
        </section>

        {pending ? (
          <section aria-label="Contratação" className="space-y-3">
            <div>
              <p className="text-h2 text-fg">Contratação</p>
              <p className="text-caption text-fg-muted">Compare custo, prazo e confiabilidade. {tender ? `${tender.options.length} cotações registradas.` : "Cotações simuladas a partir da tabela de cada transportadora."}</p>
            </div>
            <TenderPanel weightKg={load.totalWeightKg} value={choice} onChange={setChoice} options={options} />
          </section>
        ) : load.shipmentId ? (
          <Button variant="primary" asChild>
            <Link href={`/shipments/${load.shipmentId}`}>
              <RouteIcon className="size-4" aria-hidden /> Ver viagem <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      {pending && can("shipments:contract") && (
        <div className="sticky bottom-0 mt-auto flex items-center gap-3 border-t border-line-subtle bg-surface px-5 py-3">
          <span className="text-body-sm text-fg-muted">
            {options.find((o) => o.id === choice.optionId)?.label ?? "Escolha uma opção"}
            {choice.optionId && (
              <span className="orb-data ml-2 font-semibold text-fg">{options.find((o) => o.id === choice.optionId)?.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            )}
          </span>
          <Button variant="primary" className="ml-auto" loading={busy} disabled={!choice.optionId} onClick={confirm}>
            Confirmar contratação
          </Button>
        </div>
      )}
    </div>
  );
}
