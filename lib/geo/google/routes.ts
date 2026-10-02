import { decodePolyline } from "../polyline";
import type { GeoPoint, RouteProvider, RouteResult } from "../types";

// Adapter SERVER-SIDE do Google Routes API (computeRoutes).
// Chave própria de servidor; nunca vai ao navegador.
// https://developers.google.com/maps/documentation/routes/compute_route_directions

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration";
export const MAX_INTERMEDIATES = 25; // limite do Routes API para rotas com paradas intermediárias

export class RouteProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "RouteProviderError";
  }
}

const waypoint = (p: GeoPoint) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
const seconds = (d: string | undefined) => (d ? Number(d.replace(/s$/, "")) : 0);

export class GoogleRoutesProvider implements RouteProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async computeRoute(stops: GeoPoint[], options?: { departureTime?: string }): Promise<RouteResult> {
    if (stops.length < 2) throw new RouteProviderError("Uma rota precisa de pelo menos duas paradas.");
    if (stops.length - 2 > MAX_INTERMEDIATES) throw new RouteProviderError("Paradas demais para uma única rota.");

    const future = options?.departureTime && new Date(options.departureTime).getTime() > Date.now() + 60_000;
    const body = {
      origin: waypoint(stops[0]),
      destination: waypoint(stops[stops.length - 1]),
      intermediates: stops.slice(1, -1).map(waypoint),
      travelMode: "DRIVE",
      // Com horário de saída futuro, considera o trânsito previsto.
      routingPreference: future ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
      ...(future ? { departureTime: options!.departureTime } : {}),
      languageCode: "pt-BR",
      units: "METRIC",
    };

    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new RouteProviderError(`Routes API respondeu ${res.status}: ${detail.slice(0, 200)}`, res.status);
    }
    const json = (await res.json()) as {
      routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string }; legs?: { distanceMeters?: number; duration?: string }[] }[];
    };
    const route = json.routes?.[0];
    if (!route?.polyline?.encodedPolyline) throw new RouteProviderError("Nenhuma rota encontrada entre as paradas.");

    return {
      path: decodePolyline(route.polyline.encodedPolyline),
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: seconds(route.duration),
      legs: (route.legs ?? []).map((l) => ({ distanceMeters: l.distanceMeters ?? 0, durationSeconds: seconds(l.duration) })),
      source: "google-routes",
    };
  }
}
