"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronUp, ClipboardList, CircleCheck, Database, Plus, Truck } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useUrlParam } from "@/components/live/useUrlState";
import { useShell } from "@/components/shell/ShellContext";
import { Button, DataTable, Drawer, EmptyState, FilterBar, HeatStrip, SegmentedControl, Status, TripProgress, type Column } from "@/components/ds";
import { OperationalMap } from "@/components/map/OperationalMap";
import { SimulationBar } from "@/components/map/SimulationBar";
import { AttentionCard } from "@/components/patterns/AttentionCard";
import { TripPanel } from "@/components/patterns/TripPanel";
import { getOverviewMetrics, getPlanningQueue } from "@/lib/data/atlas";
import { filterTrips, parseTripFilter, tripFilterOptions, type TripFilter } from "@/lib/ui/filters";
import { horizon } from "@/lib/ui/horizon";
import { hhmm, stopFractions, windowLabel, type TripReading } from "@/lib/ui/trip";
import { cn } from "@/lib/ui/cn";

// COMMAND CENTER — o mapa é o espaço operacional.
//   Pulso (faixa) → mapa como canvas → "Agora" (fila por Attention Score)
//   → horizonte das próximas 6 h / viagens em execução → painel da viagem.
// Filtro e seleção na URL e compartilhados por mapa, fila e tabela.

type MobileView = "agora" | "mapa" | "execucao";

