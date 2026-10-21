// Geometria de domínio — cálculos aproximados e determinísticos, sem provider.
// Servem para estimar sequência, distância e prazo no momento do comando.
// Distância e duração reais de via vêm do RouteProvider (lib/geo) na tela.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distância em linha reta (haversine), em km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Fator médio de sinuosidade da malha viária sobre a linha reta. */
export const ROAD_FACTOR = 1.3;

/** Velocidade média de planejamento: urbana até 60 km de perna, rodoviária acima. */
export function plannedSpeedKmh(legKm: number): number {
  return legKm <= 60 ? 28 : 65;
}

/** Estimativa de perna rodoviária: distância pela via (km) e duração (min). */
export function estimateLeg(a: LatLng, b: LatLng): { distanceKm: number; durationMin: number } {
  const distanceKm = haversineKm(a, b) * ROAD_FACTOR;
  const durationMin = (distanceKm / plannedSpeedKmh(distanceKm)) * 60;
  return { distanceKm: Math.round(distanceKm * 10) / 10, durationMin: Math.round(durationMin) };
}

/**
 * Ordena destinos pela heurística do vizinho mais próximo a partir da origem.
 * É uma sugestão: o gestor pode reordenar as paradas antes de confirmar.
 */
export function nearestNeighborOrder<T extends LatLng>(origin: LatLng, points: T[]): T[] {
  const remaining = [...points];
  const ordered: T[] = [];
  let current: LatLng = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(current, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}
