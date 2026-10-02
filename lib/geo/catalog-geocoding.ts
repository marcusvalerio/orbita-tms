import type { Location } from "../domain/types";
import type { GeocodeResult, GeocodingProvider } from "./types";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Geocodificação pelo cadastro de locais da própria operação — sem rede.
 * Fallback do Modo Demo e quando o Geocoding API não está habilitado.
 */
export class CatalogGeocodingProvider implements GeocodingProvider {
  constructor(private readonly locations: Location[]) {}

  async geocode(query: string): Promise<GeocodeResult[]> {
    const q = normalize(query);
    if (!q) return [];
    return this.locations
      .filter((l) => normalize(`${l.name} ${l.city} ${l.state} ${l.address ?? ""}`).includes(q))
      .slice(0, 5)
      .map((l) => ({ label: `${l.name} — ${l.city}/${l.state}`, position: { lat: l.lat, lng: l.lng }, source: "catalog" }));
  }
}
