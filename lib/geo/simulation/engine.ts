import { haversineKm } from "../../domain/geo";
import type { GeoPoint, StopProgress, VehiclePosition } from "../types";

// Motor de simulação de rota — função PURA do tempo:
//   estado(t) = f(plano da rota, t)
// Mesmo t → mesmo estado. Reiniciar = voltar t a zero; velocidade = quanto t
// avança por segundo real (ver SimulationClock). Mapa, linha do tempo, ETA e
// painel leem este mesmo estado — sincronizados por construção.

export interface RoutePlan {
  shipmentId: string;
  vehicleId?: string;
  departure: string; // ISO
  path: GeoPoint[];
  /** Índice em `path` de cada parada (a primeira é a origem, índice 0). */
  stopPathIndex: number[];
  /** Duração de cada perna (parada i → i+1), em segundos. */
  legDurationsSec: number[];
  /** Tempo de atendimento em cada parada, em segundos (origem normalmente 0). */
  serviceSec: number[];
}

/** Fração do atendimento considerada "Chegou" antes de virar "Em descarga". */
const ARRIVAL_SHARE = 0.15;

function cumulativeKm(path: GeoPoint[]): number[] {
  const acc = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + haversineKm(path[i - 1], path[i]));
  return acc;
}

function bearing(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Ponto do caminho a `km` quilômetros do início (interpolação linear). */
function pointAtKm(path: GeoPoint[], cum: number[], km: number): { point: GeoPoint; heading: number } {
  if (km <= 0) return { point: path[0], heading: path.length > 1 ? bearing(path[0], path[1]) : 0 };
  const total = cum[cum.length - 1];
  if (km >= total) {
    const n = path.length;
    return { point: path[n - 1], heading: n > 1 ? bearing(path[n - 2], path[n - 1]) : 0 };
  }
  let i = 1;
  while (cum[i] < km) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const f = (km - cum[i - 1]) / seg;
  const a = path[i - 1];
  const b = path[i];
  return { point: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }, heading: bearing(a, b) };
}

/** Liga cada parada ao ponto mais próximo do caminho, respeitando a ordem. */
export function snapStopsToPath(path: GeoPoint[], stops: GeoPoint[]): number[] {
  const indices: number[] = [];
  let from = 0;
  stops.forEach((stop, s) => {
    if (s === 0) {
      indices.push(0);
      return;
    }
    if (s === stops.length - 1) {
      indices.push(path.length - 1);
      return;
    }
    let best = from;
    let bestD = Infinity;
    for (let i = from; i < path.length; i++) {
      const d = haversineKm(path[i], stop);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    indices.push(best);
    from = best;
  });
  return indices;
}

export interface SimulationState extends VehiclePosition {
  elapsedSec: number;
  totalSec: number;
  finished: boolean;
  /** Parada em foco (a próxima a ser atendida, ou a atual). */
  activeStopIndex: number;
}

export function totalDurationSec(plan: RoutePlan): number {
  return plan.legDurationsSec.reduce((s, d) => s + d, 0) + plan.serviceSec.slice(1).reduce((s, d) => s + d, 0);
}

export function simulate(plan: RoutePlan, elapsedSecRaw: number): SimulationState {
  const cum = cumulativeKm(plan.path);
  const totalKm = cum[cum.length - 1] || 0;
  const stopKm = plan.stopPathIndex.map((i) => cum[i]);
  const nStops = plan.stopPathIndex.length;
  const totalSec = totalDurationSec(plan);
  const elapsedSec = Math.max(0, Math.min(elapsedSecRaw, totalSec));
  const departureMs = new Date(plan.departure).getTime();

  const stopProgress: StopProgress[] = Array(nStops).fill("Pendente");
  stopProgress[0] = "Entregue"; // origem: coleta concluída na saída
  const arrivalSec: number[] = [0];
  let t = 0;
  for (let leg = 0; leg < nStops - 1; leg++) {
    t += plan.legDurationsSec[leg];
    arrivalSec.push(t);
    t += plan.serviceSec[leg + 1] ?? 0;
  }

  let km = 0;
  let speedKmh = 0;
  let activeStopIndex = nStops - 1;
  let cursor = 0;
  for (let leg = 0; leg < nStops - 1; leg++) {
    const travel = plan.legDurationsSec[leg];
    const service = plan.serviceSec[leg + 1] ?? 0;
    const target = leg + 1;
    if (elapsedSec < cursor + travel) {
      const f = travel > 0 ? (elapsedSec - cursor) / travel : 1;
      km = stopKm[leg] + (stopKm[target] - stopKm[leg]) * f;
      speedKmh = travel > 0 ? ((stopKm[target] - stopKm[leg]) / travel) * 3600 : 0;
      stopProgress[target] = "Em rota";
      activeStopIndex = target;
      break;
    }
    cursor += travel;
    km = stopKm[target];
    if (elapsedSec < cursor + service) {
      stopProgress[target] = elapsedSec - cursor < service * ARRIVAL_SHARE ? "Chegou" : "Em descarga";
      activeStopIndex = target;
      break;
    }
    cursor += service;
    stopProgress[target] = "Entregue";
  }

  const { point, heading } = pointAtKm(plan.path, cum, km);
  const finished = elapsedSec >= totalSec;
  return {
    shipmentId: plan.shipmentId,
    vehicleId: plan.vehicleId,
    position: point,
    headingDeg: Math.round(heading),
    speedKmh: finished ? 0 : Math.round(speedKmh),
    progress: totalKm > 0 ? Math.min(1, km / totalKm) : finished ? 1 : 0,
    stopProgress,
    etaByStop: arrivalSec.map((s, i) =>
      stopProgress[i] === "Entregue" ? null : new Date(departureMs + s * 1000).toISOString()
    ),
    recordedAt: new Date(departureMs + elapsedSec * 1000).toISOString(),
    source: "demo",
    elapsedSec,
    totalSec,
    finished,
    activeStopIndex,
  };
}
