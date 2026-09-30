import { getGoogleMapsServerKey, getGoogleMapsBrowserKey } from "@/lib/config/runtime";
import { GoogleRoutesProvider, MAX_INTERMEDIATES } from "@/lib/geo/google/routes";
import { estimateRoute } from "@/lib/geo/estimate";
import { TtlCache, parseStops } from "@/lib/geo/server/guards";
import { authorizeGeoRequest } from "@/lib/geo/server/access";
import type { RouteResult } from "@/lib/geo/types";

// POST /api/geo/route  { stops: [{lat,lng}, …], departureTime? }
// Calcula a rota no servidor (Google Routes API). Sem chave de servidor ou
// com falha do provedor, devolve uma estimativa — marcada em `source`.

const cache = new TtlCache<RouteResult>(60 * 60 * 1000);

function serverKey(): string | null {
  // Modo Produção exige GOOGLE_MAPS_SERVER_API_KEY (restrita por API, sem
  // referrer). No Modo Demo, aceita a chave única de desenvolvimento.
  return getGoogleMapsServerKey() ?? (process.env.ORBITA_MODE !== "production" ? getGoogleMapsBrowserKey() : null);
}

export async function POST(request: Request) {
  const access = await authorizeGeoRequest();
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => null);
  const stops = parseStops(body?.stops, MAX_INTERMEDIATES + 2);
  if (!stops) return Response.json({ error: "Paradas inválidas (2 a 27 coordenadas no Brasil)." }, { status: 400 });

  const key = JSON.stringify(stops);
  const cached = cache.get(key);
  if (cached) return Response.json(cached, { headers: { "x-orbita-cache": "hit" } });

  const apiKey = serverKey();
  let result: RouteResult;
  if (apiKey) {
    try {
      result = await new GoogleRoutesProvider(apiKey).computeRoute(stops, { departureTime: body?.departureTime });
    } catch (err) {
      console.warn("[geo] Routes API indisponível, usando estimativa:", (err as Error).message);
      result = estimateRoute(stops);
    }
  } else {
    result = estimateRoute(stops);
  }
  if (result.source === "google-routes") cache.set(key, result);
  return Response.json(result);
}