export function CommandCenter() {
  const { isEmpty, loadDemoScenario, can } = useOperation();
  const live = useLive();
  const { setNewOrderOpen } = useShell();
  const [viagem, setViagem] = useUrlParam("viagem");
  const [filtroRaw, setFiltro] = useUrlParam("filtro");
  const filtro = parseTripFilter(filtroRaw);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [mobile, setMobile] = useState<MobileView>("agora");
  const [stop, setStop] = useState<number | null>(null);

  const activeTrips = useMemo(() => live.shipments.map((s) => live.trips.get(s.id)).filter((t): t is TripReading => !!t), [live.shipments, live.trips]);
  const visibleTrips = useMemo(() => filterTrips(activeTrips, filtro), [activeTrips, filtro]);
  const visibleIds = useMemo(() => new Set(visibleTrips.map((t) => t.shipment.id)), [visibleTrips]);
  const focusIds = filtro === "todas" ? null : visibleIds;
  const queue = useMemo(() => live.attention.filter((i) => filtro === "todas" || visibleIds.has(i.shipmentId)), [live.attention, filtro, visibleIds]);
  const selectedId = viagem && live.shipments.some((s) => s.id === viagem) ? viagem : null;
  const h = useMemo(() => horizon(visibleTrips, live.nowMs), [visibleTrips, live.nowMs]);

  const select = (id: string | null) => {
    setStop(null);
    live.prioritize(id);
    setViagem(id === selectedId ? null : id);
  };
  const open = (id: string) => {
    if (id !== selectedId) {
      live.prioritize(id);
      setViagem(id);
    }
    setPanelOpen(true);
  };

  if (isEmpty) {
    return (
      <div className="grid flex-1 place-items-center px-4">
        <EmptyState
          icon={<Truck />}
          title="Nenhuma operação em andamento."
          description="Comece criando o primeiro pedido — ele entra na fila de planejamento. Ou carregue o cenário de demonstração para ver o Command Center em operação."
          action={
            <>
              {can("orders:create") && (
                <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setNewOrderOpen(true)}>
                  Novo pedido
                </Button>
              )}
              {loadDemoScenario && (
                <Button icon={<Database className="size-4" aria-hidden />} onClick={loadDemoScenario}>
                  Carregar cenário de demonstração
                </Button>
              )}
            </>
          }
        />
      </div>
    );
  }

  const bottomH = bottomOpen ? "min(46%,340px)" : "76px";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Pulse activeTrips={activeTrips} onFilter={(f) => setFiltro(f === "todas" ? null : f)} />

      {/* Mobile: Agora primeiro; mapa e execução em abas */}
      <div className="border-b border-line-subtle bg-surface px-4 py-2 lg:hidden">
        <SegmentedControl
          label="Visão"
          value={mobile}
          onChange={setMobile}
          className="w-full"
          options={[
            { value: "agora", label: "Agora", count: queue.length },
            { value: "mapa", label: "Mapa" },
            { value: "execucao", label: "Execução", count: visibleTrips.length },
          ]}
        />
      </div>

      <div className="relative min-h-0 flex-1" style={{ ["--cc-bottom" as string]: bottomH }}>
        {/* Mapa (canvas) */}
        <div className={cn("absolute inset-0 lg:bottom-(--cc-bottom) lg:right-[360px] min-[1440px]:bottom-0 min-[1440px]:right-0", mobile !== "mapa" && "max-lg:hidden")}>
          <OperationalMap
            selectedId={selectedId}
            onSelect={(id) => select(id)}
            selectedStop={stop}
            onStopSelect={(_, i) => setStop(i)}
            focusIds={focusIds}
            className="h-full"
            label="Mapa do Command Center"
            controlsPosition="left"
          >
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start gap-2 min-[1440px]:right-[404px]">
              <div className="pointer-events-auto max-w-full rounded-md border border-line-subtle bg-surface/95 p-1 shadow-2 backdrop-blur-sm">
                <FilterBar label="Situação das viagens" value={filtro} onChange={(v: TripFilter) => setFiltro(v === "todas" ? null : v)} options={tripFilterOptions(activeTrips).filter((o) => o.count > 0 || o.value === "todas" || o.value === filtro)} />
              </div>
              <SimulationBar resetId={selectedId} compact className="pointer-events-auto ml-auto" />
            </div>
          </OperationalMap>
        </div>

        {/* Agora */}
        <section
          aria-labelledby="agora-title"
          className={cn(
            "absolute inset-0 flex flex-col bg-canvas lg:inset-auto lg:bottom-0 lg:right-0 lg:top-0 lg:w-[360px] lg:border-l lg:border-line-subtle",
            "min-[1440px]:bottom-3 min-[1440px]:right-3 min-[1440px]:top-3 min-[1440px]:w-[380px] min-[1440px]:rounded-lg min-[1440px]:border min-[1440px]:shadow-2",
            mobile !== "agora" && "max-lg:hidden"
          )}
        >
          <header className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
            <h2 id="agora-title" className="text-h2 text-fg">
              Agora
            </h2>
            <span className="tabular text-body-sm text-fg-muted">{queue.length}</span>
            <span className="ml-auto text-caption text-fg-subtle" title="Índice determinístico: soma de regras sobre ETA × janela, ocorrências, saída e prioridade. Não é previsão.">
              por Attention Score
            </span>
          </header>
          <div className="orb-scroll min-h-0 flex-1 overflow-y-auto p-3">
            {queue.length === 0 ? (
              <EmptyState
                compact
                icon={<CircleCheck />}
                title="Nada pedindo atenção agora."
                description={live.clock?.playing ? "Todas as viagens dentro da janela." : "Todas as viagens dentro da janela. Inicie a simulação para acompanhar os ETAs ao vivo."}
              />
            ) : (
              <ul className="orb-stagger space-y-2" aria-live="polite">
                {queue.map((item) => (
                  <li key={item.key} className="orb-enter">
                    <AttentionCard item={item} selected={item.shipmentId === selectedId} onSelect={() => select(item.shipmentId)} onOpen={() => open(item.shipmentId)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <PlanningFooter />
        </section>

        {/* Horizonte + execução */}
        <section
          aria-label="Próximas horas e viagens em execução"
          className={cn(
            "absolute inset-0 flex flex-col bg-surface lg:inset-auto lg:bottom-0 lg:left-0 lg:right-[360px] lg:h-(--cc-bottom) lg:border-t lg:border-line-subtle",
            "transition-[height] duration-(--orb-duration-slow) ease-standard",
            "min-[1440px]:bottom-3 min-[1440px]:left-3 min-[1440px]:right-[404px] min-[1440px]:rounded-lg min-[1440px]:border min-[1440px]:shadow-2",
            mobile !== "execucao" && "max-lg:hidden"
          )}
        >
          <div className="flex shrink-0 items-center gap-4 px-4 py-2.5">
            <div className="min-w-0 shrink-0">
              <p className="text-h3 text-fg">Próximas 6 h</p>
              <p className="text-caption text-fg-muted">
                <span className={cn("tabular", h.late > 0 && "font-semibold text-danger-fg")}>{h.late} atrasada(s)</span> · <span className={cn("tabular", h.risk > 0 && "font-semibold text-warning-fg")}>{h.risk} em risco</span> ·{" "}
                <span className="tabular">{h.ok} no prazo</span>
              </p>
            </div>
            <div className="hidden min-w-0 flex-1 sm:block">
              <HeatStrip label="Paradas por hora de chegada prevista nas próximas 6 horas" buckets={h.buckets} />
            </div>
            <Button
              size="sm"
              className="ml-auto max-lg:hidden"
              aria-expanded={bottomOpen}
              trailing={<ChevronUp className={cn("size-4 transition-transform duration-(--orb-duration-base)", !bottomOpen && "rotate-180")} aria-hidden />}
              onClick={() => setBottomOpen((o) => !o)}
            >
              Em execução <span className="tabular text-fg-muted">{visibleTrips.length}</span>
            </Button>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-hidden border-t border-line-subtle", !bottomOpen && "lg:hidden")}>
            <ExecutionTable trips={visibleTrips} selectedId={selectedId} onSelect={(id) => select(id)} onOpen={open} />
          </div>
        </section>
      </div>

      <Drawer
        open={panelOpen && !!selectedId}
        onOpenChange={setPanelOpen}
        title={<span className="orb-data">{live.shipments.find((s) => s.id === selectedId)?.routeCode ?? selectedId}</span>}
        status={selectedId ? <Status entity="shipment" value={live.shipments.find((s) => s.id === selectedId)?.status ?? "Planned"} size="sm" /> : null}
        subtitle={selectedId ? <Link href={`/shipments/${selectedId}`} className="orb-data underline underline-offset-2">{selectedId}</Link> : null}
      >
        {selectedId && <TripPanel shipmentId={selectedId} showHeader={false} selectedStop={stop} onStopSelect={setStop} />}
      </Drawer>
    </div>
  );
}

/* ------------------------------------------------------------------ Pulso */

function Pulse({ activeTrips, onFilter }: { activeTrips: TripReading[]; onFilter: (f: TripFilter) => void }) {
  const { data } = useOperation();
  const live = useLive();
  const metrics = getOverviewMetrics(data);
  const { ordersAwaiting, loadsAwaitingCarrier } = getPlanningQueue(data);
  const stops = activeTrips.flatMap((t) => t.stops.filter((s) => s.index > 0));
  const done = stops.filter((s) => s.state === "done").length;
  const atRisk = activeTrips.filter((t) => t.health === "risk" || t.health === "late").length;
  const openOcc = data.occurrences.filter((o) => !o.resolved).length;
  const fleetBusy = data.vehicles.filter((v) => v.status === "Em Viagem").length;

  return (
    <div className="orb-scroll flex shrink-0 items-stretch overflow-x-auto border-b border-line-subtle bg-surface">
      <PulseItem label="Em rota" value={live.trackedIds.length} sub={`de ${activeTrips.length} viagens ativas`} onClick={() => onFilter("em-rota")} />
      <PulseItem label="Paradas atendidas" value={`${done}/${stops.length}`} sub="viagens ativas" />
      <PulseItem
        label="OTIF"
        value={metrics.otifPercent === null ? "—" : `${metrics.otifPercent.toLocaleString("pt-BR")}%`}
        sub="meta 95%"
        tone={metrics.otifPercent !== null && metrics.otifPercent < 95 ? "warning" : undefined}
        title="Entregas completas dentro da janela ÷ entregas encerradas"
      />
      <PulseItem label="Em risco ou atrasadas" value={atRisk} tone={atRisk ? "danger" : undefined} onClick={() => onFilter(atRisk ? "atrasadas" : "em-risco")} />
      <PulseItem label="Ocorrências abertas" value={openOcc} tone={openOcc ? "exception" : undefined} href="/occurrences?filtro=abertas" />
      <PulseItem label="Frota em viagem" value={`${fleetBusy}/${data.vehicles.length}`} sub="veículos próprios" href="/fleet" />
      <PulseItem label="Fila de planejamento" value={ordersAwaiting.length} sub={loadsAwaitingCarrier.length ? `+ ${loadsAwaitingCarrier.length} carga(s) sem contratação` : "pedidos aguardando"} href="/planning" />
    </div>
  );
}

function PulseItem({
  label,
  value,
  sub,
  tone,
  onClick,
  href,
  title,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "danger" | "warning" | "exception";
  onClick?: () => void;
  href?: string;
  title?: string;
}) {
  const body = (
    <>
      <span className="block whitespace-nowrap text-caption text-fg-muted">{label}</span>
      <span className={cn("block font-display text-h1 tabular", tone === "danger" ? "text-danger-fg" : tone === "warning" ? "text-warning-fg" : tone === "exception" ? "text-exception-fg" : "text-fg")}>{value}</span>
      {sub && <span className="block whitespace-nowrap text-caption text-fg-subtle">{sub}</span>}
    </>
  );
  const cls = "orb-focus-inset min-w-36 shrink-0 border-r border-line-subtle px-4 py-2.5 text-left transition-colors last:border-r-0";
  if (href)
    return (
      <Link href={href} title={title} className={cn(cls, "hover:bg-surface-hover")}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" title={title} onClick={onClick} className={cn(cls, "hover:bg-surface-hover")}>
        {body}
      </button>
    );
  return (
    <div title={title} className={cls}>
      {body}
    </div>
  );
}

function PlanningFooter() {
  const { data } = useOperation();
  const { ordersAwaiting, loadsAwaitingCarrier } = getPlanningQueue(data);
  if (!ordersAwaiting.length && !loadsAwaitingCarrier.length) return null;
  return (
    <div className="flex items-center gap-2 border-t border-line-subtle px-4 py-2.5 text-body-sm">
      <ClipboardList className="size-4 text-fg-muted" aria-hidden />
      <span className="text-fg-muted">
        Planejamento: <span className="tabular text-fg">{ordersAwaiting.length}</span> pedido(s)
        {loadsAwaitingCarrier.length > 0 && (
          <>
            {" "}
            · <span className="tabular text-fg">{loadsAwaitingCarrier.length}</span> carga(s) sem contratação
          </>
        )}
      </span>
      <Link href={loadsAwaitingCarrier.length ? "/loads?filtro=aguardando" : "/planning"} className="ml-auto font-medium text-fg underline underline-offset-2 hover:no-underline">
        Planejar
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ Execução */

function ExecutionTable({ trips, selectedId, onSelect, onOpen }: { trips: TripReading[]; selectedId: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  const { data } = useOperation();
  const columns: Column<TripReading>[] = [
    { id: "rota", header: "Rota", cell: (t) => <span className="orb-data font-medium">{t.shipment.routeCode ?? t.shipment.id}</span>, sortValue: (t) => t.shipment.routeCode ?? t.shipment.id },
    { id: "placa", header: "Veículo", cell: (t) => data.vehicles.find((v) => v.id === t.shipment.vehicleId)?.plate ?? data.carriers.find((c) => c.id === t.shipment.carrierId)?.name ?? "—", mono: true, hideBelow: "xl" },
    { id: "motorista", header: "Motorista", cell: (t) => data.drivers.find((d) => d.id === t.shipment.driverId)?.name ?? "—", hideBelow: "xl" },
    {
      id: "progresso",
      header: "Progresso",
      cell: (t) => (
        <div className="w-28">
          <TripProgress compact progress={t.progress} label={`Progresso ${t.shipment.id}`} stops={t.stops.slice(1).map((s) => ({ at: stopFractions(t.shipment)[s.index], state: s.state === "issue" ? "issue" : s.state, title: s.name }))} />
        </div>
      ),
      sortValue: (t) => t.progress,
    },
    {
      id: "proxima",
      header: "Próxima parada",
      cell: (t) => {
        const n = t.stops.find((s) => s.state !== "done" && s.index > 0);
        return n ? <span className="block max-w-44 truncate">{n.name}</span> : "—";
      },
      hideBelow: "lg",
    },
    {
      id: "eta",
      header: "ETA × janela",
      cell: (t) => {
        const n = t.stops.find((s) => s.state !== "done" && s.index > 0);
        return n ? (
          <span className="orb-data">
            <span className={n.delayMin > 0 ? "font-semibold text-danger-fg" : ""}>{hhmm(n.eta)}</span>
            <span className="text-fg-subtle"> / {windowLabel(n) ?? "—"}</span>
          </span>
        ) : (
          "—"
        );
      },
      sortValue: (t) => t.stops.find((s) => s.state !== "done" && s.index > 0)?.eta ?? "",
    },
    { id: "atraso", header: "Atraso", align: "right", cell: (t) => (t.maxDelayMin > 0 ? <span className="orb-data font-semibold text-danger-fg">+{t.maxDelayMin} min</span> : <span className="text-fg-subtle">—</span>), sortValue: (t) => t.maxDelayMin },
    { id: "situacao", header: "Situação", cell: (t) => <Status entity="shipment" value={t.shipment.status} size="sm" variant="inline" /> },
  ];
  return (
    <DataTable
      label="Viagens em execução"
      rows={trips}
      rowKey={(t) => t.shipment.id}
      columns={columns}
      activeKey={selectedId}
      onRowClick={(t) => (t.shipment.id === selectedId ? onOpen(t.shipment.id) : onSelect(t.shipment.id))}
      defaultSort={{ id: "atraso", dir: "desc" }}
      className="h-full"
      empty={<EmptyState compact title="Nenhuma viagem neste filtro." />}
      card={(t) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="orb-data text-body-sm font-medium text-fg">{t.shipment.routeCode ?? t.shipment.id}</p>
            <p className="truncate text-caption text-fg-muted">
              {t.doneStops}/{t.stops.length} paradas{t.maxDelayMin > 0 ? ` · +${t.maxDelayMin} min` : ""}
            </p>
          </div>
          <Status entity="shipment" value={t.shipment.status} size="sm" />
        </div>
      )}
    />
  );
}
