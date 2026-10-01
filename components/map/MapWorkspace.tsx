"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MapPinned, Route as RouteIcon, Search, Truck } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useUrlParam } from "@/components/live/useUrlState";
import { useBreadcrumb } from "@/components/shell/ShellContext";
import { Button, EmptyState, FilterBar, Status, Spinner } from "@/components/ds";
import { TripPanel } from "@/components/patterns/TripPanel";
import { OperationalMap } from "./OperationalMap";
import { SimulationBar } from "./SimulationBar";
import { HttpGeocodingProvider } from "@/lib/geo/client/http-providers";
import { CatalogGeocodingProvider } from "@/lib/geo/catalog-geocoding";
import { filterTrips, parseTripFilter, tripFilterOptions, type TripFilter } from "@/lib/ui/filters";
import { hhmm } from "@/lib/ui/trip";
import type { GeocodeResult } from "@/lib/geo/types";
import { cn } from "@/lib/ui/cn";

/**
 * Mapa: lista de rotas → mapa → painel da rota (padrão lista ↔ mapa ↔ detalhe).
 * Seleção e filtro na URL; mapa, lista e painel compartilham a mesma seleção.
 */
export function MapWorkspace() {
  const { data } = useOperation();
  const live = useLive();
  const [viagem, setViagem] = useUrlParam("viagem");
  const [filtroRaw, setFiltro] = useUrlParam("filtro");
  const filtro = parseTripFilter(filtroRaw);
  const [stop, setStop] = useState<{ id: string; index: number } | null>(null);
  const [pin, setPin] = useState<GeocodeResult | null>(null);

  const trips = useMemo(() => live.shipments.map((s) => live.trips.get(s.id)!).filter(Boolean), [live.shipments, live.trips]);
  const visible = useMemo(() => filterTrips(trips, filtro), [trips, filtro]);
  const focusIds = useMemo(() => (filtro === "todas" ? null : new Set(visible.map((t) => t.shipment.id))), [filtro, visible]);

  const ids = live.shipments.map((s) => s.id);
  const defaultId = visible.find((t) => t.tracked)?.shipment.id ?? visible[0]?.shipment.id ?? live.shipments[0]?.id ?? null;
  const selectedId = viagem && ids.includes(viagem) ? viagem : defaultId;
  const selected = live.shipments.find((s) => s.id === selectedId) ?? null;
  useBreadcrumb(selected?.routeCode ?? selected?.id ?? null);

  const select = (id: string | null) => {
    setPin(null);
    setStop(null);
    live.prioritize(id);
    setViagem(id);
  };

  if (live.shipments.length === 0) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState
          icon={<RouteIcon />}
          title="Nenhuma rota em planejamento ou execução."
          description="As rotas aparecem aqui quando uma carga é contratada. Comece pelo planejamento."
          action={
            <Button variant="primary" asChild>
              <Link href="/planning">Ir para o planejamento</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(52dvh,1fr)_auto] overflow-y-auto lg:grid-cols-[320px_minmax(0,1fr)_380px] lg:grid-rows-1 lg:overflow-hidden">
      {/* Lista de rotas */}
      <div className="flex min-h-0 flex-col border-b border-line-subtle bg-surface lg:border-b-0 lg:border-r">
        <div className="border-b border-line-subtle px-3 py-2.5">
          <FilterBar label="Filtrar rotas" value={filtro} onChange={(v: TripFilter) => setFiltro(v === "todas" ? null : v)} options={tripFilterOptions(trips).filter((o) => o.count > 0 || o.value === "todas")} />
        </div>
        <nav aria-label="Rotas" className="orb-scroll flex gap-2 overflow-x-auto px-3 py-2 lg:block lg:flex-1 lg:space-y-px lg:overflow-y-auto lg:p-0">
          {visible.length === 0 && <p className="px-4 py-6 text-body-sm text-fg-muted">Nenhuma rota neste filtro.</p>}
          {visible.map((t) => {
            const s = t.shipment;
            const v = data.vehicles.find((x) => x.id === s.vehicleId);
            const carrier = data.carriers.find((c) => c.id === s.carrierId);
            const active = s.id === selectedId;
            const next = t.stops.find((st) => st.state !== "done" && st.index > 0);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => select(s.id)}
                className={cn(
                  "orb-focus-inset relative shrink-0 rounded-md border px-3 py-2.5 text-left transition-colors duration-(--orb-duration-instant) lg:block lg:w-full lg:rounded-none lg:border-0 lg:border-b lg:border-line-subtle lg:px-4",
                  active ? "border-brand bg-surface-selected" : "border-line bg-surface hover:bg-surface-hover"
                )}
              >
                {active && <span aria-hidden className="absolute inset-y-0 left-0 hidden w-0.5 bg-brand lg:block" />}
                <span className="flex items-center justify-between gap-2">
                  <span className="orb-data text-body-sm font-medium text-fg">{s.routeCode ?? s.id}</span>
                  <Status entity="shipment" value={s.status} size="sm" />
                </span>
                <span className="mt-0.5 hidden items-center gap-1.5 text-caption text-fg-muted lg:flex">
                  <Truck className="size-3 shrink-0" aria-hidden />
                  <span className="orb-data">{v ? v.plate : carrier?.name ?? "—"}</span>
                  <span>·</span>
                  <span className="truncate">
                    {t.doneStops}/{t.stops.length} paradas{next ? ` · próx. ${next.name}` : ""}
                  </span>
                  {live.loadingIds.includes(s.id) && <Spinner size={11} label="calculando rota" />}
                </span>
                {t.maxDelayMin > 0 ? (
                  <span className="mt-1 hidden text-caption font-medium text-danger-fg lg:block">Atraso projetado +{t.maxDelayMin} min</span>
                ) : t.health === "risk" ? (
                  <span className="mt-1 hidden text-caption font-medium text-warning-fg lg:block">Janela apertada · ETA {hhmm(next?.eta)}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mapa */}
      <OperationalMap
        selectedId={selectedId}
        onSelect={select}
        selectedStop={stop && stop.id === selectedId ? stop.index : null}
        onStopSelect={(id, index) => setStop({ id, index })}
        focusIds={focusIds}
        pin={pin}
        className="min-h-[52dvh]"
      >
        <GeoSearch onPick={setPin} />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-center md:justify-start md:pr-16">
          <SimulationBar resetId={selectedId} className="pointer-events-auto max-w-full overflow-x-auto" />
        </div>
      </OperationalMap>

      {/* Painel da rota */}
      {selected && (
        <aside aria-label={`Detalhes da rota ${selected.routeCode ?? selected.id}`} className="orb-scroll min-h-0 overflow-y-auto border-t border-line-subtle bg-surface lg:border-l lg:border-t-0">
          <div key={selected.id} className="animate-orb-rise-in">
            <TripPanel shipmentId={selected.id} selectedStop={stop?.id === selected.id ? stop.index : null} onStopSelect={(i) => setStop({ id: selected.id, index: i })} />
          </div>
        </aside>
      )}
    </div>
  );
}

function GeoSearch({ onPick }: { onPick: (r: GeocodeResult) => void }) {
  const { data } = useOperation();
  const geocoder = useMemo(() => new HttpGeocodingProvider(new CatalogGeocodingProvider(data.locations)), [data.locations]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setBusy(true);
    setResults(await geocoder.geocode(query.trim()));
    setBusy(false);
  };

  return (
    <div className="absolute left-3 top-3 z-10 w-[min(320px,calc(100%-72px))]">
      <form onSubmit={search} role="search" className="flex overflow-hidden rounded-md border border-line-subtle bg-surface shadow-2">
        <label htmlFor="geo-search" className="sr-only">
          Buscar endereço ou local
        </label>
        <MapPinned aria-hidden className="ml-2.5 mt-2 size-4 shrink-0 text-fg-subtle" />
        <input
          id="geo-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar endereço ou local"
          className="h-8 min-w-0 flex-1 bg-transparent px-2 text-body-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
        <button type="submit" disabled={busy} aria-label="Buscar" className="grid w-9 place-items-center border-l border-line-subtle text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-50">
          {busy ? <Spinner size={13} /> : <Search className="size-4" aria-hidden />}
        </button>
      </form>
      {results && (
        <ul className="orb-popover mt-1 overflow-hidden rounded-md border border-line-subtle bg-surface text-body-sm shadow-3" data-state="open">
          {results.length === 0 && <li className="px-3 py-2 text-fg-muted">Nada encontrado.</li>}
          {results.map((r) => (
            <li key={`${r.label}-${r.position.lat}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-surface-hover"
                onClick={() => {
                  onPick(r);
                  setResults(null);
                }}
              >
                {r.label}
                <span className="block text-caption text-fg-muted">{r.source === "catalog" ? "Cadastro da operação" : "Google"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
