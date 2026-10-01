"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Crosshair, LocateFixed, Minus, Plus, Scan, Layers } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { useLive } from "@/components/live/LiveOperation";
import { useMapConfig } from "@/components/shell/AppShell";
import { IconButton, Popover, Tooltip, Spinner } from "@/components/ds";
import { MapCanvas, type MapStatus } from "./MapCanvas";
import { stopPoints } from "./useRoutePlans";
import { GoogleMapProvider } from "@/lib/geo/google/map-provider";
import { SchematicMapProvider } from "@/lib/geo/schematic/map-provider";
import { splitPathAt, lerpAngle } from "@/lib/geo/polyline";
import { markerSvg } from "@/lib/geo/marker-style";
import type { GeoPoint, MapHandle, MapMarker, MapProvider, MapScene } from "@/lib/geo/types";
import type { TripStopState } from "@/lib/ui/trip";
import { cn } from "@/lib/ui/cn";

// O MAPA É O ESPAÇO OPERACIONAL.
// Componente único usado no Command Center, no Mapa e na Viagem. Lê a mesma
// operação ao vivo (useLive) que painéis e filas — seleção, ETA e estado das
// paradas são sempre os mesmos em todas as regiões da tela.

const STOP_MARKER: Record<TripStopState, MapMarker["state"]> = {
  done: "done",
  active: "active",
  pending: "pending",
  late: "late",
  risk: "risk",
  issue: "exception",
};

export interface OperationalMapProps {
  selectedId: string | null;
  onSelect: (shipmentId: string | null) => void;
  selectedStop?: number | null;
  onStopSelect?: (shipmentId: string, index: number) => void;
  /** Viagens em destaque (filtro atual). As demais ficam esmaecidas. null = todas. */
  focusIds?: Set<string> | null;
  /** Só a viagem selecionada (tela da viagem). */
  only?: string;
  /** Pino de busca de endereço. */
  pin?: { position: GeoPoint; label: string } | null;
  children?: ReactNode;
  className?: string;
  label?: string;
  controlsPosition?: "right" | "left";
}

