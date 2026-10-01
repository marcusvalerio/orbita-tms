"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ellipsis, Route as RouteIcon } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useUrlParam } from "@/components/live/useUrlState";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DataTable, Drawer, EmptyState, FilterBar, IconButton, Menu, SearchInput, Status, TripProgress, type Column } from "@/components/ds";
import { TripPanel } from "@/components/patterns/TripPanel";
import { useTripActions } from "@/components/patterns/TripActions";
import { TRIP_FILTERS, parseTripFilter, type TripFilter } from "@/lib/ui/filters";
import { hhmm, stopFractions, windowLabel, type TripReading } from "@/lib/ui/trip";
import type { Shipment } from "@/lib/domain/types";

type ListFilter = TripFilter | "concluidas";

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ShipmentsWorkspace() {
  const { data } = useOperation();
  const live = useLive();
  const [filtroRaw, setFiltro] = useUrlParam("filtro");
  const [q, setQ] = useUrlParam("q");
  const [openId, setOpenId] = useState<string | null>(null);
  const filtro: ListFilter = filtroRaw === "concluidas" ? "concluidas" : parseTripFilter(filtroRaw);

  const all = useMemo(() => data.shipments.map((s) => live.trips.get(s.id)).filter((t): t is TripReading => !!t), [data.shipments, live.trips]);
  const active = all.filter((t) => t.health !== "done");
  const done = all.filter((t) => t.health === "done");
  const options = [
    ...TRIP_FILTERS.map((f) => ({ value: f.value as ListFilter, label: f.label, tone: f.tone, count: f.value === "todas" ? all.length : active.filter(f.test).length })),
    { value: "concluidas" as ListFilter, label: "Concluídas", tone: "success" as const, count: done.length },
  ].filter((o) => o.count > 0 || o.value === "todas" || o.value === filtro);

  const rows = useMemo(() => {
    let r = filtro === "todas" ? all : filtro === "concluidas" ? done : active.filter(TRIP_FILTERS.find((f) => f.value === filtro)!.test);
    if (q) {
      const words = norm(q).split(/\s+/).filter(Boolean);
      r = r.filter((t) => {
        const s = t.shipment;
        const v = data.vehicles.find((x) => x.id === s.vehicleId);
        const d = data.drivers.find((x) => x.id === s.driverId);
        const hay = norm([s.id, s.routeCode, v?.plate, d?.name, ...t.stops.map((st) => st.name)].filter(Boolean).join(" "));
        return words.every((w) => hay.includes(w));
      });
    }
    return r;
  }, [filtro, all, done, active, q, data.vehicles, data.drivers]);

  const columns: Column<TripReading>[] = [
    {
      id: "rota",
      header: "Rota",
      cell: (t) => <span className="orb-data font-medium">{t.shipment.routeCode ?? "—"}</span>,
      sortValue: (t) => t.shipment.routeCode ?? "",
    },
    {
      id: "viagem",
      header: "Viagem",
      cell: (t) => (
        <Link href={`/shipments/${t.shipment.id}`} onClick={(e) => e.stopPropagation()} className="orb-data text-fg underline-offset-2 hover:underline">
          {t.shipment.id}
        </Link>
      ),
      sortValue: (t) => t.shipment.id,
    },
    {
      id: "trecho",
      header: "Origem → destino",
      cell: (t) => {
        const o = data.locations.find((l) => l.id === t.shipment.originId);
        const d = data.locations.find((l) => l.id === t.shipment.destinationId);
        return (
          <span className="block max-w-56 truncate">
            {o?.city} → {d?.name}
          </span>
        );
      },
      hideBelow: "2xl",
    },
    {
      id: "recurso",
      header: "Veículo / transportadora",
      cell: (t) => {
        const v = data.vehicles.find((x) => x.id === t.shipment.vehicleId);
        return v ? <span className="orb-data">{v.plate}</span> : (data.carriers.find((c) => c.id === t.shipment.carrierId)?.name ?? "—");
      },
      hideBelow: "lg",
    },
    { id: "motorista", header: "Motorista", cell: (t) => data.drivers.find((d) => d.id === t.shipment.driverId)?.name ?? "—", hideBelow: "2xl" },
    {
      id: "progresso",
      header: "Paradas",
      cell: (t) => (
        <span className="flex items-center gap-2">
          <span className="w-24">
            <TripProgress compact progress={t.progress} label={`Progresso ${t.shipment.id}`} stops={t.stops.slice(1).map((s) => ({ at: stopFractions(t.shipment)[s.index], state: s.state === "issue" ? "issue" : s.state, title: s.name }))} />
          </span>
          <span className="tabular text-caption text-fg-muted">
            {t.doneStops}/{t.stops.length}
          </span>
        </span>
      ),
      sortValue: (t) => t.progress,
    },
    {
      id: "eta",
      header: "Próxima · ETA × janela",
      cell: (t) => {
        const n = t.stops.find((s) => s.state !== "done" && s.index > 0);
        if (!n) return <span className="text-fg-subtle">—</span>;
        return (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-48 truncate text-fg">{n.name}</span>
            <span className="orb-data text-caption">
              <span className={n.delayMin > 0 ? "font-semibold text-danger-fg" : "text-fg-muted"}>{hhmm(n.eta)}</span>
              <span className="text-fg-subtle"> / {windowLabel(n) ?? "sem janela"}</span>
            </span>
          </span>
        );
      },
      sortValue: (t) => t.stops.find((s) => s.state !== "done" && s.index > 0)?.eta ?? "~",
    },
    {
      id: "atraso",
      header: "Atraso",
      align: "right",
      cell: (t) => (t.maxDelayMin > 0 ? <span className="orb-data font-semibold text-danger-fg">+{t.maxDelayMin} min</span> : <span className="text-fg-subtle">—</span>),
      sortValue: (t) => t.maxDelayMin,
    },
    { id: "situacao", header: "Situação", cell: (t) => <Status entity="shipment" value={t.shipment.status} size="sm" />, sortValue: (t) => t.shipment.status },
  ];

  const openTrip = data.shipments.find((s) => s.id === openId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Viagens"
        meta={
          <span className="tabular">
            {active.length} ativas · {all.filter((t) => t.health === "late" || t.maxDelayMin > 0).length} com atraso projetado · {done.length} concluídas
          </span>
        }
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <FilterBar label="Situação" value={filtro} onChange={(v: ListFilter) => setFiltro(v === "todas" ? null : v)} options={options} className="min-w-0 flex-1" />
          <SearchInput label="Buscar viagem" value={q ?? ""} onChange={(v) => setQ(v || null)} placeholder="Viagem, rota, placa, motorista, parada" className="md:w-72" />
        </div>
      </WorkspaceHeader>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Viagens"
          rows={rows}
          rowKey={(t) => t.shipment.id}
          columns={columns}
          activeKey={openId}
          onRowClick={(t) => setOpenId(t.shipment.id)}
          defaultSort={{ id: "atraso", dir: "desc" }}
          className="h-full"
          rowActions={(t) => <RowActions shipment={t.shipment} onOpen={() => setOpenId(t.shipment.id)} />}
          empty={
            <EmptyState
              icon={<RouteIcon />}
              title={all.length === 0 ? "Nenhuma viagem ainda." : "Nenhuma viagem neste filtro."}
              description={all.length === 0 ? "Viagens nascem no planejamento, quando uma carga é contratada." : "Ajuste o filtro ou a busca."}
            />
          }
          card={(t) => {
            const n = t.stops.find((s) => s.state !== "done" && s.index > 0);
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="orb-data text-body-sm font-medium text-fg">{t.shipment.routeCode ?? t.shipment.id}</span>
                  <Status entity="shipment" value={t.shipment.status} size="sm" />
                </div>
                <p className="text-caption text-fg-muted">
                  <span className="orb-data">{t.shipment.id}</span> · {t.doneStops}/{t.stops.length} paradas
                  {n && (
                    <>
                      {" "}
                      · próx. {n.name} <span className="orb-data">{hhmm(n.eta)}</span>
                    </>
                  )}
                  {t.maxDelayMin > 0 && <span className="font-semibold text-danger-fg"> · +{t.maxDelayMin} min</span>}
                </p>
              </div>
            );
          }}
        />
      </div>
      <Drawer
        open={!!openTrip}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={<span className="orb-data">{openTrip?.routeCode ?? openTrip?.id}</span>}
        status={openTrip ? <Status entity="shipment" value={openTrip.status} size="sm" /> : null}
        subtitle={
          openTrip ? (
            <Link href={`/shipments/${openTrip.id}`} className="orb-data underline underline-offset-2">
              Abrir {openTrip.id}
            </Link>
          ) : null
        }
      >
        {openTrip && <TripPanel shipmentId={openTrip.id} showHeader={false} />}
      </Drawer>
    </div>
  );
}

function RowActions({ shipment, onOpen }: { shipment: Shipment; onOpen: () => void }) {
  const { actions, dialogs } = useTripActions(shipment);
  return (
    <>
      <Menu
        label={`Ações de ${shipment.routeCode ?? shipment.id}`}
        trigger={<IconButton size="sm" label="Ações da viagem" icon={<Ellipsis className="size-4" />} />}
        items={[{ label: "Abrir painel", onSelect: onOpen }, ...actions.map((a) => ({ label: a.label, icon: a.icon, onSelect: a.run }))]}
      />
      {dialogs}
    </>
  );
}
