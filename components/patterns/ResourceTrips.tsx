"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Siren } from "lucide-react";
import type { Shipment } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { Status, EmptyState, Button } from "@/components/ds";
import { hhmm } from "@/lib/ui/trip";

// Blocos compartilhados pelas telas de Recursos (Frota, Motoristas,
// Transportadoras): histórico de viagens do recurso, ocorrências ligadas e a
// lista de ações. As ações são uma lista tipada — novas ações (atribuir
// motorista, alterar disponibilidade…) entram aqui quando o domínio as tiver,
// sem mudar o layout. Nada de ação fictícia.

export interface ResourceAction {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  run?: () => void;
  primary?: boolean;
}

export function ResourceActions({ actions }: { actions: ResourceAction[] }) {
  if (!actions.length) return null;
  return (
    <>
      {actions.map((a, i) =>
        a.href ? (
          <Button key={a.id} variant={a.primary || i === 0 ? "primary" : "secondary"} asChild>
            <Link href={a.href}>
              {a.icon && <span className="[&_svg]:size-4">{a.icon}</span>}
              {a.label}
            </Link>
          </Button>
        ) : (
          <Button key={a.id} variant={a.primary || i === 0 ? "primary" : "secondary"} onClick={a.run} icon={a.icon ? <span className="[&_svg]:size-4">{a.icon}</span> : undefined}>
            {a.label}
          </Button>
        )
      )}
    </>
  );
}

export function ResourceTrips({ trips, title = "Viagens", empty = "Nenhuma viagem registrada." }: { trips: Shipment[]; title?: string; empty?: string }) {
  const { data } = useOperation();
  const sorted = [...trips].sort((a, b) => b.departureTime.localeCompare(a.departureTime));
  const occurrences = data.occurrences.filter((o) => trips.some((s) => s.occurrenceIds.includes(o.id)));
  return (
    <>
      <section aria-label={title}>
        <p className="mb-2 text-h3 text-fg">
          {title} <span className="tabular font-normal text-fg-subtle">{trips.length}</span>
        </p>
        {sorted.length === 0 ? (
          <EmptyState compact title={empty} />
        ) : (
          <ul className="divide-y divide-line-subtle rounded-md border border-line-subtle">
            {sorted.map((s) => (
              <li key={s.id}>
                <Link href={`/shipments/${s.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-surface-hover">
                  <span className="min-w-0">
                    <span className="orb-data block text-body-sm font-medium text-fg">{s.routeCode ?? s.id}</span>
                    <span className="block truncate text-caption text-fg-muted">
                      <span className="orb-data">{s.id}</span> · saída <span className="orb-data">{new Date(s.departureTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {hhmm(s.departureTime)}</span> · {s.stops.length - 1} entrega(s)
                    </span>
                  </span>
                  <Status entity="shipment" value={s.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {occurrences.length > 0 && (
        <section aria-label="Ocorrências">
          <p className="mb-2 text-h3 text-fg">
            Ocorrências <span className="tabular font-normal text-fg-subtle">{occurrences.length}</span>
          </p>
          <ul className="divide-y divide-line-subtle rounded-md border border-line-subtle">
            {occurrences.map((o) => (
              <li key={o.id}>
                <Link href={`/occurrences?ocorrencia=${o.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-surface-hover">
                  <span className="flex min-w-0 items-center gap-2 text-body-sm text-fg">
                    <Siren className="size-3.5 shrink-0 text-exception" aria-hidden />
                    <span className="truncate">{o.type}</span>
                    <span className="orb-data text-caption text-fg-subtle">{o.shipmentId}</span>
                  </span>
                  <Status entity="occurrence" value={o.resolved ? "resolved" : "open"} size="sm" variant="inline" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