export function OperationalMap({
  selectedId,
  onSelect,
  selectedStop = null,
  onStopSelect,
  focusIds = null,
  only,
  pin = null,
  children,
  className,
  label = "Mapa operacional",
  controlsPosition = "right",
}: OperationalMapProps) {
  const { data } = useOperation();
  const live = useLive();
  const mapConfig = useMapConfig();
  const [provider] = useState<MapProvider>(() => (mapConfig ? new GoogleMapProvider(mapConfig.apiKey, mapConfig.mapId) : new SchematicMapProvider()));
  const [handle, setHandle] = useState<MapHandle | null>(null);
  const [status, setStatus] = useState<MapStatus>({ kind: "loading" });
  const [follow, setFollow] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);

  const shipments = useMemo(() => (only ? live.shipments.filter((s) => s.id === only) : live.shipments), [live.shipments, only]);
  const selected = shipments.find((s) => s.id === selectedId) ?? null;
  const tracked = useMemo(() => new Set(live.trackedIds), [live.trackedIds]);

  // Cena (~4 Hz): linhas, paradas, veículos e estados. Veículos andam por quadro via moveMarkers.
  const scene = useMemo<MapScene>(() => {
    const markers: MapMarker[] = [];
    const polylines: MapScene["polylines"] = [];
    for (const s of shipments) {
      const plan = live.plans[s.id];
      if (!plan) continue;
      const inFocus = !focusIds || focusIds.has(s.id);
      if (s.id === selectedId) {
        const pos = live.positions.get(s.id);
        if (pos && tracked.has(s.id) && pos.progress > 0) {
          const { done, remaining } = splitPathAt(plan.path, pos.position);
          polylines.push({ id: `done:${s.id}`, path: done, kind: "route-done" });
          polylines.push({ id: `route:${s.id}`, path: remaining, kind: "route" });
        } else polylines.push({ id: `route:${s.id}`, path: plan.path, kind: "route" });
      } else if (inFocus) polylines.push({ id: `muted:${s.id}`, path: plan.path, kind: "route-muted" });
    }
    if (selected) {
      const trip = live.trips.get(selected.id);
      const points = stopPoints(data, selected);
      selected.stops.forEach((stop, i) => {
        const read = trip?.stops[i];
        const loc = data.locations.find((l) => l.id === stop.locationId);
        const state = read ? STOP_MARKER[read.state] : "pending";
        const showCaption = i === selectedStop || read?.state === "active" || read?.state === "late" || read?.state === "issue" || i === selected.stops.length - 1;
        markers.push({
          id: `stop:${selected.id}:${i}`,
          position: points[i],
          kind: i === 0 ? "origin" : "stop",
          label: String(i),
          title: `${i === 0 ? "Origem" : `Parada ${i}`} — ${loc?.name ?? stop.locationId}${read ? ` (${read.state === "done" ? "concluída" : read.state === "late" ? `atrasada ${read.delayMin} min` : read.state === "risk" ? "em risco" : read.state === "active" ? "próxima" : read.state === "issue" ? "com ocorrência" : "pendente"})` : ""}`,
          state,
          selected: i === selectedStop,
          caption: showCaption ? loc?.name : undefined,
        });
      });
    }
    if (!selected) {
      // Visão de rede: CDs de origem rotulados, para dar geografia ao mapa.
      const seen = new Set<string>();
      for (const s of shipments) {
        if (!live.plans[s.id] || seen.has(s.originId) || (focusIds && !focusIds.has(s.id))) continue;
        seen.add(s.originId);
        const loc = data.locations.find((l) => l.id === s.originId);
        if (!loc) continue;
        markers.push({ id: `origin:${s.originId}`, position: { lat: loc.lat, lng: loc.lng }, kind: "origin", title: loc.name, caption: loc.name });
      }
    }
    for (const id of live.trackedIds) {
      const s = shipments.find((x) => x.id === id);
      const p = live.tracking.getSnapshot().find((x) => x.shipmentId === id);
      if (!s || !p) continue;
      const trip = live.trips.get(id);
      const vehicle = data.vehicles.find((v) => v.id === s.vehicleId);
      const isSel = id === selectedId;
      markers.push({
        id: `veh:${id}`,
        position: p.position,
        kind: "vehicle",
        title: `Veículo ${vehicle ? `${vehicle.id} (${vehicle.plate})` : "da transportadora"} — ${s.routeCode ?? s.id}${trip?.health === "late" ? " — atrasado" : trip?.health === "exception" ? " — com ocorrência" : ""}`,
        headingDeg: p.headingDeg,
        selected: isSel,
        state: trip?.health === "exception" ? "exception" : trip?.health === "late" ? "late" : undefined,
        caption: isSel ? `${vehicle?.plate ?? s.routeCode ?? s.id} · ${p.finished ? "concluída" : `${p.speedKmh} km/h`}` : !selectedId ? (s.routeCode ?? s.id) : undefined,
        muted: !!focusIds && !focusIds.has(id),
      });
    }
    if (pin) markers.push({ id: "search", position: pin.position, kind: "destination", label: "★", title: pin.label, caption: pin.label });
    return { markers, polylines };
    // live.positions entra para atualizar estado/legenda; posições finas vêm do moveMarkers.
  }, [shipments, live.plans, live.positions, live.trips, live.trackedIds, live.tracking, selected, selectedId, selectedStop, focusIds, tracked, data, pin]);

  // Movimento contínuo do veículo, fora do React; heading suavizado (sem saltos).
  const headings = useRef(new Map<string, number>());
  useEffect(() => {
    if (!handle) return;
    return live.tracking.subscribe((positions) => {
      handle.moveMarkers(
        positions
          .filter((p) => !only || p.shipmentId === only)
          .map((p) => {
            const prev = headings.current.get(p.shipmentId);
            const h = prev === undefined ? p.headingDeg : lerpAngle(prev, p.headingDeg, 0.18);
            headings.current.set(p.shipmentId, h);
            return { id: `veh:${p.shipmentId}`, position: p.position, headingDeg: h };
          })
      );
    });
  }, [handle, live.tracking, only]);

  // Seguir veículo.
  const canFollow = !!selected && tracked.has(selected.id);
  useEffect(() => {
    if (!handle?.panTo || !follow || !canFollow || !selectedId) return;
    const tick = () => {
      const p = live.tracking.getSnapshot().find((x) => x.shipmentId === selectedId);
      if (p) handle.panTo?.(p.position);
    };
    tick();
    const timer = setInterval(tick, 900);
    return () => clearInterval(timer);
  }, [handle, follow, canFollow, selectedId, live.tracking]);

  // Enquadramento automático: muda com a seleção (não a cada quadro).
  const fitPoints = useMemo(() => {
    if (pin) return [pin.position];
    if (selected && live.plans[selected.id]) return live.plans[selected.id].path;
    const focus = focusIds ? shipments.filter((s) => focusIds.has(s.id)) : shipments;
    return (focus.length ? focus : shipments).flatMap((s) => stopPoints(data, s));
  }, [pin, selected, live.plans, shipments, focusIds, data]);
  const hasPlan = selected ? Boolean(live.plans[selected.id]) : shipments.some((s) => live.plans[s.id]);
  const focusKey = focusIds ? [...focusIds].sort().join(",") : "all";
  const fitKey = `${selectedId}:${hasPlan}:${live.routes[selectedId ?? ""]?.source ?? ""}:${pin?.label ?? ""}:${selectedId ? "" : focusKey}:${fitNonce}`;

  const onMarkerClick = (id: string) => {
    const [kind, shipmentId, idx] = id.split(":");
    if (kind === "veh" && shipmentId) {
      setFollow(false);
      onSelect(shipmentId);
    } else if (kind === "stop" && shipmentId) {
      onSelect(shipmentId);
      onStopSelect?.(shipmentId, Number(idx));
    }
  };

  return (
    <section aria-label={label} className={cn("relative isolate min-h-0 overflow-hidden bg-[var(--orb-map-land)]", className)}>
      <MapCanvas provider={provider} scene={scene} fitKey={fitKey} fitPoints={fitPoints} onMarkerClick={onMarkerClick} onHandle={setHandle} onStatus={setStatus} />

      {status.kind === "loading" && (
        <div className="absolute inset-0 grid place-items-center" role="status">
          <span className="flex items-center gap-2 rounded-md bg-surface/90 px-3 py-2 text-body-sm text-fg-muted shadow-2">
            <Spinner /> Carregando mapa…
          </span>
        </div>
      )}

      <div className={cn("absolute bottom-3 z-10 flex flex-col gap-1.5 md:bottom-auto md:top-1/2 md:-translate-y-1/2", controlsPosition === "right" ? "right-3" : "left-3")}>
        <div className="flex flex-col overflow-hidden rounded-md border border-line-subtle bg-surface shadow-2">
          <IconButton size="md" label="Aproximar" icon={<Plus className="size-4" />} onClick={() => handle?.zoomBy?.(1)} className="rounded-none" />
          <span aria-hidden className="h-px bg-line-subtle" />
          <IconButton size="md" label="Afastar" icon={<Minus className="size-4" />} onClick={() => handle?.zoomBy?.(-1)} className="rounded-none" />
        </div>
        <div className="flex flex-col overflow-hidden rounded-md border border-line-subtle bg-surface shadow-2">
          <IconButton
            label="Enquadrar"
            icon={<Scan className="size-4" />}
            onClick={() => {
              setFollow(false);
              setFitNonce((n) => n + 1);
            }}
            className="rounded-none"
          />
          <span aria-hidden className="h-px bg-line-subtle" />
          <IconButton
            label={follow ? "Parar de seguir o veículo" : "Seguir veículo"}
            icon={follow ? <LocateFixed className="size-4" /> : <Crosshair className="size-4" />}
            selected={follow}
            disabled={!canFollow}
            onClick={() => setFollow((f) => !f)}
            className="rounded-none aria-pressed:border-transparent"
          />
          <span aria-hidden className="h-px bg-line-subtle" />
          <Legend />
        </div>
      </div>

      {(status.kind === "fallback" || (status.kind === "ready" && status.provider === "schematic")) && (
        <Tooltip
          side="top"
          content={status.kind === "fallback" ? `Mapa esquemático: ${status.reason}` : "Configure GOOGLE_MAPS_API_KEY para o mapa real. Rotas, ETAs e simulação funcionam igual."}
        >
          <span tabIndex={0} className="absolute bottom-3 left-3 z-10 hidden rounded-sm border border-line-subtle bg-surface/90 px-2 py-1 text-caption text-fg-muted shadow-1 md:inline">
            Mapa esquemático
          </span>
        </Tooltip>
      )}

      {children}
    </section>
  );
}

