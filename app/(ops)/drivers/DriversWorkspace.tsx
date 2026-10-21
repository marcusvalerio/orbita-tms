"use client";

import Link from "next/link";
import { useMemo } from "react";
import { IdCard, Map as MapIcon, Route as RouteIcon } from "lucide-react";
import type { Driver } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DataTable, Drawer, EmptyState, FilterBar, KeyValue, MetricGrid, SearchInput, Status, type Column } from "@/components/ds";
import { ResourceActions, ResourceTrips, type ResourceAction } from "@/components/patterns/ResourceTrips";
import { STATUS } from "@/lib/ui/status";
import { hhmm } from "@/lib/ui/trip";

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function DriversWorkspace() {
  const { data } = useOperation();
  const live = useLive();
  const [filtro, setFiltro] = useUrlParam("filtro");
  const [q, setQ] = useUrlParam("q");
  const [motorista, setMotorista] = useUrlParam("motorista");
  const open = data.drivers.find((d) => d.id === motorista) ?? null;
  useBreadcrumb(open?.name ?? null);

  const current = (d: Driver) => data.shipments.find((s) => s.driverId === d.id && s.status !== "Delivered" && s.status !== "Closed");
  const rows = useMemo(() => {
    let list = data.drivers;
    if (filtro) list = list.filter((d) => d.status === filtro);
    if (q) {
      const w = norm(q).split(/\s+/).filter(Boolean);
      list = list.filter((d) => w.every((x) => norm(`${d.name} ${d.id} ${d.cnhCategory}`).includes(x)));
    }
    return list;
  }, [data.drivers, filtro, q]);

  const options = [
    { value: "", label: "Todos", tone: "all" as const, count: data.drivers.length },
    ...Object.keys(STATUS.driver).map((s) => ({ value: s, label: STATUS.driver[s].label, tone: STATUS.driver[s].tone, count: data.drivers.filter((d) => d.status === s).length })),
  ];

  const columns: Column<Driver>[] = [
    { id: "nome", header: "Motorista", cell: (d) => <span className="font-medium">{d.name}</span>, sortValue: (d) => d.name },
    { id: "cnh", header: "CNH", cell: (d) => d.cnhCategory, mono: true, sortValue: (d) => d.cnhCategory },
    { id: "status", header: "Situação", cell: (d) => <Status entity="driver" value={d.status} size="sm" />, sortValue: (d) => d.status },
    {
      id: "viagem",
      header: "Viagem atual",
      cell: (d) => {
        const s = current(d);
        return s ? (
          <Link href={`/shipments/${s.id}`} onClick={(e) => e.stopPropagation()} className="orb-data hover:underline">
            {s.routeCode ?? s.id}
          </Link>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      },
    },
    { id: "veiculo", header: "Veículo", cell: (d) => data.vehicles.find((v) => v.id === current(d)?.vehicleId)?.plate ?? "—", mono: true, hideBelow: "md" },
    { id: "viagens", header: "Viagens", align: "right", cell: (d) => data.shipments.filter((s) => s.driverId === d.id).length, sortValue: (d) => data.shipments.filter((s) => s.driverId === d.id).length, hideBelow: "lg" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader title="Motoristas" meta={<span className="tabular">{data.drivers.length} motoristas · {data.drivers.filter((d) => d.status === "Em Viagem").length} em viagem · {data.drivers.filter((d) => d.status === "Disponível").length} disponíveis</span>}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <FilterBar label="Situação do motorista" value={filtro ?? ""} onChange={(v) => setFiltro(v || null)} options={options} className="min-w-0 flex-1" />
          <SearchInput label="Buscar motorista" value={q ?? ""} onChange={(v) => setQ(v || null)} placeholder="Nome, CNH" className="md:w-60" />
        </div>
      </WorkspaceHeader>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Motoristas"
          rows={rows}
          rowKey={(d) => d.id}
          columns={columns}
          activeKey={motorista}
          onRowClick={(d) => setMotorista(d.id)}
          className="h-full"
          empty={<EmptyState icon={<IdCard />} title={data.drivers.length ? "Nenhum motorista neste filtro." : "Nenhum motorista cadastrado."} />}
          card={(d) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-fg">{d.name}</p>
                <p className="truncate text-caption text-fg-muted">
                  CNH <span className="orb-data">{d.cnhCategory}</span>
                  {current(d) && <> · {current(d)!.routeCode}</>}
                </p>
              </div>
              <Status entity="driver" value={d.status} size="sm" />
            </div>
          )}
        />
      </div>
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setMotorista(null)}
        title={open?.name}
        status={open ? <Status entity="driver" value={open.status} size="sm" /> : null}
        subtitle={open ? <span>CNH <span className="orb-data">{open.cnhCategory}</span></span> : null}
        footer={open ? <DriverActions driver={open} /> : null}
      >
        {open && (
          <div className="space-y-5 px-5 py-4">
            {(() => {
              const s = current(open);
              const reading = s ? live.trips.get(s.id) : undefined;
              const next = reading?.stops.find((x) => x.state !== "done" && x.index > 0);
              const vehicle = data.vehicles.find((v) => v.id === s?.vehicleId);
              return s && reading ? (
                <MetricGrid
                  items={[
                    { label: "Viagem", value: <Link href={`/shipments/${s.id}`} className="orb-data hover:underline">{s.routeCode ?? s.id}</Link> },
                    { label: "Veículo", value: vehicle ? `${vehicle.plate}` : "—", mono: true },
                    { label: "Próxima parada", value: next?.name ?? "—", hint: next?.eta ? `ETA ${hhmm(next.eta)}` : undefined },
                    { label: "Atraso projetado", value: reading.maxDelayMin > 0 ? `+${reading.maxDelayMin} min` : "No prazo", tone: reading.maxDelayMin > 0 ? "danger" : "success" },
                  ]}
                />
              ) : (
                <p className="rounded-md border border-line-subtle bg-canvas px-3 py-2 text-body-sm text-fg-muted">{open.status === "Folga" ? "De folga — indisponível para contratação." : "Sem viagem em andamento — disponível para o planejamento."}</p>
              );
            })()}
            <dl className="grid grid-cols-2 gap-3">
              <KeyValue label="Identificador" value={open.id} mono />
              <KeyValue label="Categoria CNH" value={open.cnhCategory} mono />
            </dl>
            <ResourceTrips trips={data.shipments.filter((s) => s.driverId === open.id)} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

function DriverActions({ driver }: { driver: Driver }) {
  const { data } = useOperation();
  const s = data.shipments.find((x) => x.driverId === driver.id && x.status !== "Delivered" && x.status !== "Closed");
  const actions: ResourceAction[] = s
    ? [
        { id: "trip", label: "Abrir viagem", icon: <RouteIcon />, href: `/shipments/${s.id}`, primary: true },
        { id: "map", label: "Ver no mapa", icon: <MapIcon />, href: `/mapa?viagem=${s.id}` },
      ]
    : [];
  return <ResourceActions actions={actions} />;
}
