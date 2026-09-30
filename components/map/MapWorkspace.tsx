"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useOperation } from "@/components/operation/OperationProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MapCanvas, type MapStatus } from "./MapCanvas";
import { useRoutePlans, stopPoints, TRACKED_STATUSES } from "./useRoutePlans";
import { GoogleMapProvider } from "@/lib/geo/google/map-provider";
import { SchematicMapProvider } from "@/lib/geo/schematic/map-provider";
import { HttpGeocodingProvider, HttpRouteProvider } from "@/lib/geo/client/http-providers";
import { CatalogGeocodingProvider } from "@/lib/geo/catalog-geocoding";
import { DemoTrackingProvider } from "@/lib/geo/simulation/demo-tracking";
import { SIMULATION_SPEEDS, BASE_RATE, type ClockState } from "@/lib/geo/simulation/clock";
import type { SimulationState } from "@/lib/geo/simulation/engine";
import type { GeocodeResult, MapHandle, MapMarker, MapProvider, MapScene, StopProgress } from "@/lib/geo/types";
import type { Shipment } from "@/lib/domain/types";

const TZ = "America/Sao_Paulo";
const hhmm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "—";
const km = (m: number) => `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
const duration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
};

const EMPTY_POSITIONS: SimulationState[] = [];

const STOP_STATE: Record<StopProgress, MapMarker["state"]> = {
  Pendente: "pending",
  "Em rota": "pending",
  Chegou: "arrived",
  "Em descarga": "arrived",
  Entregue: "done",
};

/**
 * Assina uma fonte que muda a cada quadro, mas notifica o React no máximo a
 * cada `intervalMs` — sempre com uma notificação final (trailing), para que
 * o último estado (ex.: após pausar/reiniciar) nunca fique para trás.
 */
function useThrottledStore<T>(subscribe: (cb: () => void) => () => void, get: () => T, intervalMs: number, serverValue: T): T {
  const throttledSubscribe = useMemo(
    () => (cb: () => void) => {
      let last = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = subscribe(() => {
        const wait = intervalMs - (Date.now() - last);
        if (wait <= 0) {
          last = Date.now();
          cb();
        } else if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            last = Date.now();
            cb();
          }, wait);
        }
      });
      return () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
    },
    [subscribe, intervalMs]
  );
  return useSyncExternalStore(throttledSubscribe, get, () => serverValue);
}

export function MapWorkspace({ mapConfig }: { mapConfig: { apiKey: string; mapId: string } | null }) {
  const { data } = useOperation();
  const searchParams = useSearchParams();

  const shipments = useMemo(
    () => data.shipments.filter((s) => s.status !== "Delivered" && s.status !== "Closed" && s.stops.length >= 2),
    [data.shipments]
  );
  const requested = searchParams.get("viagem");
  const defaultId =
    (requested && shipments.some((s) => s.id === requested) && requested) ||
    shipments.find((s) => TRACKED_STATUSES.includes(s.status))?.id ||
    shipments[0]?.id ||
    null;
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selectedId = chosenId && shipments.some((s) => s.id === chosenId) ? chosenId : defaultId;
  const selected = shipments.find((s) => s.id === selectedId) ?? null;

  // Provedores (trocáveis sem tocar nesta tela).
  const [mapProvider] = useState<MapProvider>(() =>
    mapConfig ? new GoogleMapProvider(mapConfig.apiKey, mapConfig.mapId) : new SchematicMapProvider()
  );
  const [routeProvider] = useState(() => new HttpRouteProvider());
  const geocoder = useMemo(() => new HttpGeocodingProvider(new CatalogGeocodingProvider(data.locations)), [data.locations]);
  const [tracking] = useState(() => new DemoTrackingProvider(Date.now()));
  const [mapStatus, setMapStatus] = useState<MapStatus>({ kind: "loading" });
  const [handle, setHandle] = useState<MapHandle | null>(null);
  const [searchPin, setSearchPin] = useState<GeocodeResult | null>(null);

  const { results, plans, loadingIds } = useRoutePlans(data, shipments, selectedId, routeProvider);
  const trackedIds = useMemo(() => shipments.filter((s) => TRACKED_STATUSES.includes(s.status)).map((s) => s.id), [shipments]);

  useEffect(() => {
    tracking.setPlans(trackedIds.map((id) => plans[id]).filter(Boolean));
  }, [tracking, plans, trackedIds]);
  useEffect(() => () => tracking.dispose(), [tracking]);

  // Animação: veículos se movem direto no mapa, fora do ciclo do React.
  useEffect(() => {
    if (!handle) return;
    return tracking.subscribe((positions) =>
      handle.moveMarkers(positions.map((p) => ({ id: `veh:${p.shipmentId}`, position: p.position, headingDeg: p.headingDeg })))
    );
  }, [handle, tracking]);

  // Painel: 4 atualizações por segundo bastam para leitura humana.
  const subscribeTracking = useCallback((cb: () => void) => tracking.subscribe(cb), [tracking]);
  const getPositions = useCallback(() => tracking.getSnapshot(), [tracking]);
  const positions = useThrottledStore<SimulationState[]>(subscribeTracking, getPositions, 250, EMPTY_POSITIONS);
  const clock = useSyncExternalStore<ClockState | null>(
    (cb) => tracking.clock.subscribe(cb),
    () => tracking.clock.getState(),
    () => null
  );
  const selectedPos = positions.find((p) => p.shipmentId === selectedId) ?? null;

  const scene = useMemo<MapScene>(() => {
    const markers: MapMarker[] = [];
    const polylines: MapScene["polylines"] = [];
    for (const s of shipments) {
      const plan = plans[s.id];
      if (!plan) continue;
      polylines.push({ id: `route:${s.id}`, path: plan.path, kind: s.id === selectedId ? "route" : "route-muted" });
    }
    if (selected) {
      const points = stopPoints(data, selected);
      const pos = positions.find((p) => p.shipmentId === selected.id);
      selected.stops.forEach((stop, i) => {
        const loc = data.locations.find((l) => l.id === stop.locationId);
        const progress = pos?.stopProgress[i] ?? (stop.actualTime ? "Entregue" : "Pendente");
        markers.push({
          id: `stop:${selected.id}:${i}`,
          position: points[i],
          kind: i === 0 ? "origin" : "stop",
          label: String(i),
          title: `${i === 0 ? "Origem" : `Parada ${i}`} — ${loc?.name ?? stop.locationId} (${progress})`,
          state: selected.status === "Exception" && progress === "Em rota" ? "exception" : STOP_STATE[progress],
          selected: pos?.activeStopIndex === i,
        });
      });
    }
    for (const id of trackedIds) {
      const p = tracking.getSnapshot().find((x) => x.shipmentId === id);
      const s = shipments.find((x) => x.id === id);
      if (!p || !s) continue;
      markers.push({
        id: `veh:${id}`,
        position: p.position,
        kind: "vehicle",
        title: `Veículo ${s.vehicleId ?? "da transportadora"} — ${s.routeCode ?? s.id}`,
        headingDeg: p.headingDeg,
        selected: id === selectedId,
      });
    }
    if (searchPin) {
      markers.push({ id: "search", position: searchPin.position, kind: "destination", label: "★", title: searchPin.label, state: "arrived" });
    }
    return { markers, polylines };
    // `positions` entra só pelo estado das paradas (throttled); veículos andam via moveMarkers.
  }, [shipments, plans, selected, selectedId, data, positions, trackedIds, tracking, searchPin]);

  const fitPoints = useMemo(() => {
    if (searchPin) return [searchPin.position];
    if (selected && plans[selected.id]) return plans[selected.id].path;
    return shipments.flatMap((s) => stopPoints(data, s));
  }, [selected, plans, shipments, data, searchPin]);

  const onMarkerClick = (id: string) => {
    const [kind, shipmentId] = id.split(":");
    if ((kind === "veh" || kind === "stop") && shipmentId) {
      setSearchPin(null);
      setChosenId(shipmentId);
    }
  };

  if (shipments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-display font-semibold text-cosmic-ink mb-1">Nenhuma rota em planejamento ou execução.</p>
          <p className="text-sm text-cosmic-ink/70 mb-4">
            As rotas aparecem aqui quando uma carga é contratada. Comece pelo planejamento.
          </p>
          <Link href="/planning" className="inline-block rounded-md bg-cosmic-ink text-milk-mustache text-sm font-medium px-4 py-2">
            Ir para o planejamento
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[300px_1fr_360px]">
      <RouteList shipments={shipments} selectedId={selectedId} onSelect={(id) => { setSearchPin(null); setChosenId(id); }} loadingIds={loadingIds} />

      <section className="relative min-h-[360px] bg-[#1b1b1b]" aria-label="Mapa operacional">
        <MapCanvas
          provider={mapProvider}
          scene={scene}
          fitKey={`${selectedId}:${Boolean(plans[selectedId ?? ""])}:${results[selectedId ?? ""]?.source ?? ""}:${searchPin?.label ?? ""}`}
          fitPoints={fitPoints}
          onMarkerClick={onMarkerClick}
          onHandle={setHandle}
          onStatus={setMapStatus}
        />
        <GeoSearch geocoder={geocoder} onPick={setSearchPin} />
        {mapStatus.kind === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80" role="status">
            Carregando mapa…
          </div>
        )}
        {mapStatus.kind === "fallback" && (
          <p className="absolute top-16 left-3 right-3 sm:right-auto sm:max-w-sm rounded-md bg-black/80 px-3 py-2 text-xs text-white" role="status">
            Mapa esquemático: {mapStatus.reason}
          </p>
        )}
        {mapStatus.kind === "ready" && mapStatus.provider === "schematic" && (
          <p className="absolute top-16 left-3 rounded-md bg-black/80 px-3 py-2 text-xs text-white">
            Mapa esquemático — configure GOOGLE_MAPS_API_KEY para o mapa real.
          </p>
        )}
        {clock && <SimulationControls clock={clock} tracking={tracking} selectedId={selectedId} hasTracked={trackedIds.length > 0} />}
      </section>

      {selected && (
        <RoutePanel
          shipment={selected}
          position={selectedPos}
          route={results[selected.id]}
          loading={loadingIds.includes(selected.id)}
        />
      )}
    </div>
  );
}

function RouteList({
  shipments,
  selectedId,
  onSelect,
  loadingIds,
}: {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loadingIds: string[];
}) {
  const { data } = useOperation();
  return (
    <nav aria-label="Rotas" className="border-b lg:border-b-0 lg:border-r border-cosmic-ink/10 overflow-y-auto max-h-56 lg:max-h-none">
      <p className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-cosmic-ink/70 border-b border-cosmic-ink/10">
        Rotas · {shipments.length}
      </p>
      <ul>
        {shipments.map((s) => {
          const vehicle = data.vehicles.find((v) => v.id === s.vehicleId);
          const carrier = data.carriers.find((c) => c.id === s.carrierId);
          const active = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(s.id)}
                className={`w-full text-left px-4 py-3 border-b border-cosmic-ink/5 transition-colors ${active ? "bg-cosmic-ink text-milk-mustache" : "hover:bg-cosmic-ink/5"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display font-medium text-sm">{s.routeCode ?? s.id}</span>
                  <StatusBadge status={s.status} />
                </span>
                <span className={`block text-xs mt-0.5 ${active ? "text-milk-mustache/80" : "text-cosmic-ink/70"}`}>
                  {s.id} · {s.stops.length - 1} {s.stops.length - 1 === 1 ? "entrega" : "entregas"} ·{" "}
                  {vehicle ? `${vehicle.id} (${vehicle.plate})` : carrier?.name ?? "—"}
                  {loadingIds.includes(s.id) && " · calculando…"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function RoutePanel({
  shipment,
  position,
  route,
  loading,
}: {
  shipment: Shipment;
  position: SimulationState | null;
  route?: { distanceMeters: number; durationSeconds: number; source: "google-routes" | "estimate" };
  loading: boolean;
}) {
  const { data } = useOperation();
  const vehicle = data.vehicles.find((v) => v.id === shipment.vehicleId);
  const driver = data.drivers.find((d) => d.id === shipment.driverId);
  const carrier = data.carriers.find((c) => c.id === shipment.carrierId);
  const tracked = TRACKED_STATUSES.includes(shipment.status);

  return (
    <aside aria-label={`Detalhes da rota ${shipment.routeCode ?? shipment.id}`} className="border-t lg:border-t-0 lg:border-l border-cosmic-ink/10 overflow-y-auto">
      <div className="px-5 py-4 border-b border-cosmic-ink/10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-semibold text-lg text-cosmic-ink">{shipment.routeCode ?? shipment.id}</h2>
          <StatusBadge status={shipment.status} />
        </div>
        <p className="text-xs text-cosmic-ink/70 mt-0.5">
          <Link href={`/shipments/${shipment.id}`} className="underline underline-offset-2">{shipment.id}</Link>
          {" · saída "}{hhmm(shipment.departureTime)}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-xs text-cosmic-ink/60">Veículo</dt><dd className="text-cosmic-ink">{vehicle ? `${vehicle.id} · ${vehicle.plate}` : "Da transportadora"}</dd></div>
          <div><dt className="text-xs text-cosmic-ink/60">Motorista</dt><dd className="text-cosmic-ink">{driver?.name ?? "—"}</dd></div>
          <div><dt className="text-xs text-cosmic-ink/60">Transportadora</dt><dd className="text-cosmic-ink">{carrier?.name ?? "Frota Própria"}</dd></div>
          <div>
            <dt className="text-xs text-cosmic-ink/60">Distância · Duração</dt>
            <dd className="text-cosmic-ink tabular">
              {route ? `${km(route.distanceMeters)} · ${duration(route.durationSeconds)}` : loading ? "Calculando…" : "—"}
            </dd>
          </div>
        </dl>
        {route && (
          <p className="mt-2 text-xs text-cosmic-ink/60">
            {route.source === "google-routes" ? "Rota calculada pelo Google Routes." : "Estimativa local (linha reta × fator de via) — provedor de rotas indisponível."}
          </p>
        )}
        {tracked && position && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-cosmic-ink/70">
              <span>Progresso {Math.round(position.progress * 100)}%</span>
              <span className="tabular">{position.finished ? "Rota concluída" : `${position.speedKmh} km/h`}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-cosmic-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position.progress * 100)} aria-label="Progresso da rota">
              <div className="h-full rounded-full bg-cosmic-ink" style={{ width: `${position.progress * 100}%` }} />
            </div>
          </div>
        )}
        {!tracked && <p className="mt-3 text-xs text-cosmic-ink/70">Viagem ainda não iniciada — sem rastreamento.</p>}
      </div>

      <ol className="px-5 py-3 space-y-3" aria-live="polite">
        {shipment.stops.map((stop, i) => {
          const loc = data.locations.find((l) => l.id === stop.locationId);
          const progress: StopProgress = position?.stopProgress[i] ?? (stop.actualTime ? "Entregue" : "Pendente");
          const eta = position?.etaByStop[i] ?? (progress === "Entregue" ? null : stop.plannedTime);
          const late = eta && stop.windowEnd && new Date(eta) > new Date(stop.windowEnd);
          return (
            <li key={stop.id} className="flex gap-3">
              <span
                aria-hidden
                className={`mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                  progress === "Entregue" ? "bg-emerald-700 border-emerald-700 text-white" : progress === "Chegou" || progress === "Em descarga" ? "bg-blue-700 border-blue-700 text-white" : progress === "Em rota" ? "border-cosmic-ink text-cosmic-ink" : "border-cosmic-ink/30 text-cosmic-ink/70"
                }`}
              >
                {i === 0 ? "CD" : i}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-cosmic-ink truncate">{loc?.name ?? stop.locationId}</p>
                <p className="text-xs text-cosmic-ink/70">
                  {i === 0 ? "Coleta" : progress}
                  {stop.windowStart && stop.windowEnd && ` · janela ${hhmm(stop.windowStart)}–${hhmm(stop.windowEnd)}`}
                </p>
              </div>
              <div className="text-right text-xs tabular shrink-0">
                {eta ? <span className={late ? "font-semibold text-red-700" : "text-cosmic-ink/80"}>ETA {hhmm(eta)}</span> : <span className="text-emerald-700">Atendida</span>}
                {late && <span className="block text-red-700">Fora da janela</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function SimulationControls({
  clock,
  tracking,
  selectedId,
  hasTracked,
}: {
  clock: ClockState;
  tracking: DemoTrackingProvider;
  selectedId: string | null;
  hasTracked: boolean;
}) {
  if (!hasTracked) return null;
  return (
    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 rounded-lg bg-black/85 px-3 py-2 text-white" role="group" aria-label="Controles da simulação">
      <span className="text-xs uppercase tracking-wider text-white/70 mr-1">Simulação</span>
      <button
        type="button"
        onClick={() => (clock.playing ? tracking.clock.pause() : tracking.clock.play())}
        aria-label={clock.playing ? "Pausar simulação" : "Iniciar simulação"}
        className="h-8 min-w-16 rounded-md bg-white text-cosmic-ink text-xs font-semibold px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {clock.playing ? "Pausar" : "Iniciar"}
      </button>
      <button
        type="button"
        onClick={() => tracking.resetTo(selectedId ?? undefined)}
        aria-label="Reiniciar simulação da rota selecionada"
        className="h-8 rounded-md border border-white/40 text-xs font-semibold px-3 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Reiniciar
      </button>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Velocidade">
        {SIMULATION_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            role="radio"
            aria-checked={clock.speed === speed}
            onClick={() => tracking.clock.setSpeed(speed)}
            className={`h-8 rounded-md px-2 text-xs font-semibold tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${clock.speed === speed ? "bg-white text-cosmic-ink" : "text-white/85 hover:bg-white/10"}`}
          >
            {speed}×
          </button>
        ))}
      </div>
      <span className="ml-auto text-xs tabular text-white/85" aria-live="off">
        {new Date(clock.simTimeMs).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ })}
        <span className="text-white/60"> · 1× = {BASE_RATE / 60} min/s</span>
      </span>
    </div>
  );
}

function GeoSearch({ geocoder, onPick }: { geocoder: HttpGeocodingProvider; onPick: (r: GeocodeResult) => void }) {
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
    <div className="absolute top-3 left-3 w-[min(320px,calc(100%-24px))]">
      <form onSubmit={search} role="search" className="flex rounded-md bg-white shadow-lg">
        <label htmlFor="geo-search" className="sr-only">Buscar endereço ou local</label>
        <input
          id="geo-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar endereço ou local"
          className="flex-1 min-w-0 rounded-l-md px-3 py-2 text-sm text-cosmic-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cosmic-ink"
        />
        <button type="submit" disabled={busy} className="rounded-r-md bg-cosmic-ink px-3 text-xs font-semibold text-white disabled:opacity-60">
          {busy ? "…" : "Buscar"}
        </button>
      </form>
      {results && (
        <ul className="mt-1 rounded-md bg-white shadow-lg text-sm divide-y divide-cosmic-ink/10">
          {results.length === 0 && <li className="px-3 py-2 text-cosmic-ink/70">Nada encontrado.</li>}
          {results.map((r) => (
            <li key={`${r.label}-${r.position.lat}`}>
              <button type="button" className="w-full text-left px-3 py-2 hover:bg-cosmic-ink/5" onClick={() => { onPick(r); setResults(null); }}>
                {r.label}
                <span className="block text-xs text-cosmic-ink/60">{r.source === "catalog" ? "Cadastro da operação" : "Google"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