function Legend() {
  const items: { label: string; marker: MapMarker }[] = [
    { label: "Veículo", marker: { id: "l1", kind: "vehicle", position: { lat: 0, lng: 0 }, title: "", headingDeg: 45 } },
    { label: "Origem (CD)", marker: { id: "l2", kind: "origin", position: { lat: 0, lng: 0 }, title: "" } },
    { label: "Próxima parada", marker: { id: "l3", kind: "stop", position: { lat: 0, lng: 0 }, title: "", state: "active", label: "2" } },
    { label: "Pendente", marker: { id: "l4", kind: "stop", position: { lat: 0, lng: 0 }, title: "", state: "pending", label: "3" } },
    { label: "Concluída", marker: { id: "l5", kind: "stop", position: { lat: 0, lng: 0 }, title: "", state: "done" } },
    { label: "Em risco (folga ≤ 15 min)", marker: { id: "l6", kind: "stop", position: { lat: 0, lng: 0 }, title: "", state: "risk", label: "4" } },
    { label: "Atrasada (ETA após a janela)", marker: { id: "l7", kind: "stop", position: { lat: 0, lng: 0 }, title: "", state: "late", label: "5" } },
    { label: "Com ocorrência", marker: { id: "l8", kind: "stop", position: { lat: 0, lng: 0 }, title: "", state: "exception", label: "6" } },
  ];
  return (
    <Popover label="Legenda do mapa" align="end" className="w-64 p-3" trigger={<IconButton label="Legenda" icon={<Layers className="size-4" />} className="rounded-none" />}>
      <p className="mb-2 text-h3 text-fg">Legenda</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2.5 text-body-sm text-fg">
            <svg width="30" height="30" viewBox="-15 -15 30 30" aria-hidden className="shrink-0 overflow-visible" dangerouslySetInnerHTML={{ __html: markerSvg(it.marker).replace('class="orb-marker-pulse"', "") }} />
            {it.label}
          </li>
        ))}
        <li className="flex items-center gap-2.5 text-body-sm text-fg">
          <span aria-hidden className="h-1.5 w-7 rounded-full bg-route" /> Rota selecionada
        </li>
        <li className="flex items-center gap-2.5 text-body-sm text-fg">
          <span aria-hidden className="h-1.5 w-7 rounded-full bg-route-done" /> Trecho percorrido
        </li>
        <li className="flex items-center gap-2.5 text-body-sm text-fg">
          <span aria-hidden className="h-1 w-7 rounded-full bg-route-muted" /> Outras rotas
        </li>
      </ul>
    </Popover>
  );
}
