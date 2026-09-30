"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { OperationDataset, OccurrenceType, OccurrenceAction } from "@/lib/domain/types";
import { applyCommand, toastForAction, type SimulationAction, type NewOrderInput, type NewPartnerCompanyInput, type NewSolicitationInput } from "@/lib/sim/reducer";
import { authorizeCommand, can as roleCan, ROLE_LABELS, type Actor, type Permission } from "@/lib/authz/rbac";
import { demoStore } from "@/lib/client/demo-store";
import { generateAtlasOperation } from "@/lib/sim/demo";
import type { TransportOptionQuote } from "@/lib/planning/quote";
import type { CommandOutcome } from "@/lib/application/execute-command";

// Estado da operação na interface. Uma única API para as telas; duas fontes:
//   Demo       → núcleo de regras executado no navegador + localStorage.
//   Produção   → server action (autenticação, RBAC, Neon) + recorte por papel.

export type OperationMode = "demo" | "production";

export interface ServerBridge {
  runCommand: (action: SimulationAction) => Promise<CommandOutcome>;
  refresh: () => Promise<OperationDataset | null>;
}

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface OperationContextValue {
  data: OperationDataset;
  mode: OperationMode;
  isEmpty: boolean;
  actor: Actor;
  roleLabel: string;
  companyName: string;
  can: (permission: Permission) => boolean;
  pending: boolean;
  execute: (action: SimulationAction) => Promise<CommandOutcome>;
  createOrder: (input: NewOrderInput) => Promise<CommandOutcome>;
  createLoad: (orderIds: string[]) => Promise<CommandOutcome>;
  createShipment: (loadId: string, option: TransportOptionQuote, extra?: { vehicleId?: string; driverId?: string; routeCode?: string }) => Promise<CommandOutcome>;
  startShipment: (shipmentId: string) => Promise<CommandOutcome>;
  createOccurrence: (shipmentId: string, occurrenceType: OccurrenceType) => Promise<CommandOutcome>;
  resolveOccurrence: (occurrenceId: string, action: OccurrenceAction) => Promise<CommandOutcome>;
  completeDelivery: (shipmentId: string) => Promise<CommandOutcome>;
  createPartnerCompany: (input: NewPartnerCompanyInput) => Promise<CommandOutcome>;
  regeneratePartnerCode: (partnerCompanyId: string) => Promise<CommandOutcome>;
  createSolicitation: (input: NewSolicitationInput) => Promise<CommandOutcome>;
  convertSolicitationToOrder: (solicitationId: string, customerId: string, priority: "Normal" | "Alta" | "Urgente") => Promise<CommandOutcome>;
  /** Só no Modo Demo. */
  resetSimulation?: () => void;
  loadDemoScenario?: () => void;
  toasts: Toast[];
}

const OperationContext = createContext<OperationContextValue | null>(null);
let toastSeq = 0;

export function OperationProvider({
  mode,
  actor,
  companyName,
  initialData,
  server,
  children,
}: {
  mode: OperationMode;
  actor: Actor;
  companyName?: string;
  initialData?: OperationDataset | null;
  server?: ServerBridge;
  children: React.ReactNode;
}) {
  const demoData = useSyncExternalStore(demoStore.subscribe, demoStore.getSnapshot, demoStore.getServerSnapshot);
  const [serverData, setServerData] = useState<OperationDataset | null>(initialData ?? null);
  const data = mode === "demo" ? demoData : serverData;

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const lastAction = useRef(0);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    if (!message) return;
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  const execute = useCallback(
    async (action: SimulationAction): Promise<CommandOutcome> => {
      let outcome: CommandOutcome;
      if (mode === "demo") {
        const current = demoStore.getSnapshot()!;
        const authz = authorizeCommand(actor, action);
        if (!authz.ok) {
          outcome = { ok: false, error: authz.reason, code: "denied" };
        } else {
          const result = applyCommand(current, action);
          outcome = result.ok
            ? { ok: true, data: result.state }
            : { ok: false, error: result.error, code: result.kind === "rule" ? "rule" : "unexpected" };
          if (result.ok) demoStore.set(result.state);
        }
      } else {
        setPendingCount((n) => n + 1);
        try {
          outcome = await server!.runCommand(action);
        } catch {
          outcome = { ok: false, error: "Sem conexão com o servidor. A ação não foi registrada.", code: "unexpected" };
        } finally {
          setPendingCount((n) => n - 1);
        }
        if (outcome.ok) {
          lastAction.current = Date.now();
          setServerData(outcome.data);
        }
      }
      pushToast(outcome.ok ? toastForAction(action) : outcome.error, outcome.ok ? "success" : "error");
      return outcome;
    },
    [mode, actor, server, pushToast]
  );

  // Produção: traz alterações feitas por outras pessoas ao voltar para a aba
  // e periodicamente (a fonte da verdade é o banco).
  useEffect(() => {
    if (mode !== "production" || !server) return;
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastAction.current < 3000) return;
      server.refresh().then((fresh) => fresh && setServerData(fresh)).catch(() => {});
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [mode, server]);

  if (!data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-milk-mustache text-cosmic-ink/60 text-sm" role="status">
        Carregando operação…
      </div>
    );
  }
  const run = execute;
  const value: OperationContextValue = {
      data,
      mode,
      isEmpty: data.orders.length === 0 && data.loads.length === 0 && data.shipments.length === 0,
      actor,
      roleLabel: ROLE_LABELS[actor.role],
      companyName: companyName ?? data.company.name,
      can: (p: Permission) => roleCan(actor, p),
      pending: pendingCount > 0,
      execute: run,
      createOrder: (input) => run({ type: "CREATE_ORDER", input }),
      createLoad: (orderIds) => run({ type: "CREATE_LOAD", orderIds }),
      createShipment: (loadId, option, extra) => run({ type: "CREATE_SHIPMENT", loadId, option, ...extra }),
      startShipment: (shipmentId) => run({ type: "START_SHIPMENT", shipmentId }),
      createOccurrence: (shipmentId, occurrenceType) => run({ type: "CREATE_OCCURRENCE", shipmentId, occurrenceType }),
      resolveOccurrence: (occurrenceId, action) => run({ type: "RESOLVE_OCCURRENCE", occurrenceId, action }),
      completeDelivery: (shipmentId) => run({ type: "COMPLETE_DELIVERY", shipmentId }),
      createPartnerCompany: (input) => run({ type: "CREATE_PARTNER_COMPANY", input }),
      regeneratePartnerCode: (partnerCompanyId) => run({ type: "REGENERATE_PARTNER_CODE", partnerCompanyId }),
      createSolicitation: (input) => run({ type: "CREATE_SOLICITATION", input }),
      convertSolicitationToOrder: (solicitationId, customerId, priority) =>
        run({ type: "CONVERT_SOLICITATION_TO_ORDER", solicitationId, customerId, priority }),
      resetSimulation:
        mode === "demo"
          ? () => {
              demoStore.reset();
              pushToast("Operação reiniciada — nenhum dado operacional está carregado.", "success");
            }
          : undefined,
      loadDemoScenario:
        mode === "demo"
          ? () => {
              demoStore.set(generateAtlasOperation());
              pushToast("Cenário de demonstração carregado — dados não representam uma operação real.", "success");
            }
          : undefined,
      toasts,
  };
  return <OperationContext.Provider value={value}>{children}</OperationContext.Provider>;
}

export function useOperation() {
  const ctx = useContext(OperationContext);
  if (!ctx) throw new Error("useOperation must be used within OperationProvider");
  return ctx;
}
