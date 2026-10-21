"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClipboardList, FileCheck2, Map as MapIcon, PackageCheck, Route as RouteIcon } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, DataTable, Drawer, EmptyState, FilterBar, HeatStrip, KeyValue, MetricGrid, SearchInput, Status, type Column } from "@/components/ds";
import { useTripActions } from "@/components/patterns/TripActions";
import { deliveryQueue, fmtSlack, DELIVERY_STATUS_KEY, type DeliveryRow, type DeliveryState } from "@/lib/ui/deliveries";
import { horizon } from "@/lib/ui/horizon";
import { hhmm } from "@/lib/ui/trip";
import { cn } from "@/lib/ui/cn";

// Entregas: a fila do dia por horário. Janela × ETA, cliente, pedidos e o
// que já foi entregue (resultado, POD). O horário é a âncora de cada linha.

type Filtro = "todas" | "a-caminho" | "risco" | "atrasadas" | "concluidas" | "nao-realizadas";
const FILTERS: { value: Filtro; label: string; tone: "all" | "info" | "warning" | "danger" | "success"; test: (r: DeliveryRow) => boolean }[] = [
  { value: "todas", label: "Todas", tone: "all", test: () => true },
  { value: "a-caminho", label: "A caminho", tone: "info", test: (r) => r.state === "a-caminho" || r.state === "programada" },
  { value: "risco", label: "Em risco", tone: "warning", test: (r) => r.state === "em-risco" },
  { value: "atrasadas", label: "Atrasadas", tone: "danger", test: (r) => r.state === "atrasada" },
  { value: "concluidas", label: "Concluídas", tone: "success", test: (r) => r.state === "entregue" || r.state === "atendida" || r.state === "parcial" },
  { value: "nao-realizadas", label: "Não realizadas", tone: "danger", test: (r) => r.state === "nao-realizada" || r.state === "devolvida" },
];
const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function DeliveriesWorkspace() {
  const { data } = useOperation();
  const live = useLive();
  const [filtroRaw, setFiltro] = useUrlParam("filtro");
  const [q, setQ] = useUrlParam("q");
  const [sel, setSel] = useUrlParam("entrega");
  const filtro = (FILTERS.find((f) => f.value === filtroRaw)?.value ?? "todas") as Filtro;

  const all = useMemo(() => deliveryQueue(data, live.trips), [data, live.trips]);
  const rows = useMemo(() => {
    let r = all.filter(FILTERS.find((f) => f.value === filtro)!.test);
    if (q) {
      const w = norm(q).split(/\s+/).filter(Boolean);
      r = r.filter((x) => w.every((t) => norm(`${x.locationName} ${x.city} ${x.customerName} ${x.routeCode} ${x.orderIds.join(" ")}`).includes(t)));
    }
    return r;
  }, [all, filtro, q]);
  const h = useMemo(() => horizon(live.trips.values(), live.nowMs), [live.trips, live.nowMs]);
  const open = all.find((r) => r.key === sel) ?? null;
  useBreadcrumb(open ? open.locationName : null);

  const columns: Column<DeliveryRow>[] = [
    {
      id: "hora",
      header: "Horário",
      cell: (r) => (
        <span className="flex flex-col leading-tight">
          <span className={cn("orb-data text-body font-semibold", r.state === "atrasada" ? "text-danger-fg" : r.state === "em-risco" ? "text-warning-fg" : "text-fg")}>{hhmm(r.time)}</span>
          <span className="text-caption text-fg-subtle">{!r.time ? (r.state === "atendida" ? "atendida" : "") : r.state === "entregue" || r.state === "atendida" || r.state === "parcial" || r.state === "nao-realizada" || r.state === "devolvida" ? "real" : "ETA"}</span>
        </span>
      ),
      sortValue: (r) => r.time ?? "~",
      width: "84px",
    },
    {
      id: "destino",
      header: "Destino · cliente",
      cell: (r) => (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="max-w-64 truncate text-fg">{r.locationName}</span>
          <span className="max-w-64 truncate text-caption text-fg-muted">{r.customerName}</span>
        </span>
      ),
      sortValue: (r) => r.locationName,
    },
    { id: "janela", header: "Janela", cell: (r) => (r.windowStart && r.windowEnd ? `${hhmm(r.windowStart)}–${hhmm(r.windowEnd)}` : "—"), mono: true, hideBelow: "md" },
    {
      id: "folga",
      header: "ETA × janela",
      align: "right",
      cell: (r) =>
        r.delayMin > 0 ? (
          <span className="orb-data font-semibold text-danger-fg">+{r.delayMin} min</span>
        ) : r.slackMin !== null && r.state !== "atendida" ? (
          <span className={cn("orb-data", r.state === "em-risco" ? "text-warning-fg" : "text-fg-muted")}>{fmtSlack(r.slackMin)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
      sortValue: (r) => r.delayMin * 1000 - (r.slackMin ?? 0),
      hideBelow: "lg",
    },
    { id: "rota", header: "Rota", cell: (r) => r.routeCode, mono: true, hideBelow: "xl" },
    { id: "pedidos", header: "Pedidos", cell: (r) => r.orderIds.join(", ") || "—", mono: true, hideBelow: "2xl" },
    { id: "situacao", header: "Situação", cell: (r) => <Status entity="delivery" value={DELIVERY_STATUS_KEY[r.state]} size="sm" /> },
  ];

  const options = FILTERS.map((f) => ({ value: f.value, label: f.label, tone: f.tone, count: all.filter(f.test).length })).filter((o) => o.count > 0 || o.value === "todas" || o.value === filtro);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Entregas"
        meta={
          <span className="tabular">
            {all.filter((r) => r.state === "a-caminho" || r.state === "programada" || r.state === "em-risco" || r.state === "atrasada").length} pendentes · {all.filter((r) => r.state === "atrasada").length} atrasadas ·{" "}
            {all.filter((r) => r.state === "entregue" || r.state === "atendida").length} concluídas
          </span>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] lg:items-end">
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
            <FilterBar label="Situação da entrega" value={filtro} onChange={(v: Filtro) => setFiltro(v === "todas" ? null : v)} options={options} className="min-w-0 flex-1" />
            <SearchInput label="Buscar entrega" value={q ?? ""} onChange={(v) => setQ(v || null)} placeholder="Destino, cliente, pedido" className="md:w-56" />
          </div>
          <div className="rounded-md border border-line-subtle bg-surface px-3 py-2">
            <p className="mb-1 text-caption text-fg-muted">
              Próximas 6 h · <span className={cn("tabular", h.late > 0 && "font-semibold text-danger-fg")}>{h.late} atrasada(s)</span> · <span className={cn("tabular", h.risk > 0 && "font-semibold text-warning-fg")}>{h.risk} em risco</span> · <span className="tabular">{h.ok} no prazo</span>
            </p>
            <HeatStrip label="Entregas por hora de chegada prevista" buckets={h.buckets} />
          </div>
        </div>
      </WorkspaceHeader>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Entregas"
          rows={rows}
          rowKey={(r) => r.key}
          columns={columns}
          activeKey={sel}
          onRowClick={(r) => setSel(r.key)}
          className="h-full"
          density="comfortable"
          empty={<EmptyState icon={<PackageCheck />} title={all.length ? "Nenhuma entrega neste filtro." : "Nenhuma entrega programada."} description="Entregas aparecem quando uma viagem é planejada." />}
          card={(r) => (
            <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3">
              <span className={cn("orb-data text-body font-semibold", r.state === "atrasada" ? "text-danger-fg" : "text-fg")}>{hhmm(r.time)}</span>
              <span className="min-w-0">
                <span className="block truncate text-body-sm text-fg">{r.locationName}</span>
                <span className="block truncate text-caption text-fg-muted">
                  {r.customerName}
                  {r.delayMin > 0 && <span className="font-semibold text-danger-fg"> · +{r.delayMin} min</span>}
                </span>
              </span>
              <Status entity="delivery" value={DELIVERY_STATUS_KEY[r.state]} size="sm" />
            </div>
          )}
        />
      </div>
      <Drawer open={!!open} onOpenChange={(o) => !o && setSel(null)} title={open?.locationName} subtitle={open ? `${open.customerName}${open.city ? ` · ${open.city}` : ""}` : null} status={open ? <Status entity="delivery" value={DELIVERY_STATUS_KEY[open.state]} size="sm" /> : null} footer={open ? <DeliveryActions row={open} /> : null}>
        {open && <DeliveryDetail row={open} />}
      </Drawer>
    </div>
  );
}

const DONE: DeliveryState[] = ["entregue", "atendida", "parcial", "nao-realizada", "devolvida"];

function DeliveryDetail({ row }: { row: DeliveryRow }) {
  const { data } = useOperation();
  const live = useLive();
  const trip = live.trips.get(row.shipmentId);
  const done = DONE.includes(row.state);
  return (
    <div className="space-y-5 px-5 py-4">
      <MetricGrid
        items={[
          { label: done ? "Horário real" : "ETA", value: hhmm(row.time), mono: true, tone: row.state === "atrasada" ? "danger" : row.state === "em-risco" ? "warning" : undefined },
          { label: "Janela", value: row.windowStart && row.windowEnd ? `${hhmm(row.windowStart)}–${hhmm(row.windowEnd)}` : "—", mono: true },
          { label: "Atraso", value: row.delayMin > 0 ? `+${row.delayMin} min` : "—", mono: true, tone: row.delayMin > 0 ? "danger" : undefined },
          { label: "Folga", value: row.slackMin !== null && !done ? fmtSlack(row.slackMin).replace("folga ", "") : "—", mono: true },
        ]}
      />
      {row.state === "atrasada" && (
        <p className="rounded-md border border-danger-line bg-danger-subtle px-3 py-2 text-body-sm text-danger-fg">
          ETA {hhmm(row.time)} excede a janela em {row.delayMin} min. Avise o cliente ou registre a ocorrência de atraso.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <KeyValue label="Rota" value={<Link href={`/shipments/${row.shipmentId}`} className="orb-data hover:underline">{row.routeCode}</Link>} />
        <KeyValue label="Parada" value={row.stopIndex !== null && trip ? `${row.stopIndex} de ${trip.stops.length - 1}` : "—"} />
        <KeyValue
          label="Pedidos"
          value={
            <span className="flex flex-wrap gap-1.5">
              {row.orderIds.map((id) => (
                <Link key={id} href={`/orders?pedido=${id}`} className="orb-data inline-flex items-center gap-1 hover:underline">
                  <ClipboardList className="size-3 text-fg-muted" aria-hidden />
                  {id}
                </Link>
              ))}
            </span>
          }
          className="col-span-2"
        />
        {row.podDocumentId && <KeyValue label="Comprovante (POD)" value={<span className="flex items-center gap-1.5"><FileCheck2 className="size-3.5 text-success" aria-hidden /><span className="orb-data">{row.podDocumentId}</span> <span className="text-caption text-fg-muted">(simulado)</span></span>} className="col-span-2" />}
        {(() => {
          const contact = data.orders.find((o) => row.orderIds.includes(o.id) && o.destinationContactName);
          return contact ? <KeyValue label="Contato no destino" value={`${contact.destinationContactName}${contact.destinationContactPhone ? ` · ${contact.destinationContactPhone}` : ""}`} className="col-span-2" /> : null;
        })()}
      </dl>
    </div>
  );
}

function DeliveryActions({ row }: { row: DeliveryRow }) {
  const { data } = useOperation();
  const shipment = data.shipments.find((s) => s.id === row.shipmentId) ?? null;
  const { actions, dialogs } = useTripActions(shipment);
  const report = actions.find((a) => a.id === "report");
  return (
    <>
      <Button variant="primary" asChild>
        <Link href={`/shipments/${row.shipmentId}`}>
          <RouteIcon className="size-4" aria-hidden /> Abrir viagem
        </Link>
      </Button>
      <Button asChild>
        <Link href={`/mapa?viagem=${row.shipmentId}`}>
          <MapIcon className="size-4" aria-hidden /> Ver no mapa
        </Link>
      </Button>
      {report && (row.state === "atrasada" || row.state === "em-risco") && (
        <Button onClick={report.run} icon={<span className="[&_svg]:size-4">{report.icon}</span>}>
          Registrar ocorrência
        </Button>
      )}
      {dialogs}
    </>
  );
}
