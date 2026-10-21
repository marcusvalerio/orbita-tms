"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Building, ClipboardList, Ellipsis, FileCheck2, IdCard, Package, Route as RouteIcon, Siren, Truck } from "lucide-react";
import { OCCURRENCE_ACTIONS } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useBreadcrumb, useContextCommands } from "@/components/shell/ShellContext";
import { Button, EmptyState, IconButton, KeyValue, Menu, MetricGrid, SectionHeader, Status, Timeline, TripProgress, type TimelineItem } from "@/components/ds";
import { OperationalMap } from "@/components/map/OperationalMap";
import { SimulationBar } from "@/components/map/SimulationBar";
import { useTripActions } from "@/components/patterns/TripActions";
import { stopFractions, hhmm, windowLabel, fmtKm, fmtDuration, type TripStop } from "@/lib/ui/trip";
import { cn } from "@/lib/ui/cn";

// Viagem: cabeçalho operacional (o que importa agora) → mapa + paradas
// (onde está, o que falta) → recursos, ocorrências, pedidos e histórico.
// As ações vivem no cabeçalho e no contexto de cada bloco.

const STOP_LABEL: Record<TripStop["state"], string> = {
  done: "Concluída",
  active: "Próxima",
  pending: "Pendente",
  late: "Atrasada",
  risk: "Em risco",
  issue: "Com ocorrência",
};

