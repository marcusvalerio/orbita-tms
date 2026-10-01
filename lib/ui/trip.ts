import type { OperationDataset, Shipment } from "@/lib/domain/types";
import type { StopProgress, VehiclePosition } from "@/lib/geo/types";

// Leitura operacional de uma viagem: estado de cada parada (concluída, ativa,
// em risco, atrasada, com ocorrência), ETA × janela e atraso projetado.
// Pura e determinística: a mesma entrada (viagem + posição + instante) dá a
// mesma saída. Usada por mapa, timeline, painéis, filtros e Attention Score.

export type TripStopState = "done" | "active" | "pending" | "late" | "risk" | "issue";

/** Margem antes do fim da janela que já conta como "em risco". */
export const RISK_MARGIN_MIN = 15;

export interface TripStop {
  index: number;
  locationId: string;
  name: string;
  city?: string;
  kind: "Coleta" | "Entrega";
  windowStart?: string;
  windowEnd?: string;
  plannedTime: string;
  actualTime?: string;
  eta: string | null;
  progress: StopProgress | "Pendente";
  state: TripStopState;
  /** Minutos além do fim da janela (0 quando dentro). */
  delayMin: number;
  /** Minutos de folga até o fim da janela (negativo = atrasada). */
  slackMin: number | null;
  orderIds: string[];
}

export type TripHealth = "exception" | "late" | "risk" | "ok" | "done" | "idle";

export interface TripReading {
  shipment: Shipment;
  tracked: boolean;
  stops: TripStop[];
  activeIndex: number;
  progress: number;
  speedKmh: number | null;
  headingDeg: number | null;
  finalEta: string | null;
  /** Maior atraso projetado entre paradas não atendidas. */
  maxDelayMin: number;
  lateStops: number;
  riskStops: number;
  doneStops: number;
  health: TripHealth;
  openOccurrenceIds: string[];
}

const TRACKED: Shipment["status"][] = ["In Transit", "At Delivery", "Exception", "Pickup Completed"];
const FINISHED: Shipment["status"][] = ["Delivered", "Closed"];

export const isTracked = (s: Shipment) => TRACKED.includes(s.status);
export const isFinished = (s: Shipment) => FINISHED.includes(s.status);

const minutes = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / 60000;

export function readTrip(data: OperationDataset, shipment: Shipment, position: VehiclePosition | null): TripReading {
  const tracked = isTracked(shipment) && !!position;
  const finished = isFinished(shipment);
  const openOccurrenceIds = data.occurrences.filter((o) => shipment.occurrenceIds.includes(o.id) && !o.resolved).map((o) => o.id);
  const exception = shipment.status === "Exception" || openOccurrenceIds.length > 0;

  const progressOf = (i: number): StopProgress | "Pendente" => {
    if (finished) return "Entregue";
    if (tracked) return position!.stopProgress[i] ?? "Pendente";
    if (shipment.stops[i].actualTime) return "Entregue";
    if (i === 0 && shipment.status !== "Planned" && shipment.status !== "Awaiting Pickup") return "Entregue";
    return "Pendente";
  };

  const firstOpen = shipment.stops.findIndex((_, i) => progressOf(i) !== "Entregue");
  const activeIndex = firstOpen === -1 ? shipment.stops.length - 1 : firstOpen;

  const stops: TripStop[] = shipment.stops.map((st, i) => {
    const loc = data.locations.find((l) => l.id === st.locationId);
    const progress = progressOf(i);
    const done = progress === "Entregue";
    const eta = done ? null : tracked ? position!.etaByStop[i] : st.plannedTime;
    const slackMin = eta && st.windowEnd ? Math.round(minutes(st.windowEnd, eta)) : null;
    const delayMin = slackMin !== null && slackMin < 0 ? -slackMin : 0;
    let state: TripStopState;
    if (done) state = "done";
    else if (exception && i === activeIndex) state = "issue";
    else if (delayMin > 0) state = "late";
    else if (slackMin !== null && slackMin <= RISK_MARGIN_MIN && i > 0) state = "risk";
    else if (i === activeIndex && (tracked || shipment.status !== "Planned")) state = "active";
    else state = "pending";
    return {
      index: i,
      locationId: st.locationId,
      name: loc?.name ?? st.locationId,
      city: loc?.city,
      kind: st.kind,
      windowStart: st.windowStart,
      windowEnd: st.windowEnd,
      plannedTime: st.plannedTime,
      actualTime: st.actualTime,
      eta,
      progress,
      state,
      delayMin,
      slackMin,
      orderIds: st.orderIds ?? [],
    };
  });

  const open = stops.filter((s) => s.state !== "done");
  const lateStops = open.filter((s) => s.state === "late" || (s.state === "issue" && s.delayMin > 0)).length;
  const riskStops = open.filter((s) => s.state === "risk").length;
  const maxDelayMin = Math.max(0, ...open.map((s) => s.delayMin));
  const health: TripHealth = finished
    ? "done"
    : exception
      ? "exception"
      : lateStops > 0
        ? "late"
        : riskStops > 0
          ? "risk"
          : tracked || shipment.status !== "Planned"
            ? "ok"
            : "idle";

  return {
    shipment,
    tracked,
    stops,
    activeIndex,
    progress: finished ? 1 : tracked ? position!.progress : 0,
    speedKmh: tracked ? position!.speedKmh : null,
    headingDeg: tracked ? position!.headingDeg : null,
    finalEta: open.length ? open[open.length - 1].eta : null,
    maxDelayMin,
    lateStops,
    riskStops,
    doneStops: stops.length - open.length,
    health,
    openOccurrenceIds,
  };
}

/** Posição relativa (0–1) de cada parada ao longo da rota, para a TripProgress. */
export function stopFractions(shipment: Shipment): number[] {
  const t0 = new Date(shipment.stops[0]?.plannedTime ?? shipment.departureTime).getTime();
  const t1 = new Date(shipment.stops[shipment.stops.length - 1]?.plannedTime ?? shipment.etaTime).getTime();
  const span = Math.max(1, t1 - t0);
  return shipment.stops.map((s) => Math.max(0, Math.min(1, (new Date(s.plannedTime).getTime() - t0) / span)));
}

export const hhmm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";

export const windowLabel = (s: { windowStart?: string; windowEnd?: string }) =>
  s.windowStart && s.windowEnd ? `${hhmm(s.windowStart)}–${hhmm(s.windowEnd)}` : null;

export const fmtKm = (meters: number) => `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};
