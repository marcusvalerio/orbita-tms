import { estimateLeg, haversineKm } from "../domain/geo";
import type { GeoPoint, RouteProvider, RouteResult } from "./types";

/**
 * Rota estimada, sem rede: segmentos entre paradas (densificados para a
 * animação), distância pela via ≈ linha reta × fator de sinuosidade e
 * velocidade média de planejamento. Fallback quando o provedor real não está
 * configurado ou falha — a interface sinaliza "estimativa".
 */
export class EstimatedRouteProvider implements RouteProvider {
  async computeRoute(stops: GeoPoint[]): Promise<RouteResult> {
    return estimateRoute(stops);
  }
}

export function estimateRoute(stops: GeoPoint[]): RouteResult {
  if (stops.length < 2) throw new Error("Uma rota precisa de pelo menos duas paradas.");
  const path: GeoPoint[] = [stops[0]];
  const legs = stops.slice(1).map((to, i) => {
    const from = stops[i];
    const steps = Math.max(2, Math.ceil(haversineKm(from, to) / 0.5)); // um ponto a cada ~500 m
    for (let s = 1; s <= steps; s++) {
      path.push({ lat: from.lat + ((to.lat - from.lat) * s) / steps, lng: from.lng + ((to.lng - from.lng) * s) / steps });
    }
    const leg = estimateLeg(from, to);
    return { distanceMeters: Math.round(leg.distanceKm * 1000), durationSeconds: leg.durationMin * 60 };
  });
  return {
    path,
    legs,
    distanceMeters: legs.reduce((s, l) => s + l.distanceMeters, 0),
    durationSeconds: legs.reduce((s, l) => s + l.durationSeconds, 0),
    source: "estimate",
  };
}
