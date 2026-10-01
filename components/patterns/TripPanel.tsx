"use client";

import Link from "next/link";
import { Ellipsis, Truck, IdCard, Building } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { Button, IconButton, Menu, MetricGrid, Status, Timeline, TripProgress, KeyValue, type TimelineItem } from "@/components/ds";
import { stopFractions, hhmm, windowLabel, fmtKm, fmtDuration, type TripStop } from "@/lib/ui/trip";
import { cn } from "@/lib/ui/cn";
import { useTripActions } from "./TripActions";

// Painel operacional da viagem — usado ao lado do mapa, no drawer do Command
// Center e como resumo na página da viagem. Ver (mapa) → entender (ETA ×
// janela, motivo) → agir (no máximo 2 ações; o resto em ⋯ e no ⌘K).

const STOP_LABEL: Record<TripStop["state"], string> = {
  done: "Concluída",
  active: "Próxima",
  pending: "Pendente",
  late: "Atrasada",
  risk: "Em risco",
  issue: "Com ocorrência",
};

export function TripPanel({
  shipmentId,
  selectedStop,
  onStopSelect,
  showHeader = true,
  className,
}: {
  shipmentId: string;
  selectedStop?: number | null;
  onStopSelect?: (index: number) => void;
  showHeader?: boolean;
  className?: string;
}) {
  const { data } = useOperation();
  const live = useLive();
  const shipment = data.shipments.find((s) => s.id === shipmentId) ?? null;
  const { actions, dialogs } = useTripActions(shipment);
  if (!shipment) return null;

  const trip = live.trips.get(shipment.id);
  const route = live.routes[shipment.id];
  const loading = live.loadingIds.includes(shipment.id);
  const origin = data.locations.find((l) => l.id === shipment.originId);
  const destination = data.locations.find((l) => l.id === shipment.destinationId);
  const vehicle = data.vehicles.find((v) => v.id === shipment.vehicleId);
  const driver = data.drivers.find((d) => d.id === shipment.driverId);
  const carrier = data.carriers.find((c) => c.id === shipment.carrierId);
  const next = trip?.stops.find((s) => s.state !== "done" && s.index > 0);
  const fractions = stopFractions(shipment);
  const primary = actions.filter((a) => a.primary).slice(0, 1);
  const secondary = actions.filter((a) => !a.primary && (a.id === "report" || a.id === "complete")).slice(0, 2 - primary.length);
  const shown = new Set([...primary, ...secondary].map((a) => a.id));
  const rest = actions.filter((a) => !shown.has(a.id));
  const delay = trip?.maxDelayMin ?? 0;

  const items: TimelineItem[] = (trip?.stops ?? []).map((st) => {
    const late = st.state === "late" || (st.state === "issue" && st.delayMin > 0);
    return {
      id: String(st.index),
      marker: st.index === 0 ? "CD" : st.index,
      state: st.state === "issue" ? "issue" : st.state,
      title: (
        <button type="button" onClick={() => onStopSelect?.(st.index)} className={cn("text-left hover:underline underline-offset-2", selectedStop === st.index && "font-semibold")}>
          {st.name}
        </button>
      ),
      meta: (
        <>
          {st.index === 0 ? (st.state === "done" ? "Saída" : "Coleta") : STOP_LABEL[st.state]}
          {windowLabel(st) && <span className="orb-data"> · janela {windowLabel(st)}</span>}
          {late && <span className="text-danger-fg"> · +{st.delayMin} min</span>}
        </>
      ),
      aside:
        st.state === "done" ? (
          <span className="orb-data text-success-fg">{st.actualTime ? `✓ ${hhmm(st.actualTime)}` : "✓"}</span>
        ) : (
          <span className={cn("orb-data", late ? "font-semibold text-danger-fg" : st.state === "risk" ? "text-warning-fg" : "text-fg-muted")}>ETA {hhmm(st.eta)}</span>
        ),
    };
  });

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {showHeader && (
        <div className="border-b border-line-subtle px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="orb-data text-h2 text-fg">{shipment.routeCode ?? shipment.id}</h2>
            <Status entity="shipment" value={shipment.status} size="sm" />
          </div>
          <p className="mt-0.5 text-caption text-fg-muted">
            <Link href={`/shipments/${shipment.id}`} className="orb-data underline underline-offset-2 hover:text-fg">
              {shipment.id}
            </Link>{" "}
            · {origin?.name} → {destination?.name} · saída <span className="orb-data">{hhmm(shipment.departureTime)}</span>
          </p>
        </div>
      )}

      <div className="space-y-4 px-4 py-3">
        <MetricGrid
          items={[
            { label: "Velocidade", value: trip?.speedKmh != null ? `${trip.speedKmh} km/h` : "—", mono: true, hint: trip?.tracked ? "Simulação" : "Sem rastreamento" },
            { label: "Próxima parada", value: next ? next.name : "—", hint: next?.eta ? `ETA ${hhmm(next.eta)}` : undefined },
            { label: "Chegada final", value: hhmm(trip?.finalEta ?? shipment.etaTime), mono: true },
            {
              label: "Atraso projetado",
              value: delay > 0 ? `+${delay} min` : trip?.health === "risk" ? "Em risco" : "No prazo",
              tone: delay > 0 ? "danger" : trip?.health === "risk" ? "warning" : "success",
              mono: delay > 0,
            },
          ]}
        />
        <TripProgress
          label="Progresso da rota"
          progress={trip?.progress ?? 0}
          stops={(trip?.stops ?? []).slice(1).map((s) => ({ at: fractions[s.index], state: s.state === "issue" ? "issue" : s.state, title: s.name }))}
          startLabel={origin?.name}
          startTime={hhmm(shipment.departureTime)}
          endLabel={destination?.name}
          endTime={hhmm(trip?.finalEta ?? shipment.etaTime)}
        />
        <p className="text-caption text-fg-muted">
          {route ? (
            <>
              <span className="orb-data text-fg">
                {fmtKm(route.distanceMeters)} · {fmtDuration(route.durationSeconds)}
              </span>{" "}
              · {route.source === "google-routes" ? "Rota calculada pelo Google Routes." : "Estimativa local (linha reta × fator de via) — provedor de rotas indisponível."}
            </>
          ) : loading ? (
            "Calculando rota…"
          ) : null}
        </p>
      </div>

      <section aria-label="Paradas" className="border-t border-line-subtle px-4 py-3">
        <h3 className="mb-3 text-h3 text-fg">
          Paradas <span className="tabular font-normal text-fg-subtle">{trip ? `${trip.doneStops}/${trip.stops.length}` : ""}</span>
        </h3>
        <div aria-live="polite">
          <Timeline label={`Paradas de ${shipment.routeCode ?? shipment.id}`} items={items} />
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 border-t border-line-subtle px-4 py-3">
        <KeyValue label="Veículo" value={vehicle ? <span className="flex items-center gap-1.5"><Truck className="size-3.5 text-fg-muted" aria-hidden /><span className="orb-data">{vehicle.id} · {vehicle.plate}</span></span> : "Da transportadora"} />
        <KeyValue label="Motorista" value={driver ? <span className="flex items-center gap-1.5"><IdCard className="size-3.5 text-fg-muted" aria-hidden />{driver.name}</span> : "—"} />
        <KeyValue label="Transportadora" value={<span className="flex items-center gap-1.5"><Building className="size-3.5 text-fg-muted" aria-hidden />{carrier?.name ?? "Frota Própria"}</span>} />
        <KeyValue label="Carga" value={<span className="orb-data">{shipment.loadId}</span>} />
      </dl>

      {actions.length > 0 && (
        <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-line-subtle bg-surface px-4 py-3">
          {[...primary, ...secondary].map((a, i) => (
            <Button key={a.id} variant={i === 0 && a.primary ? "primary" : "secondary"} icon={<span className="[&_svg]:size-4">{a.icon}</span>} onClick={a.run} className="min-w-0 flex-1">
              <span className="truncate">{a.label}</span>
            </Button>
          ))}
          {rest.length > 0 && (
            <Menu
              label="Mais ações da viagem"
              trigger={<IconButton label="Mais ações" variant="secondary" icon={<Ellipsis className="size-4" />} />}
              items={rest.map((a) => ({ label: a.label, icon: a.icon, onSelect: a.run }))}
            />
          )}
        </div>
      )}
      {dialogs}
    </div>
  );
}
