"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useOperation } from "@/components/operation/OperationProvider";
import { useRoutePlans, TRACKED_STATUSES } from "@/components/map/useRoutePlans";
import { HttpRouteProvider } from "@/lib/geo/client/http-providers";
import { DemoTrackingProvider } from "@/lib/geo/simulation/demo-tracking";
import type { ClockState } from "@/lib/geo/simulation/clock";
import type { RoutePlan, SimulationState } from "@/lib/geo/simulation/engine";
import type { RouteResult } from "@/lib/geo/types";
import type { Shipment } from "@/lib/domain/types";
import { attentionQueue, type AttentionItem } from "@/lib/ui/attention";
import type { TripReading } from "@/lib/ui/trip";

// Operação "ao vivo" compartilhada por todas as telas do shell: um único
// relógio de simulação, as rotas calculadas uma vez e a fila de atenção
// derivada do mesmo estado. Trocar de tela não reinicia a simulação, e mapa,
// Command Center e viagem leem exatamente os mesmos ETAs.

interface LiveOperation {
  /** Viagens com rota no mapa (não concluídas, com 2+ paradas). */
  shipments: Shipment[];
  trackedIds: string[];
  plans: Record<string, RoutePlan>;
  routes: Record<string, RouteResult>;
  loadingIds: string[];
  tracking: DemoTrackingProvider;
  clock: ClockState | null;
  /** Posições a ~4 Hz para leitura humana (o mapa anima a cada quadro, fora do React). */
  positions: Map<string, SimulationState>;
  nowMs: number;
  attention: AttentionItem[];
  trips: Map<string, TripReading>;
  prioritize: (shipmentId: string | null) => void;
}

const LiveContext = createContext<LiveOperation | null>(null);
const EMPTY: SimulationState[] = [];

/** Assina uma fonte que muda a cada quadro, notificando o React no máximo a cada `ms` (com notificação final). */
export function useThrottled<T>(subscribe: (cb: () => void) => () => void, get: () => T, ms: number, server: T): T {
  const throttled = useMemo(
    () => (cb: () => void) => {
      let last = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const off = subscribe(() => {
        const wait = ms - (Date.now() - last);
        if (wait <= 0) {
          last = Date.now();
          cb();
        } else if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            last = Date.now();
            cb();
          }, wait);
        }
      });
      return () => {
        if (timer) clearTimeout(timer);
        off();
      };
    },
    [subscribe, ms]
  );
  return useSyncExternalStore(throttled, get, () => server);
}

export function LiveOperationProvider({ children }: { children: ReactNode }) {
  const { data } = useOperation();
  const [priorityId, prioritize] = useState<string | null>(null);

  const shipments = useMemo(
    () => data.shipments.filter((s) => s.status !== "Delivered" && s.status !== "Closed" && s.stops.length >= 2),
    [data.shipments]
  );
  const [routeProvider] = useState(() => new HttpRouteProvider());
  const [tracking] = useState(() => new DemoTrackingProvider(Date.now()));
  const { results, plans, loadingIds } = useRoutePlans(data, shipments, priorityId, routeProvider);
  const trackedIds = useMemo(() => shipments.filter((s) => TRACKED_STATUSES.includes(s.status)).map((s) => s.id), [shipments]);

  useEffect(() => {
    tracking.setPlans(trackedIds.map((id) => plans[id]).filter(Boolean));
  }, [tracking, plans, trackedIds]);
  useEffect(() => () => tracking.dispose(), [tracking]);

  const subscribe = useCallback((cb: () => void) => tracking.subscribe(cb), [tracking]);
  const get = useCallback(() => tracking.getSnapshot(), [tracking]);
  const list = useThrottled<SimulationState[]>(subscribe, get, 250, EMPTY);
  const clock = useSyncExternalStore<ClockState | null>(
    (cb) => tracking.clock.subscribe(cb),
    () => tracking.clock.getState(),
    () => null
  );

  const positions = useMemo(() => new Map(list.map((p) => [p.shipmentId, p])), [list]);
  const nowMs = clock?.simTimeMs ?? 0;
  // Fila recalculada a 4 Hz no máximo (positions é throttled), e o relógio
  // entra arredondado ao minuto para não recalcular sem mudança visível.
  const minute = Math.floor(nowMs / 60000);
  const { items: attention, trips } = useMemo(() => attentionQueue(data, positions, minute * 60000), [data, positions, minute]);

  const value: LiveOperation = {
    shipments,
    trackedIds,
    plans,
    routes: results,
    loadingIds,
    tracking,
    clock,
    positions,
    nowMs,
    attention,
    trips,
    prioritize,
  };
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive precisa de LiveOperationProvider");
  return ctx;
}
