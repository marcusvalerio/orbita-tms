import { getGoogleMapsServerKey } from "@/lib/config/runtime";
import { GoogleGeocodingProvider } from "@/lib/geo/google/geocoding";
import { TtlCache } from "@/lib/geo/server/guards";
import { authorizeGeoRequest } from "@/lib/geo/server/access";
import type { GeocodeResult } from "@/lib/geo/types";

// GET /api/geo/geocode?q=endereço — Google Geocoding (Brasil), no servidor.
// 503 quando o provedor não está disponível: o cliente recorre ao catálogo local.

const cache = new TtlCache<GeocodeResult[]>(24 * 60 * 60 * 1000);

export async function GET(request: Request) {
  const access = await authorizeGeoRequest();
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) return Response.json({ error: "Informe de 3 a 200 caracteres." }, { status: 400 });

  const cached = cache.get(q.toLowerCase());
  if (cached) return Response.json({ results: cached });

  const apiKey = getGoogleMapsServerKey(); // nunca a chave de navegador
  if (!apiKey) return Response.json({ error: "Geocodificação não configurada." }, { status: 503 });
  try {
    const results = await new GoogleGeocodingProvider(apiKey).geocode(q);
    cache.set(q.toLowerCase(), results);
    return Response.json({ results });
  } catch (err) {
    console.warn("[geo] Geocoding indisponível:", (err as Error).message);
    return Response.json({ error: "Geocodificação indisponível no momento." }, { status: 503 });
  }
}
