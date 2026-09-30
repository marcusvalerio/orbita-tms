import type { GeocodeResult, GeocodingProvider } from "../types";

// Adapter SERVER-SIDE do Google Geocoding API, restrito ao Brasil.
// https://developers.google.com/maps/documentation/geocoding/requests-geocoding

export class GeocodingProviderError extends Error {
  constructor(message: string, readonly status?: string) {
    super(message);
    this.name = "GeocodingProviderError";
  }
}

export class GoogleGeocodingProvider implements GeocodingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async geocode(query: string): Promise<GeocodeResult[]> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("region", "br");
    url.searchParams.set("components", "country:BR");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("key", this.apiKey);

    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
    const json = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
    };
    if (json.status === "ZERO_RESULTS") return [];
    if (json.status !== "OK") throw new GeocodingProviderError(json.error_message ?? `Geocoding: ${json.status}`, json.status);
    return (json.results ?? []).slice(0, 5).map((r) => ({
      label: r.formatted_address,
      position: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
      source: "google-geocoding",
    }));
  }
}
