"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { OperationDataset, OccurrenceType, OccurrenceAction } from "@/lib/domain/types";
import { generateEmptyOperation } from "@/lib/sim/generate-empty";
import { generateAtlasOperation } from "@/lib/sim/demo";
import { reduce, toastForAction, type SimulationAction, type NewOrderInput, type NewPartnerCompanyInput, type NewSolicitationInput } from "@/lib/sim/reducer";
import { loadPersistedState, persistState, clearPersistedState } from "@/lib/sim/persistence";
import type { TransportOptionQuote } from "@/lib/planning/quote";

interface Toast { id: number; message: string; }
type OperationMode = "EMPTY" | "LOCAL" | "DEMO";
interface SimulationContextValue {
  data: OperationDataset; isEmpty: boolean; mode: OperationMode;
  createOrder: (input: NewOrderInput) => void; createLoad: (orderIds: string[]) => void; createShipment: (loadId: string, option: TransportOptionQuote) => void; startShipment: (shipmentId: string) => void; createOccurrence: (shipmentId: string, occurrenceType: OccurrenceType) => void; resolveOccurrence: (occurrenceId: string, action: OccurrenceAction) => void; completeDelivery: (shipmentId: string) => void; resetSimulation: () => void; loadDemoScenario: () => void; createPartnerCompany: (input: NewPartnerCompanyInput) => void; regeneratePartnerCode: (partnerCompanyId: string) => void; createSolicitation: (input: NewSolicitationInput) => void; convertSolicitationToOrder: (solicitationId: string, customerId: string, priority: "Normal" | "Alta" | "Urgente") => void; toasts: Toast[];
}
const SimulationContext = createContext<SimulationContextValue | null>(null);
let toastSeq = 0;
export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OperationDataset | null>(null); const [mode, setMode] = useState<OperationMode>("EMPTY"); const [toasts, setToasts] = useState<Toast[]>([]); const hydrated = useRef(false);
  useEffect(() => { const persisted = loadPersistedState(); setData(persisted ?? generateEmptyOperation()); setMode(persisted && (persisted.orders.length || persisted.loads.length || persisted.shipments.length) ? "LOCAL" : "EMPTY"); hydrated.current = true; }, []);
  useEffect(() => { if (data && hydrated.current) persistState(data); }, [data]);
  const pushToast = useCallback((message: string) => { if (!message) return; const id = ++toastSeq; setToasts((prev) => [...prev, { id, message }]); setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000); }, []);
  const dispatch = useCallback((action: SimulationAction) => { let succeeded = true; setData((prev) => { if (!prev) return prev; try { const next = reduce(prev, action); setMode("LOCAL"); return next; } catch (err) { console.error("Falha ao processar ação da simulação:", { action, error: err }); succeeded = false; return prev; } }); pushToast(succeeded ? toastForAction(action) : "Não foi possível concluir a ação. A operação não foi alterada."); }, [pushToast]);
  const createOrder = useCallback((input: NewOrderInput) => dispatch({ type: "CREATE_ORDER", input }), [dispatch]);
  const createLoad = useCallback((orderIds: string[]) => dispatch({ type: "CREATE_LOAD", orderIds }), [dispatch]);
  const createShipment = useCallback((loadId: string, option: TransportOptionQuote) => dispatch({ type: "CREATE_SHIPMENT", loadId, option }), [dispatch]);
  const startShipment = useCallback((shipmentId: string) => dispatch({ type: "START_SHIPMENT", shipmentId }), [dispatch]);
  const createOccurrence = useCallback((shipmentId: string, occurrenceType: OccurrenceType) => dispatch({ type: "CREATE_OCCURRENCE", shipmentId, occurrenceType }), [dispatch]);
  const resolveOccurrence = useCallback((occurrenceId: string, action: OccurrenceAction) => dispatch({ type: "RESOLVE_OCCURRENCE", occurrenceId, action }), [dispatch]);
  const completeDelivery = useCallback((shipmentId: string) => dispatch({ type: "COMPLETE_DELIVERY", shipmentId }), [dispatch]);
  const resetSimulation = useCallback(() => { clearPersistedState(); setData(generateEmptyOperation()); setMode("EMPTY"); pushToast("Operação reiniciada — nenhum dado operacional está carregado."); }, [pushToast]);
  const loadDemoScenario = useCallback(() => { setData(generateAtlasOperation()); setMode("DEMO"); pushToast("Cenário de demonstração carregado — dados não representam uma operação real."); }, [pushToast]);
  const createPartnerCompany = useCallback((input: NewPartnerCompanyInput) => dispatch({ type: "CREATE_PARTNER_COMPANY", input }), [dispatch]);
  const regeneratePartnerCode = useCallback((partnerCompanyId: string) => dispatch({ type: "REGENERATE_PARTNER_CODE", partnerCompanyId }), [dispatch]);
  const createSolicitation = useCallback((input: NewSolicitationInput) => dispatch({ type: "CREATE_SOLICITATION", input }), [dispatch]);
  const convertSolicitationToOrder = useCallback((solicitationId: string, customerId: string, priority: "Normal" | "Alta" | "Urgente") => dispatch({ type: "CONVERT_SOLICITATION_TO_ORDER", solicitationId, customerId, priority }), [dispatch]);
  if (!data) return <div className="flex h-screen w-full items-center justify-center bg-milk-mustache text-cosmic-ink/40 text-sm">Carregando operação...</div>;
  const isEmpty = data.orders.length === 0 && data.loads.length === 0 && data.shipments.length === 0;
  return <SimulationContext.Provider value={{ data, isEmpty, mode, createOrder, createLoad, createShipment, startShipment, createOccurrence, resolveOccurrence, completeDelivery, resetSimulation, loadDemoScenario, createPartnerCompany, regeneratePartnerCode, createSolicitation, convertSolicitationToOrder, toasts }}>{children}</SimulationContext.Provider>;
}
export function useSimulation() { const ctx = useContext(SimulationContext); if (!ctx) throw new Error("useSimulation must be used within SimulationProvider"); return ctx; }
