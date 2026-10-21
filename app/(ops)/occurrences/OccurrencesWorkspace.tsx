"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Ellipsis, Map as MapIcon, Route as RouteIcon, ShieldCheck, Siren } from "lucide-react";
import { OCCURRENCE_ACTIONS, type Occurrence, type OccurrenceAction } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, DataTable, Drawer, EmptyState, FilterBar, IconButton, KeyValue, Menu, Status, Timeline, type Column } from "@/components/ds";
import { OperationalMap } from "@/components/map/OperationalMap";
import { SUGGESTED_ACTION } from "@/lib/ui/deliveries";
import { hhmm } from "@/lib/ui/trip";
import { cn } from "@/lib/ui/cn";

// Ocorrências: fila acionável. Severidade e tempo em aberto ordenam; cada
// linha traz a ação sugerida (regra fixa por tipo) para resolver em 1 clique,
// e o painel mostra o contexto (viagem, parada, mapa) antes de decidir.

type Filtro = "abertas" | "criticas" | "resolvidas" | "todas";
const SEV = { Crítica: 0, Média: 1, Baixa: 2 } as const;

export function OccurrencesWorkspace() {
  const { data } = useOperation();
  const live = useLive();
  const [filtroRaw, setFiltro] = useUrlParam("filtro");
  const [sel, setSel] = useUrlParam("ocorrencia");
  const filtro: Filtro = filtroRaw === "criticas" || filtroRaw === "resolvidas" || filtroRaw === "todas" ? filtroRaw : "abertas";
  const nowMs = live.nowMs; // relógio da operação (simulado no Modo Demo)
  const minutesOpen = (o: Occurrence) => Math.max(0, Math.round(((o.resolvedAt ? new Date(o.resolvedAt).getTime() : nowMs) - new Date(o.reportedAt).getTime()) / 60000));

  const rows = useMemo(() => {
    const f = { abertas: (o: Occurrence) => !o.resolved, criticas: (o: Occurrence) => !o.resolved && o.severity === "Crítica", resolvidas: (o: Occurrence) => o.resolved, todas: () => true }[filtro];
    return data.occurrences.filter(f).sort((a, b) => Number(a.resolved) - Number(b.resolved) || SEV[a.severity] - SEV[b.severity] || a.reportedAt.localeCompare(b.reportedAt));
  }, [data.occurrences, filtro]);
  const open = data.occurrences.find((o) => o.id === sel) ?? null;
  useBreadcrumb(open?.id ?? null);

  const options = [
    { value: "abertas" as Filtro, label: "Em aberto", tone: "exception" as const, count: data.occurrences.filter((o) => !o.resolved).length },
    { value: "criticas" as Filtro, label: "Críticas", tone: "critical" as const, count: data.occurrences.filter((o) => !o.resolved && o.severity === "Crítica").length },
    { value: "resolvidas" as Filtro, label: "Resolvidas", tone: "success" as const, count: data.occurrences.filter((o) => o.resolved).length },
    { value: "todas" as Filtro, label: "Todas", tone: "all" as const, count: data.occurrences.length },
  ];

  const columns: Column<Occurrence>[] = [
    { id: "sev", header: "Severidade", cell: (o) => <Status entity="severity" value={o.severity} size="sm" />, sortValue: (o) => SEV[o.severity], width: "120px" },
    {
      id: "tipo",
      header: "Ocorrência",
      cell: (o) => (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-fg">{o.type}</span>
          <span className="max-w-72 truncate text-caption text-fg-muted">{o.description}</span>
        </span>
      ),
      sortValue: (o) => o.type,
    },
    {
      id: "viagem",
      header: "Viagem",
      cell: (o) => {
        const s = data.shipments.find((x) => x.id === o.shipmentId);
        return (
          <Link href={`/shipments/${o.shipmentId}`} onClick={(e) => e.stopPropagation()} className="orb-data hover:underline">
            {s?.routeCode ?? o.shipmentId}
          </Link>
        );
      },
      hideBelow: "md",
    },
    {
      id: "aberta",
      header: "Tempo",
      align: "right",
      cell: (o) => <span className={cn("orb-data", !o.resolved && minutesOpen(o) > 60 && "font-semibold text-danger-fg")}>{o.resolved ? `resolvida em ${minutesOpen(o)} min` : `há ${minutesOpen(o)} min`}</span>,
      sortValue: (o) => minutesOpen(o),
      hideBelow: "lg",
    },
    { id: "status", header: "Situação", cell: (o) => <Status entity="occurrence" value={o.resolved ? "resolved" : "open"} size="sm" variant="inline" />, hideBelow: "xl" },
    {
      id: "acao",
      header: "Ação",
      cell: (o) => (o.resolved ? <span className="text-body-sm text-fg-muted">{o.action}</span> : <QuickResolve occurrence={o} />),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Ocorrências"
        meta={
          <span className="tabular">
            {data.occurrences.filter((o) => !o.resolved).length} em aberto · {data.occurrences.filter((o) => !o.resolved && o.severity === "Crítica").length} crítica(s) · {data.occurrences.filter((o) => o.resolved).length} resolvidas
          </span>
        }
      >
        <FilterBar label="Ocorrências" value={filtro} onChange={(v: Filtro) => setFiltro(v === "abertas" ? null : v)} options={options} />
      </WorkspaceHeader>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Ocorrências"
          rows={rows}
          rowKey={(o) => o.id}
          columns={columns}
          activeKey={sel}
          onRowClick={(o) => setSel(o.id)}
          className="h-full"
          density="comfortable"
          empty={<EmptyState icon={<ShieldCheck />} title={filtro === "abertas" || filtro === "criticas" ? "Nenhuma ocorrência em aberto." : "Nenhuma ocorrência aqui."} description="Ocorrências registradas nas viagens aparecem nesta fila." />}
          card={(o) => (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-sm font-medium text-fg">{o.type}</span>
                <Status entity="severity" value={o.severity} size="sm" />
              </div>
              <p className="text-caption text-fg-muted">
                <span className="orb-data">{data.shipments.find((s) => s.id === o.shipmentId)?.routeCode ?? o.shipmentId}</span> · {o.resolved ? `resolvida · ${o.action}` : `há ${minutesOpen(o)} min · sugestão: ${SUGGESTED_ACTION[o.type]}`}
              </p>
            </div>
          )}
        />
      </div>
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setSel(null)}
        title={open?.type}
        subtitle={open ? <span className="orb-data">{open.id}</span> : null}
        status={open ? <Status entity="severity" value={open.severity} size="sm" /> : null}
        width="480px"
      >
        {open && <OccurrenceDetail occurrence={open} minutes={minutesOpen(open)} />}
      </Drawer>
    </div>
  );
}

