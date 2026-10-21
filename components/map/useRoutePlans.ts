"use client";

import { useEffect, useMemo, useState } from "react";
import type { OperationDataset, Shipment } from "@/lib/domain/types";
import type { GeoPoint, RouteProvider, RouteResult } from "@/lib/geo/types";
import { estimateRoute } from "@/lib/geo/estimate";
import { snapStopsToPath, type RoutePlan } from "@/lib/geo/simulation/engine";

export const TRACKED_STATUSES: Shipment["status"][] = ["In Transit", "At Delivery", "Exception", "Pickup Completed"];

export function stopPoints(data: OperationDataset, shipment: Shipment): GeoPoint[] {
  return shipment.stops.map((st) => {
    const loc = data.locations.find((l) => l.id === st.locationId);
    return loc ? { lat: loc.lat, lng: loc.lng } : { lat: 0, lng: 0 };
  });
}

/**
 * Calcula (via RouteProvider) a geometria de cada viagem — a selecionada
 * primeiro — e deriva o plano de simulação. Enquanto o provedor responde, a
 * estimativa local mantém o mapa utilizável.
 */
export function useRoutePlans(data: OperationDataset, shipments: Shipment[], selectedId: string | null, provider: RouteProvider) {
  const [results, setResults] = useState<Record<string, RouteResult>>({});
  const [loadingIds, setLoadingIds] = useState<string[]>([]);

  const order = useMemo(() => {
    const ids = shipments.map((s) => s.id);
    return selectedId && ids.includes(selectedId) ? [selectedId, ...ids.filter((id) => id !== selectedId)] : ids;
  }, [shipments, selectedId]);
  const signature = order.join("|");

  useEffect(() => {
    let cancelled = false;
    const pending = order.filter((id) => !results[id]);
    if (pending.length === 0) return;
    (async () => {
      for (const id of pending) {
        const shipment = shipments.find((s) => s.id === id);
        if (!shipment || cancelled) continue;
        setLoadingIds((prev) => [...prev, id]);
        const points = stopPoints(data, shipment);
        const result = await provider.computeRoute(points, { departureTime: shipment.departureTime }).catch(() => estimateRoute(points));
        if (cancelled) return;
        setResults((prev) => ({ ...prev, [id]: result }));
        setLoadingIds((prev) => prev.filter((x) => x !== id));
      }
    })();
    return () => {
      cancelled = true;
    };
    // `results` fica fora das dependências de propósito: só recalcula quando a lista muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, provider]);

  const plans = useMemo(() => {
    const out: Record<string, RoutePlan> = {};
    for (const shipment of shipments) {
      const points = stopPoints(data, shipment);
      const result = results[shipment.id] ?? estimateRoute(points);
      const legs = result.legs.length === points.length - 1 ? result.legs : estimateRoute(points).legs;
      out[shipment.id] = {
        shipmentId: shipment.id,
        vehicleId: shipment.vehicleId,
        departure: shipment.departureTime,
        path: result.path,
        stopPathIndex: snapStopsToPath(result.path, points),
        legDurationsSec: legs.map((l) => l.durationSeconds),
        serviceSec: shipment.stops.map((st, i) => (i === 0 ? 0 : (st.serviceMinutes ?? 0) * 60)),
      };
    }
    return out;
  }, [data, shipments, results]);

  return { results, plans, loadingIds };
}
