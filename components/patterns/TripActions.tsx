"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, CircleAlert, ExternalLink, Map as MapIcon, Play, ShieldCheck } from "lucide-react";
import { OCCURRENCE_TYPES, OCCURRENCE_ACTIONS, type OccurrenceAction, type OccurrenceType, type Shipment } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { Dialog, Button } from "@/components/ds";
import { cn } from "@/lib/ui/cn";

// Ações contextuais de uma viagem — as mesmas no Command Center, no Mapa, na
// lista e na página da viagem ("ver → entender → agir"). Respeitam o papel
// (RBAC) e o estado do domínio; o domínio continua sendo quem decide.

export type TripActionId = "start" | "complete" | "report" | "resolve" | "map" | "open";

export interface TripAction {
  id: TripActionId;
  label: string;
  icon: ReactNode;
  run: () => void;
  /** Ação principal sugerida no estado atual. */
  primary?: boolean;
}

const OCC_HINT: Partial<Record<OccurrenceType, string>> = {
  Atraso: "Atraso em relação ao planejado",
  Roubo: "Crítica — aciona a gestão",
  Acidente: "Crítica — aciona a gestão",
  Extravio: "Crítica",
};

export function useTripActions(shipment: Shipment | null) {
  const router = useRouter();
  const { data, can, startShipment, completeDelivery, createOccurrence, resolveOccurrence } = useOperation();
  const [dialog, setDialog] = useState<"report" | "resolve" | null>(null);
  const [busy, setBusy] = useState(false);

  if (!shipment) return { actions: [] as TripAction[], dialogs: null };

  const open = data.occurrences.find((o) => shipment.occurrenceIds.includes(o.id) && !o.resolved);
  const moving = shipment.status === "In Transit" || shipment.status === "At Delivery" || shipment.status === "Pickup Completed";
  const actions: TripAction[] = [];

  if (open && can("occurrences:resolve")) actions.push({ id: "resolve", label: "Resolver ocorrência", icon: <ShieldCheck />, run: () => setDialog("resolve"), primary: true });
  if (shipment.status === "Planned" && can("shipments:execute"))
    actions.push({ id: "start", label: "Iniciar viagem", icon: <Play />, run: () => void startShipment(shipment.id), primary: true });
  if (moving && !open && can("shipments:execute"))
    actions.push({ id: "complete", label: "Concluir entrega", icon: <CheckCheck />, run: () => void completeDelivery(shipment.id), primary: actions.length === 0 });
  if (moving && !open && can("occurrences:report")) actions.push({ id: "report", label: "Registrar ocorrência", icon: <CircleAlert />, run: () => setDialog("report") });
  actions.push({ id: "map", label: "Ver no mapa", icon: <MapIcon />, run: () => router.push(`/mapa?viagem=${shipment.id}`) });
  actions.push({ id: "open", label: "Abrir viagem", icon: <ExternalLink />, run: () => router.push(`/shipments/${shipment.id}`) });

  const report = async (type: OccurrenceType) => {
    setBusy(true);
    await createOccurrence(shipment.id, type);
    setBusy(false);
    setDialog(null);
  };
  const resolve = async (action: OccurrenceAction) => {
    if (!open) return;
    setBusy(true);
    await resolveOccurrence(open.id, action);
    setBusy(false);
    setDialog(null);
  };

  const dialogs = (
    <>
      <Dialog
        open={dialog === "report"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Registrar ocorrência"
        description={
          <>
            <span className="orb-data">{shipment.routeCode ?? shipment.id}</span> · a viagem fica com ocorrência até ser resolvida.
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {OCCURRENCE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy}
              onClick={() => report(t)}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center rounded-sm border border-line px-3 py-2 text-left transition-colors",
                "hover:border-exception-line hover:bg-exception-subtle disabled:opacity-50"
              )}
            >
              <span className="text-body font-medium text-fg">{t}</span>
              {OCC_HINT[t] && <span className="text-caption text-fg-muted">{OCC_HINT[t]}</span>}
            </button>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={dialog === "resolve"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Resolver ocorrência"
        description={open ? `${open.id} · ${open.type} · ${open.severity}` : undefined}
        size="sm"
      >
        {open && <p className="mb-3 text-body-sm text-fg-muted">{open.description}</p>}
        <div className="grid gap-2">
          {OCCURRENCE_ACTIONS.map((a) => (
            <Button key={a} size="lg" disabled={busy} onClick={() => resolve(a)} className="justify-start">
              {a}
            </Button>
          ))}
        </div>
      </Dialog>
    </>
  );

  return { actions, dialogs };
}