function QuickResolve({ occurrence }: { occurrence: Occurrence }) {
  const { can, resolveOccurrence } = useOperation();
  if (!can("occurrences:resolve")) return <span className="text-caption text-fg-muted">Sugestão: {SUGGESTED_ACTION[occurrence.type]}</span>;
  const suggested = SUGGESTED_ACTION[occurrence.type];
  return (
    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="primary" icon={<ShieldCheck className="size-3.5" aria-hidden />} onClick={() => resolveOccurrence(occurrence.id, suggested)} title="Ação sugerida para este tipo de ocorrência">
        {suggested}
      </Button>
      <Menu
        label={`Outras resoluções para ${occurrence.id}`}
        trigger={<IconButton size="sm" label="Outras resoluções" icon={<Ellipsis className="size-4" />} />}
        items={OCCURRENCE_ACTIONS.filter((a) => a !== suggested).map((a) => ({ label: a, onSelect: () => void resolveOccurrence(occurrence.id, a) }))}
      />
    </span>
  );
}

function OccurrenceDetail({ occurrence, minutes }: { occurrence: Occurrence; minutes: number }) {
  const { data, can, resolveOccurrence } = useOperation();
  const live = useLive();
  const shipment = data.shipments.find((s) => s.id === occurrence.shipmentId);
  const trip = shipment ? live.trips.get(shipment.id) : undefined;
  const stop = trip?.stops.find((s) => s.state === "issue") ?? trip?.stops.find((s) => s.state !== "done" && s.index > 0);
  const vehicle = data.vehicles.find((v) => v.id === shipment?.vehicleId);
  const driver = data.drivers.find((d) => d.id === shipment?.driverId);
  const onMap = shipment && live.shipments.some((s) => s.id === shipment.id);
  const suggested = SUGGESTED_ACTION[occurrence.type];
  const resolve = (a: OccurrenceAction) => void resolveOccurrence(occurrence.id, a);

  return (
    <div className="space-y-5 px-5 py-4">
      <p className="text-body text-fg">{occurrence.description}</p>

      {!occurrence.resolved && can("occurrences:resolve") && (
        <section aria-label="Resolver" className="space-y-2 rounded-md border border-exception-line bg-exception-subtle p-3">
          <p className="text-h3 text-exception-fg">Resolver agora</p>
          <p className="text-caption text-fg-muted">Sugestão para “{occurrence.type}”: {suggested} (regra fixa por tipo).</p>
          <div className="grid grid-cols-2 gap-2">
            {OCCURRENCE_ACTIONS.map((a) => (
              <Button key={a} variant={a === suggested ? "primary" : "secondary"} onClick={() => resolve(a)}>
                {a}
              </Button>
            ))}
          </div>
        </section>
      )}

      {onMap && shipment && (
        <div className="overflow-hidden rounded-md border border-line-subtle">
          <OperationalMap only={shipment.id} selectedId={shipment.id} onSelect={() => {}} selectedStop={stop?.index ?? null} className="h-52" label={`Mapa da viagem ${shipment.routeCode ?? shipment.id}`} />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <KeyValue label="Viagem" value={shipment ? <Link href={`/shipments/${shipment.id}`} className="orb-data hover:underline">{shipment.routeCode ?? shipment.id}</Link> : occurrence.shipmentId} />
        <KeyValue label="Parada afetada" value={stop ? `${stop.index} · ${stop.name}` : "—"} />
        <KeyValue label="Veículo" value={vehicle ? `${vehicle.id} · ${vehicle.plate}` : "Da transportadora"} mono={!!vehicle} />
        <KeyValue label="Motorista" value={driver?.name ?? "—"} />
        <KeyValue label={occurrence.resolved ? "Tempo até resolver" : "Em aberto há"} value={`${minutes} min`} mono />
        <KeyValue label="Situação" value={<Status entity="occurrence" value={occurrence.resolved ? "resolved" : "open"} size="sm" variant="inline" />} />
      </dl>

      <section aria-label="Histórico">
        <p className="mb-2 text-h3 text-fg">Histórico</p>
        <Timeline
          label="Histórico da ocorrência"
          items={[
            { id: "reg", title: "Registrada", meta: occurrence.description, state: "issue", time: hhmm(occurrence.reportedAt), marker: <Siren className="size-3" /> },
            ...(occurrence.resolved && occurrence.resolvedAt ? [{ id: "res", title: `Resolvida — ${occurrence.action}`, state: "done" as const, time: hhmm(occurrence.resolvedAt), marker: <ShieldCheck className="size-3" /> }] : []),
          ]}
        />
      </section>

      {shipment && (
        <div className="flex flex-wrap gap-2 border-t border-line-subtle pt-4">
          <Button asChild>
            <Link href={`/shipments/${shipment.id}`}>
              <RouteIcon className="size-4" aria-hidden /> Abrir viagem
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/mapa?viagem=${shipment.id}`}>
              <MapIcon className="size-4" aria-hidden /> Ver no mapa
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
