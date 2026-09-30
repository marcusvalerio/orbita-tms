import { estimateRoute } from "../estimate";
import type { GeocodeResult, GeocodingProvider, GeoPoint, RouteProvider, RouteResult } from "../types";

/** RouteProvider do navegador: pede ao servidor (que guarda a chave) e cai para estimativa local se falhar. */
export class HttpRouteProvider implements RouteProvider {
  async computeRoute(stops: GeoPoint[], options?: { departureTime?: string }): Promise<RouteResult> {
    try {
      const res = await fetch("/api/geo/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops, departureTime: options?.departureTime }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as RouteResult;
    } catch {
      return estimateRoute(stops);
    }
  }
}

/** GeocodingProvider do navegador com fallback para outro provedor (ex.: catálogo local). */
export class HttpGeocodingProvider implements GeocodingProvider {
  constructor(private readonly fallback: GeocodingProvider) {}

  async geocode(query: string): Promise<GeocodeResult[]> {
    try {
      const res = await fetch(`/api/geo/geocode?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(String(res.status));
      const { results } = (await res.json()) as { results: GeocodeResult[] };
      return results.length > 0 ? results : this.fallback.geocode(query);
    } catch {
      return this.fallback.geocode(query);
    }
  }
}
