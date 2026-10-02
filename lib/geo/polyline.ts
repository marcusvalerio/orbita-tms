import type { GeoPoint } from "./types";

/** Decodifica o "Encoded Polyline Algorithm Format" (Google Routes/Directions). */
export function decodePolyline(encoded: string, precision = 5): GeoPoint[] {
  const factor = 10 ** precision;
  const points: GeoPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

export function encodePolyline(points: GeoPoint[], precision = 5): string {
  const factor = 10 ** precision;
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  const encodeValue = (v: number) => {
    let value = v < 0 ? ~(v << 1) : v << 1;
    let chunk = "";
    while (value >= 0x20) {
      chunk += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    return chunk + String.fromCharCode(value + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * factor);
    const lng = Math.round(p.lng * factor);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

/**
 * Divide uma rota no ponto mais próximo de `at` (posição do veículo):
 * trecho percorrido e trecho restante, ambos contendo o ponto de corte.
 */
export function splitPathAt(path: GeoPoint[], at: GeoPoint): { done: GeoPoint[]; remaining: GeoPoint[] } {
  if (path.length < 2) return { done: [], remaining: path };
  let best = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((at.lng - a.lng) * dx + (at.lat - a.lat) * dy) / len2)) : 0;
    const px = a.lng + t * dx;
    const py = a.lat + t * dy;
    const d = (px - at.lng) ** 2 + (py - at.lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
      bestT = t;
    }
  }
  const a = path[best];
  const b = path[best + 1];
  const cut = { lat: a.lat + (b.lat - a.lat) * bestT, lng: a.lng + (b.lng - a.lng) * bestT };
  return { done: [...path.slice(0, best + 1), cut], remaining: [cut, ...path.slice(best + 1)] };
}

/** Interpola ângulos pelo menor arco (graus). */
export function lerpAngle(from: number, to: number, k: number): number {
  const diff = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + diff * k + 360) % 360;
}