export default function ShipmentPage() {
  const params = useParams<{ id: string }>();
  const { data, can, resolveOccurrence } = useOperation();
  const live = useLive();
  const shipment = data.shipments.find((s) => s.id === params.id) ?? null;
  const { actions, dialogs } = useTripActions(shipment);
  const [stop, setStop] = useState<number | null>(null);
  useBreadcrumb(shipment ? (shipment.routeCode ?? shipment.id) : null);
  useContextCommands(
    actions
      .filter((a) => a.id !== "open")
      .map((a) => ({ id: `trip-${a.id}`, label: a.label, hint: shipment?.routeCode ?? shipment?.id, icon: a.icon, run: a.run }))
  );

  const history = useMemo(() => {
    if (!shipment) return [];
    const events: { id: string; at: string; text: string; tone: "event" | "issue" | "done" }[] = [];
    if (shipment.status !== "Planned") events.push({ id: "dep", at: shipment.departureTime, text: "Saída do CD", tone: "event" });
    for (const o of data.occurrences.filter((x) => shipment.occurrenceIds.includes(x.id))) {
      events.push({ id: `o-${o.id}`, at: o.reportedAt, text: `Ocorrência ${o.type.toLowerCase()} (${o.severity.toLowerCase()}) registrada`, tone: "issue" });
      if (o.resolvedAt) events.push({ id: `r-${o.id}`, at: o.resolvedAt, text: `Ocorrência resolvida — ${o.action}`, tone: "done" });
    }
    for (const d of data.deliveries.filter((x) => x.shipmentId === shipment.id && x.completedAt)) events.push({ id: `d-${d.id}`, at: d.completedAt!, text: `${d.orderId} entregue${d.podDocumentId ? ` · POD ${d.podDocumentId}` : ""}`, tone: "done" });
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }, [shipment, data]);

  if (!shipment) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState
          icon={<RouteIcon />}
          title="Viagem não encontrada."
          description="Ela pode ter sido removida ao reiniciar o Modo Demo."
          action={
            <Button asChild>
              <Link href="/shipments">Voltar para Viagens</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const trip = live.trips.get(shipment.id);
  const route = live.routes[shipment.id];
  const hasMap = live.shipments.some((s) => s.id === shipment.id);
  const origin = data.locations.find((l) => l.id === shipment.originId);
  const destination = data.locations.find((l) => l.id === shipment.destinationId);
  const vehicle = data.vehicles.find((v) => v.id === shipment.vehicleId);
  const driver = data.drivers.find((d) => d.id === shipment.driverId);
  const carrier = data.carriers.find((c) => c.id === shipment.carrierId);
  const load = data.loads.find((l) => l.id === shipment.loadId);
  const orders = load ? data.orders.filter((o) => load.orderIds.includes(o.id)) : [];
  const occurrences = data.occurrences.filter((o) => shipment.occurrenceIds.includes(o.id));
  const deliveries = data.deliveries.filter((d) => d.shipmentId === shipment.id);
  const next = trip?.stops.find((s) => s.state !== "done" && s.index > 0);
  const delay = trip?.maxDelayMin ?? 0;
  const fractions = stopFractions(shipment);
  const primary = actions.filter((a) => a.primary).slice(0, 1);
  const secondary = actions.filter((a) => !a.primary && (a.id === "report" || a.id === "complete")).slice(0, 2 - primary.length);
  const shown = new Set([...primary, ...secondary].map((a) => a.id));
  const rest = actions.filter((a) => !shown.has(a.id) && a.id !== "open");

  const stopItems: TimelineItem[] = (trip?.stops ?? []).map((st) => {
    const late = st.delayMin > 0;
    const stopOrders = orders.filter((o) => st.orderIds.includes(o.id));
    return {
      id: String(st.index),
      marker: st.index === 0 ? "CD" : st.index,
      state: st.state === "issue" ? "issue" : st.state,
      title: (
        <button type="button" onClick={() => setStop(st.index)} className={cn("text-left hover:underline underline-offset-2", stop === st.index && "font-semibold")}>
          {st.name}
          {st.city && st.city !== st.name && <span className="text-fg-muted"> · {st.city}</span>}
        </button>
      ),
      meta: (
        <>
          {st.index === 0 ? "Coleta" : STOP_LABEL[st.state]}
          {windowLabel(st) && <span className="orb-data"> · janela {windowLabel(st)}</span>}
          {late && <span className="font-medium text-danger-fg"> · ETA excede a janela em {st.delayMin} min</span>}
          {st.state === "risk" && <span className="font-medium text-warning-fg"> · folga de {st.slackMin} min</span>}
        </>
      ),
      aside: (
        <span className="flex flex-col items-end">
          {st.state === "done" ? (
            <span className="orb-data text-success-fg">{st.actualTime ? `Real ${hhmm(st.actualTime)}` : "✓"}</span>
          ) : (
            <span className={cn("orb-data", late ? "font-semibold text-danger-fg" : "text-fg")}>ETA {hhmm(st.eta)}</span>
          )}
          <span className="orb-data text-fg-subtle">Prev. {hhmm(st.plannedTime)}</span>
        </span>
      ),
      children: stopOrders.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {stopOrders.map((o) => (
            <Link key={o.id} href={`/orders?pedido=${o.id}`} className="orb-data inline-flex items-center gap-1 rounded-xs border border-line-subtle bg-surface px-1.5 text-caption text-fg-muted hover:border-line-strong hover:text-fg">
              <Package className="size-3" aria-hidden />
              {o.id}
            </Link>
          ))}
        </div>
      ) : undefined,
    };
  });

  return (
    <div className="orb-scroll min-h-0 flex-1 overflow-y-auto">
      {/* Cabeçalho operacional */}
      <header className="border-b border-line-subtle bg-surface">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 pb-3 pt-4 md:px-6">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="orb-data text-h1 font-semibold text-fg">{shipment.routeCode ?? shipment.id}</h1>
              <span data-testid="trip-status">
                <Status entity="shipment" value={shipment.status} />
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-body-sm text-fg-muted">
              <span className="orb-data text-fg">{shipment.id}</span>
              <span aria-hidden>·</span>
              {origin?.name} <ArrowRight className="size-3.5" aria-label="até" /> {destination?.name}
              <span aria-hidden>·</span>
              {shipment.stops.length - 1} entrega(s)
              <span aria-hidden>·</span>
              saída <span className="orb-data text-fg">{hhmm(shipment.departureTime)}</span>
            </p>
          </div>
          {actions.length > 0 && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {[...primary, ...secondary].map((a, i) => (
                <Button key={a.id} variant={i === 0 && a.primary ? "primary" : "secondary"} icon={<span className="[&_svg]:size-4">{a.icon}</span>} onClick={a.run}>
                  {a.label}
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
        </div>
        <div className="grid gap-4 px-4 pb-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <MetricGrid
            columns={4}
            items={[
              { label: "Velocidade", value: trip?.speedKmh != null ? `${trip.speedKmh} km/h` : "—", mono: true },
              { label: "Próxima parada", value: next ? next.name : "—", hint: next?.eta ? `ETA ${hhmm(next.eta)}` : undefined },
              { label: "Chegada final", value: hhmm(trip?.finalEta ?? shipment.etaTime), mono: true },
              { label: "Atraso projetado", value: delay > 0 ? `+${delay} min` : trip?.health === "done" ? "Concluída" : "No prazo", tone: delay > 0 ? "danger" : "success", mono: delay > 0 },
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
        </div>
      </header>

      <div className="grid gap-6 px-4 py-5 md:px-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        {/* Mapa + paradas */}
        <div className="min-w-0 space-y-6">
          {hasMap && (
            <div className="overflow-hidden rounded-lg border border-line-subtle">
              <OperationalMap only={shipment.id} selectedId={shipment.id} onSelect={() => {}} selectedStop={stop} onStopSelect={(_, i) => setStop(i)} className="h-[min(48vh,420px)]" label={`Mapa da viagem ${shipment.routeCode ?? shipment.id}`}>
                {trip?.tracked && (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex md:pr-14">
                    <SimulationBar resetId={shipment.id} compact className="pointer-events-auto" />
                  </div>
                )}
              </OperationalMap>
              {route && (
                <p className="border-t border-line-subtle bg-surface px-4 py-2 text-caption text-fg-muted">
                  <span className="orb-data text-fg">
                    {fmtKm(route.distanceMeters)} · {fmtDuration(route.durationSeconds)}
                  </span>{" "}
                  · {route.source === "google-routes" ? "Rota calculada pelo Google Routes." : "Estimativa local — provedor de rotas indisponível."}
                </p>
              )}
            </div>
          )}

          <section aria-labelledby="paradas" className="rounded-lg border border-line-subtle bg-surface">
            <SectionHeader id="paradas" title="Paradas" count={trip?.stops.length} className="border-b border-line-subtle px-4" actions={trip ? <span className="text-caption text-fg-muted">{trip.doneStops} concluída(s)</span> : null} />
            <div className="px-4 py-4" aria-live="polite">
              <Timeline label="Paradas da viagem" items={stopItems} />
            </div>
          </section>
        </div>

        {/* Contexto */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="ocorrencias" className="rounded-lg border border-line-subtle bg-surface">
            <SectionHeader id="ocorrencias" title="Ocorrências" count={occurrences.length} className="border-b border-line-subtle px-4" />
            {occurrences.length === 0 ? (
              <p className="px-4 py-3 text-body-sm text-fg-muted">Nenhuma ocorrência registrada nesta viagem.</p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {occurrences.map((o) => (
                  <li key={o.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-body text-fg">
                          <Siren className="size-4 text-exception" aria-hidden />
                          {o.type}
                          <span className="orb-data text-caption text-fg-subtle">{o.id}</span>
                        </p>
                        <p className="mt-0.5 text-caption text-fg-muted">
                          {o.description} · <span className="orb-data">{hhmm(o.reportedAt)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Status entity="severity" value={o.severity} size="sm" />
                        <Status entity="occurrence" value={o.resolved ? "resolved" : "open"} size="sm" variant="inline" />
                      </div>
                    </div>
                    {o.resolved ? (
                      <p className="mt-1 text-caption text-success-fg">Resolvida · {o.action}</p>
                    ) : can("occurrences:resolve") ? (
                      <div className="mt-2.5">
                        <p className="mb-1.5 text-caption text-fg-muted">Resolver com:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {OCCURRENCE_ACTIONS.map((a) => (
                            <Button key={a} size="sm" onClick={() => resolveOccurrence(o.id, a)}>
                              {a}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="recursos" className="rounded-lg border border-line-subtle bg-surface">
            <SectionHeader id="recursos" title="Recursos" className="border-b border-line-subtle px-4" />
            <dl className="grid grid-cols-2 gap-4 px-4 py-3">
              <KeyValue label="Veículo" value={vehicle ? <Link href={`/fleet?veiculo=${vehicle.id}`} className="flex items-center gap-1.5 hover:underline"><Truck className="size-3.5 text-fg-muted" aria-hidden /><span className="orb-data">{vehicle.plate}</span></Link> : "Da transportadora"} />
              <KeyValue label="Motorista" value={driver ? <span className="flex items-center gap-1.5"><IdCard className="size-3.5 text-fg-muted" aria-hidden />{driver.name}</span> : shipment.carrierId ? "Da transportadora" : "—"} />
              <KeyValue label="Transportadora" value={<span className="flex items-center gap-1.5"><Building className="size-3.5 text-fg-muted" aria-hidden />{carrier?.name ?? "Frota Própria"}</span>} />
              <KeyValue label="Carga" value={load ? <Link href={`/loads?carga=${load.id}`} className="orb-data hover:underline">{load.id}</Link> : "—"} />
              {vehicle && <KeyValue label="Tipo · capacidade" value={`${vehicle.type} · ${vehicle.capacityKg.toLocaleString("pt-BR")} kg`} />}
              {load && vehicle && <KeyValue label="Ocupação" value={`${Math.round((load.totalWeightKg / vehicle.capacityKg) * 100)}% · ${load.totalWeightKg.toLocaleString("pt-BR")} kg`} />}
            </dl>
          </section>

          <section aria-labelledby="pedidos" className="rounded-lg border border-line-subtle bg-surface">
            <SectionHeader id="pedidos" title="Pedidos nesta viagem" count={orders.length} className="border-b border-line-subtle px-4" />
            <ul className="divide-y divide-line-subtle">
              {orders.map((order) => {
                const delivery = deliveries.find((d) => d.orderId === order.id);
                return (
                  <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/orders?pedido=${order.id}`} className="orb-data flex items-center gap-1.5 text-body-sm font-medium text-fg hover:underline">
                        <ClipboardList className="size-3.5 text-fg-muted" aria-hidden />
                        {order.id}
                      </Link>
                      <p className="truncate text-caption text-fg-muted">
                        {data.customers.find((c) => c.id === order.customerId)?.name}
                        {delivery?.podDocumentId && (
                          <span className="ml-1 inline-flex items-center gap-1">
                            · <FileCheck2 className="size-3" aria-hidden /> POD {delivery.podDocumentId} (simulado)
                          </span>
                        )}
                      </p>
                    </div>
                    <Status entity="order" value={order.status} size="sm" />
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="historico" className="rounded-lg border border-line-subtle bg-surface">
            <SectionHeader id="historico" title="Histórico" className="border-b border-line-subtle px-4" />
            {history.length === 0 ? (
              <p className="px-4 py-3 text-body-sm text-fg-muted">Viagem ainda não iniciada.</p>
            ) : (
              <ol className="space-y-2 px-4 py-3">
                {history.map((e) => (
                  <li key={e.id} className="flex gap-3 text-body-sm">
                    <span className="orb-data w-11 shrink-0 text-fg-subtle">{hhmm(e.at)}</span>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.tone === "issue" ? "bg-exception" : e.tone === "done" ? "bg-success" : "bg-line-strong")} aria-hidden />
                    <span className="text-fg">{e.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
      {dialogs}
    </div>
  );
}
