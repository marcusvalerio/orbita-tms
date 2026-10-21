"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Map as MapIcon, Route as RouteIcon, Truck } from "lucide-react";
import type { Vehicle } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DataTable, Drawer, EmptyState, FilterBar, KeyValue, MetricGrid, SearchInput, Status, TripProgress, type Column } from "@/components/ds";
import { ResourceActions, ResourceTrips, type ResourceAction } from "@/components/patterns/ResourceTrips";
import { STATUS } from "@/lib/ui/status";
import { hhmm, stopFractions } from "@/lib/ui/trip";

// Frota: estado operacional de cada veículo — onde está, em qual viagem,
// com quem, a que velocidade e o que vem a seguir. Lista ↔ painel.

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function FleetWorkspace() {
  const { data } = useOperation();
  const live = useLive();
  const [filtro, setFiltro] = useUrlParam("filtro");
  const [q, setQ] = useUrlParam("q");
  const [veiculo, setVeiculo] = useUrlParam("veiculo");
  const open = data.vehicles.find((v) => v.id === veiculo) ?? null;
  useBreadcrumb(open ? `${open.id} · ${open.plate}` : null);

  const currentTrip = (v: Vehicle) => data.shipments.find((s) => s.vehicleId === v.id && s.status !== "Delivered" && s.status !== "Closed");
  const rows = useMemo(() => {
    let list = data.vehicles;
    if (filtro) list = list.filter((v) => v.status === filtro);
    if (q) {
      const w = norm(q).split(/\s+/).filter(Boolean);
      list = list.filter((v) => w.every((x) => norm(`${v.id} ${v.plate} ${v.type} ${v.ownership}`).includes(x)));
    }
    return list;
  }, [data.vehicles, filtro, q]);

  const options = [
    { value: "", label: "Todos", tone: "all" as const, count: data.vehicles.length },
    ...Object.keys(STATUS.vehicle).map((s) => ({ value: s, label: STATUS.vehicle[s].label, tone: STATUS.vehicle[s].tone, count: data.vehicles.filter((v) => v.status === s).length })),
  ];

  const columns: Column<Vehicle>[] = [
    { id: "id", header: "Veículo", cell: (v) => <span className="orb-data font-medium">{v.id}</span>, sortValue: (v) => v.id },
    { id: "placa", header: "Placa", cell: (v) => v.plate, mono: true, sortValue: (v) => v.plate },
    { id: "tipo", header: "Tipo", cell: (v) => v.type, sortValue: (v) => v.type, hideBelow: "md" },
    { id: "capacidade", header: "Capacidade", align: "right", cell: (v) => `${v.capacityKg.toLocaleString("pt-BR")} kg`, mono: true, sortValue: (v) => v.capacityKg, hideBelow: "lg" },
    { id: "status", header: "Situação", cell: (v) => <Status entity="vehicle" value={v.status} size="sm" />, sortValue: (v) => v.status },
    {
      id: "viagem",
      header: "Viagem atual",
      cell: (v) => {
        const s = currentTrip(v);
        return s ? (
          <Link href={`/shipments/${s.id}`} onClick={(e) => e.stopPropagation()} className="orb-data hover:underline">
            {s.routeCode ?? s.id}
          </Link>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      },
    },
    { id: "motorista", header: "Motorista", cell: (v) => data.drivers.find((d) => d.id === currentTrip(v)?.driverId)?.name ?? "—", hideBelow: "xl" },
    {
      id: "vel",
      header: "Velocidade",
      align: "right",
      cell: (v) => {
        const s = currentTrip(v);
        const p = s ? live.positions.get(s.id) : undefined;
        return p ? <span className="orb-data">{p.speedKmh} km/h</span> : <span className="text-fg-subtle">—</span>;
      },
      hideBelow: "lg",
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader title="Frota" meta={<span className="tabular">{data.vehicles.length} veículos · {data.vehicles.filter((v) => v.status === "Em Viagem").length} em viagem · {data.vehicles.filter((v) => v.status === "Manutenção").length} em manutenção</span>}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <FilterBar label="Situação do veículo" value={filtro ?? ""} onChange={(v) => setFiltro(v || null)} options={options} className="min-w-0 flex-1" />
          <SearchInput label="Buscar veículo" value={q ?? ""} onChange={(v) => setQ(v || null)} placeholder="ID, placa, tipo" className="md:w-60" />
        </div>
      </WorkspaceHeader>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Veículos"
          rows={rows}
          rowKey={(v) => v.id}
          columns={columns}
          activeKey={veiculo}
          onRowClick={(v) => setVeiculo(v.id)}
          className="h-full"
          empty={<EmptyState icon={<Truck />} title={data.vehicles.length ? "Nenhum veículo neste filtro." : "Nenhum veículo cadastrado."} />}
          card={(v) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm text-fg">
                  <span className="orb-data font-medium">{v.plate}</span> <span className="text-fg-muted">· {v.type}</span>
                </p>
                <p className="truncate text-caption text-fg-muted">
                  <span className="orb-data">{v.id}</span>
                  {currentTrip(v) && <> · {currentTrip(v)!.routeCode}</>}
                </p>
              </div>
              <Status entity="vehicle" value={v.status} size="sm" />
            </div>
          )}
        />
      </div>
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setVeiculo(null)}
        title={<span className="orb-data">{open?.plate}</span>}
        status={open ? <Status entity="vehicle" value={open.status} size="sm" /> : null}
        subtitle={open ? `${open.id} · ${open.type} · ${open.ownership}` : null}
        footer={open ? <VehicleActions vehicle={open} /> : null}
      >
        {open && <VehicleDetail vehicle={open} />}
      </Drawer>
    </div>
  );
}

