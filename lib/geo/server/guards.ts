import type { GeoPoint } from "../types";

// Proteções dos endpoints geo: cada chamada ao Google tem custo. Cache de
// resultado, limite por cliente e validação de entrada (só coordenadas no
// Brasil, número limitado de paradas).

export class TtlCache<V> {
  private readonly map = new Map<string, { value: V; expires: number }>();
  constructor(private readonly ttlMs: number, private readonly max = 500, private readonly now = () => Date.now()) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, { value, expires: this.now() + this.ttlMs });
  }
}

/** Janela deslizante simples em memória (por instância do servidor). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now = () => Date.now()) {}

  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }
}

// Brasil com folga: lat -34..6, lng -74..-28.
export function isInBrazil(p: GeoPoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -34.5 && p.lat <= 6 && p.lng >= -74.5 && p.lng <= -28;
}

export function parseStops(input: unknown, maxStops: number): GeoPoint[] | null {
  if (!Array.isArray(input) || input.length < 2 || input.length > maxStops) return null;
  const stops: GeoPoint[] = [];
  for (const raw of input) {
    const lat = Number((raw as GeoPoint)?.lat);
    const lng = Number((raw as GeoPoint)?.lng);
    const p = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
    if (!isInBrazil(p)) return null;
    stops.push(p);
  }
  return stops;
}
