"use client";

import Link from "next/link";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function OccurrencesPage() {
  const { data } = useSimulation();

  const open = data.occurrences.filter((o) => !o.resolved).sort((a, b) => (a.id < b.id ? 1 : -1));
  const resolved = data.occurrences.filter((o) => o.resolved).sort((a, b) => (a.id < b.id ? 1 : -1));

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Central Operacional"
        title="Ocorrências"
        meta={<span className="tabular">{open.length} em aberto · {resolved.length} resolvidas</span>}
      />
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-8 max-w-3xl">
        <section>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
            Em Aberto
          </h2>
          <OccurrenceList occurrences={open} data={data} emptyText="Nenhuma ocorrência em aberto." />
        </section>

        <section>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
            Resolvidas
          </h2>
          <OccurrenceList occurrences={resolved} data={data} emptyText="Nenhuma ocorrência resolvida ainda." />
        </section>
      </div>
    </div>
  );
}

function OccurrenceList({
  occurrences,
  data,
  emptyText,
}: {
  occurrences: ReturnType<typeof useSimulation>["data"]["occurrences"];
  data: ReturnType<typeof useSimulation>["data"];
  emptyText: string;
}) {
  if (occurrences.length === 0) {
    return <p className="text-sm text-cosmic-ink/45">{emptyText}</p>;
  }

  return (
    <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60">
      {occurrences.map((occurrence) => {
        const shipment = data.shipments.find((s) => s.id === occurrence.shipmentId);
        return (
          <Link
            key={occurrence.id}
            href={shipment ? `/shipments/${shipment.id}` : "#"}
            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-opal/5 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-display font-medium text-sm text-cosmic-ink">
                {occurrence.id} · {occurrence.type}
              </p>
              <p className="text-xs text-cosmic-ink/55 truncate">
                {occurrence.shipmentId} · {formatDateTime(occurrence.reportedAt)}
                {occurrence.resolved && occurrence.action ? ` · Resolução: ${occurrence.action}` : ""}
              </p>
            </div>
            <span
              className={`text-xs font-medium shrink-0 ${
                occurrence.resolved ? "text-emerald-700" : "text-cinnamon"
              }`}
            >
              {occurrence.severity}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
