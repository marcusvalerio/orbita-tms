"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { OperationDataset, OccurrenceType, OccurrenceAction } from "@/lib/domain/types";
import { generateEmptyOperation } from "@/lib/sim/generate-empty";
import { generateAtlasOperation } from "@/lib/sim/generate-atlas";
import { reduce, toastForAction, type SimulationAction, type NewOrderInput } from "@/lib/sim/reducer";
import { loadPersistedState, persistState, clearPersistedState } from "@/lib/sim/persistence";
import type { TransportOptionQuote } from "@/lib/planning/quote";

interface Toast {
  id: number;
  message: string;
}

interface SimulationContextValue {
  data: OperationDataset;
  isEmpty: boolean;
  createOrder: (input: NewOrderInput) => void;
  createLoad: (orderIds: string[]) => void;
  createShipment: (loadId: string, option: TransportOptionQuote) => void;
  startShipment: (shipmentId: string) => void;
  createOccurrence: (shipmentId: string, occurrenceType: OccurrenceType) => void;
  resolveOccurrence: (occurrenceId: string, action: OccurrenceAction) => void;
  completeDelivery: (shipmentId: string) => void;
  resetSimulation: () => void;
  loadDemoScenario: () => void;
  toasts: Toast[];
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

let toastSeq = 0;

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  // UMA ÚNICA FONTE DE VERDADE: este provider vive no layout raiz e é
  // instanciado uma única vez por carregamento de página. O estado inicial
  // real do ÓRBITA é uma operação vazia — só os cadastros (frota,
  // transportadoras, clientes) vêm pré-carregados; pedidos, cargas, viagens,
  // entregas, ocorrências e documentos nascem exclusivamente da ação da
  // pessoa usuária. Nasce nulo em server e client (evita mismatch de
  // hidratação) e é populado só no client após o mount, priorizando o
  // estado salvo em localStorage quando existir.
  const [data, setData] = useState<OperationDataset | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    const persisted = loadPersistedState();
    setData(persisted ?? generateEmptyOperation());
    hydrated.current = true;
  }, []);

  // Persiste toda alteração de estado — sobrevive a refresh do navegador.
  useEffect(() => {
    if (data && hydrated.current) persistState(data);
  }, [data]);

  const pushToast = useCallback((message: string) => {
    if (!message) return;
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dispatch = useCallback(
    (action: SimulationAction) => {
      let succeeded = true;
      setData((prev) => {
        if (!prev) return prev;
        try {
          return reduce(prev, action);
        } catch (err) {
          // Causa raiz de qualquer falha é sempre investigada — isto é só a
          // rede de segurança: a ação nunca deve corromper o estado nem
          // derrubar a interface. O estado anterior é preservado.
          console.error("Falha ao processar ação da simulação:", action.type, err);
          succeeded = false;
          return prev;
        }
      });
      pushToast(succeeded ? toastForAction(action) : "Não foi possível concluir a ação. A operação não foi alterada.");
    },
    [pushToast]
  );

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

  const resetSimulation = useCallback(() => {
    clearPersistedState();
    setData(generateEmptyOperation());
    pushToast("Simulação reiniciada — operação restaurada para o estado inicial (zero).");
  }, [pushToast]);

  const loadDemoScenario = useCallback(() => {
    setData(generateAtlasOperation());
    pushToast("Cenário de demonstração carregado.");
  }, [pushToast]);

  if (!data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-milk-mustache text-cosmic-ink/40 text-sm">
        Carregando operação...
      </div>
    );
  }

  const isEmpty = data.orders.length === 0 && data.loads.length === 0 && data.shipments.length === 0;

  return (
    <SimulationContext.Provider
      value={{
        data,
        isEmpty,
        createOrder,
        createLoad,
        createShipment,
        startShipment,
        createOccurrence,
        resolveOccurrence,
        completeDelivery,
        resetSimulation,
        loadDemoScenario,
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
