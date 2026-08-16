"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { OperationDataset, OccurrenceType, OccurrenceAction } from "@/lib/domain/types";
import { generateAtlasOperation } from "@/lib/sim/generate-atlas";
import { reduce, toastForAction, type SimulationAction, type NewOrderInput } from "@/lib/sim/reducer";
import type { TransportOptionQuote } from "@/lib/planning/quote";

interface Toast {
  id: number;
  message: string;
}

interface SimulationContextValue {
  data: OperationDataset;
  createOrder: (input: NewOrderInput) => void;
  createLoad: (orderIds: string[]) => void;
  createShipment: (loadId: string, option: TransportOptionQuote) => void;
  startShipment: (shipmentId: string) => void;
  createOccurrence: (shipmentId: string, occurrenceType: OccurrenceType) => void;
  resolveOccurrence: (occurrenceId: string, action: OccurrenceAction) => void;
  completeDelivery: (shipmentId: string) => void;
  toasts: Toast[];
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

let toastSeq = 0;

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  // Estado nasce nulo em ambos server e client (evita mismatch de hidratação,
  // já que a geração usa timestamps atuais) e é populado só no client após o mount.
  const [data, setData] = useState<OperationDataset | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setData(generateAtlasOperation());
  }, []);

  const dispatch = useCallback((action: SimulationAction) => {
    setData((prev) => (prev ? reduce(prev, action) : prev));
    const message = toastForAction(action);
    if (message) {
      const id = ++toastSeq;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }
  }, []);

  const createOrder = useCallback((input: NewOrderInput) => dispatch({ type: "CREATE_ORDER", input }), [dispatch]);
  const createLoad = useCallback((orderIds: string[]) => dispatch({ type: "CREATE_LOAD", orderIds }), [dispatch]);
  const createShipment = useCallback(
    (loadId: string, option: TransportOptionQuote) => dispatch({ type: "CREATE_SHIPMENT", loadId, option }),
    [dispatch]
  );
  const startShipment = useCallback(
    (shipmentId: string) => dispatch({ type: "START_SHIPMENT", shipmentId }),
    [dispatch]
  );
  const createOccurrence = useCallback(
    (shipmentId: string, occurrenceType: OccurrenceType) =>
      dispatch({ type: "CREATE_OCCURRENCE", shipmentId, occurrenceType }),
    [dispatch]
  );
  const resolveOccurrence = useCallback(
    (occurrenceId: string, action: OccurrenceAction) => dispatch({ type: "RESOLVE_OCCURRENCE", occurrenceId, action }),
    [dispatch]
  );
  const completeDelivery = useCallback(
    (shipmentId: string) => dispatch({ type: "COMPLETE_DELIVERY", shipmentId }),
    [dispatch]
  );

  if (!data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-milk-mustache text-cosmic-ink/40 text-sm">
        Carregando operação...
      </div>
    );
  }

  return (
    <SimulationContext.Provider
      value={{
        data,
        createOrder,
        createLoad,
        createShipment,
        startShipment,
        createOccurrence,
        resolveOccurrence,
        completeDelivery,
        toasts,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used within SimulationProvider");
  return ctx;
}