function VehicleDetail({ vehicle }: { vehicle: Vehicle }) {
  const { data } = useOperation();
  const live = useLive();
  const trips = data.shipments.filter((s) => s.vehicleId === vehicle.id);
  const current = trips.find((s) => s.status !== "Delivered" && s.status !== "Closed");
  const reading = current ? live.trips.get(current.id) : undefined;
  const driver = data.drivers.find((d) => d.id === current?.driverId);
  const load = current ? data.loads.find((l) => l.id === current.loadId) : undefined;
  const next = reading?.stops.find((s) => s.state !== "done" && s.index > 0);
  return (
    <div className="space-y-5 px-5 py-4">
      <dl className="grid grid-cols-3 gap-3">
        <KeyValue label="Capacidade" value={`${vehicle.capacityKg.toLocaleString("pt-BR")} kg`} mono />
        <KeyValue label="Volume" value={`${vehicle.capacityM3} m³`} mono />
        <KeyValue label="Propriedade" value={vehicle.ownership} />
      </dl>
      {current && reading ? (
        <section aria-label="Operação atual" className="space-y-3 rounded-md border border-line-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/shipments/${current.id}`} className="orb-data text-h3 text-fg hover:underline">
              {current.routeCode ?? current.id}
            </Link>
            <Status entity="shipment" value={current.status} size="sm" />
          </div>
          <MetricGrid
            items={[
              { label: "Velocidade", value: reading.speedKmh != null ? `${reading.speedKmh} km/h` : "—", mono: true },
              { label: "Motorista", value: driver?.name ?? "—" },
              { label: "Próxima parada", value: next?.name ?? "—", hint: next?.eta ? `ETA ${hhmm(next.eta)}` : undefined },
              { label: "Ocupação", value: load ? `${Math.round((load.totalWeightKg / vehicle.capacityKg) * 100)}%` : "—", mono: true },
            ]}
          />
          <TripProgress label={`Progresso de ${current.routeCode ?? current.id}`} progress={reading.progress} stops={reading.stops.slice(1).map((s) => ({ at: stopFractions(current)[s.index], state: s.state === "issue" ? "issue" : s.state, title: s.name }))} />
        </section>
      ) : (
        <p className="rounded-md border border-line-subtle bg-canvas px-3 py-2 text-body-sm text-fg-muted">{vehicle.status === "Manutenção" ? "Em manutenção — indisponível para contratação." : "Sem viagem em andamento — disponível para o planejamento."}</p>
      )}
      <ResourceTrips trips={trips} />
    </div>
  );
}

function VehicleActions({ vehicle }: { vehicle: Vehicle }) {
  const { data } = useOperation();
  const current = data.shipments.find((s) => s.vehicleId === vehicle.id && s.status !== "Delivered" && s.status !== "Closed");
  const actions: ResourceAction[] = current
    ? [
        { id: "trip", label: "Abrir viagem", icon: <RouteIcon />, href: `/shipments/${current.id}`, primary: true },
        { id: "map", label: "Ver no mapa", icon: <MapIcon />, href: `/mapa?viagem=${current.id}` },
      ]
    : vehicle.status === "Disponível"
      ? [{ id: "plan", label: "Ir para o planejamento", icon: <RouteIcon />, href: "/planning", primary: true }]
      : [];
  return <ResourceActions actions={actions} />;
}
