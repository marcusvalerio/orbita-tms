"use client";

import { useMemo } from "react";
import { Boxes, Building } from "lucide-react";
import type { Carrier } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { DataTable, Drawer, EmptyState, KeyValue, MetricGrid, Progress, SearchInput, type Column } from "@/components/ds";
import { ResourceActions, ResourceTrips } from "@/components/patterns/ResourceTrips";
import { cn } from "@/lib/ui/cn";

// Transportadoras: desempenho (SLA, OTIF, ocorrências, custo) e o que está
// contratado com cada uma. Usado para decidir contratação com informação.

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function CarriersWorkspace() {
  const { data } = useOperation();
  const [q, setQ] = useUrlParam("q");
  const [sel, setSel] = useUrlParam("transportadora");
  const open = data.carriers.find((c) => c.id === sel) ?? null;
  useBreadcrumb(open?.name ?? null);
  const rows = useMemo(() => (q ? data.carriers.filter((c) => norm(`${c.name} ${c.regions.join(" ")} ${c.cargoTypes.join(" ")}`).includes(norm(q))) : data.carriers), [data.carriers, q]);
  const tripsOf = (c: Carrier) => data.shipments.filter((s) => s.carrierId === c.id);

  const columns: Column<Carrier>[] = [
    { id: "nome", header: "Transportadora", cell: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
    { id: "regioes", header: "Regiões", cell: (c) => c.regions.join(", "), hideBelow: "lg" },
    {
      id: "sla",
      header: "SLA",
      align: "right",
      cell: (c) => <span className={cn("orb-data", c.slaPercent < 90 && "text-warning-fg")}>{pct(c.slaPercent)}</span>,
      sortValue: (c) => c.slaPercent,
    },
    { id: "otif", header: "OTIF", align: "right", cell: (c) => <span className={cn("orb-data", c.otifPercent < 90 && "text-warning-fg")}>{pct(c.otifPercent)}</span>, sortValue: (c) => c.otifPercent },
    { id: "ocorr", header: "Ocorrências", align: "right", cell: (c) => <span className={cn("orb-data", c.occurrenceRate > 0.05 && "font-semibold text-danger-fg")}>{pct(c.occurrenceRate * 100)}</span>, sortValue: (c) => c.occurrenceRate },
    { id: "custo", header: "Custo/km", align: "right", cell: (c) => c.avgCostPerKm.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), mono: true, sortValue: (c) => c.avgCostPerKm, hideBelow: "md" },
    { id: "viagens", header: "Viagens", align: "right", cell: (c) => tripsOf(c).length, sortValue: (c) => tripsOf(c).length },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader title="Transportadoras" meta={<span className="tabular">{data.carriers.length} transportadoras · {data.shipments.filter((s) => s.carrierId && s.status !== "Delivered" && s.status !== "Closed").length} viagem(ns) terceirizada(s) em andamento</span>}>
        <SearchInput label="Buscar transportadora" value={q ?? ""} onChange={(v) => setQ(v || null)} placeholder="Nome, região, tipo de carga" className="md:w-72" />
      </WorkspaceHeader>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Transportadoras"
          rows={rows}
          rowKey={(c) => c.id}
          columns={columns}
          activeKey={sel}
          onRowClick={(c) => setSel(c.id)}
          defaultSort={{ id: "otif", dir: "desc" }}
          className="h-full"
          empty={<EmptyState icon={<Building />} title="Nenhuma transportadora encontrada." />}
          card={(c) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-fg">{c.name}</p>
                <p className="truncate text-caption text-fg-muted">{c.regions.join(", ")}</p>
              </div>
              <span className="orb-data text-caption text-fg-muted">
                SLA {pct(c.slaPercent)} · OTIF {pct(c.otifPercent)}
              </span>
            </div>
          )}
        />
      </div>
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setSel(null)}
        title={open?.name}
        subtitle={open ? open.regions.join(", ") : null}
        footer={open ? <ResourceActions actions={[{ id: "loads", label: "Cargas aguardando contratação", icon: <Boxes />, href: "/loads?filtro=aguardando", primary: true }]} /> : null}
      >
        {open && (
          <div className="space-y-5 px-5 py-4">
            <MetricGrid
              items={[
                { label: "SLA", value: pct(open.slaPercent), mono: true, tone: open.slaPercent < 90 ? "warning" : undefined },
                { label: "OTIF", value: pct(open.otifPercent), mono: true, tone: open.otifPercent < 90 ? "warning" : undefined },
                { label: "Taxa de ocorrências", value: pct(open.occurrenceRate * 100), mono: true, tone: open.occurrenceRate > 0.05 ? "danger" : undefined },
                { label: "Custo médio por km", value: open.avgCostPerKm.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), mono: true },
              ]}
            />
            <div className="space-y-2">
              <p className="text-caption text-fg-muted">SLA</p>
              <Progress value={open.slaPercent / 100} label="SLA" tone={open.slaPercent < 90 ? "warning" : "success"} />
              <p className="text-caption text-fg-muted">OTIF</p>
              <Progress value={open.otifPercent / 100} label="OTIF" tone={open.otifPercent < 90 ? "warning" : "success"} />
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <KeyValue label="Regiões" value={open.regions.join(", ")} />
              <KeyValue label="Tipos de carga" value={open.cargoTypes.join(", ")} />
            </dl>
            <ResourceTrips trips={tripsOf(open)} title="Viagens contratadas" empty="Nenhuma viagem contratada com esta transportadora." />
          </div>
        )}
      </Drawer>
    </div>
  );
}
