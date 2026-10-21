import type { OperationDataset, DeliveryResult, OccurrenceType, OccurrenceAction } from "@/lib/domain/types";
import type { TripReading } from "./trip";

// Fila de entregas: cada parada de entrega das viagens ativas (com ETA ×
// janela vindos da leitura da viagem) + as entregas já registradas pelo
// domínio (resultado, POD). Pura: o mesmo estado gera a mesma fila.

export type DeliveryState = "programada" | "a-caminho" | "em-risco" | "atrasada" | "atendida" | "entregue" | "parcial" | "nao-realizada" | "devolvida";

export interface DeliveryRow {
  key: string;
  shipmentId: string;
  routeCode: string;
  stopIndex: number | null;
  locationName: string;
  city?: string;
  customerName: string;
  orderIds: string[];
  windowStart?: string;
  windowEnd?: string;
  /** ETA (pendentes) ou horário real (concluídas). */
  time: string | null;
  delayMin: number;
  slackMin: number | null;
  state: DeliveryState;
  result?: DeliveryResult;
  podDocumentId?: string;
  deliveryId?: string;
}

const RESULT_STATE: Record<DeliveryResult, DeliveryState> = { Delivered: "entregue", "Partial Delivery": "parcial", Failed: "nao-realizada", Returned: "devolvida" };

/** Rótulo e tom (chaves do STATUS.delivery) por estado. */
export const DELIVERY_STATUS_KEY: Record<DeliveryState, string> = {
  programada: "Scheduled",
  "a-caminho": "Pending",
  "em-risco": "AtRisk",
  atrasada: "Late",
  // Atendida pelo rastreamento; o domínio registra a entrega ao concluir a viagem.
  atendida: "Served",
  entregue: "Delivered",
  parcial: "Partial Delivery",
  "nao-realizada": "Failed",
  devolvida: "Returned",
};

export function deliveryQueue(data: OperationDataset, trips: Map<string, TripReading>): DeliveryRow[] {
  const rows: DeliveryRow[] = [];
  const recorded = new Set(data.deliveries.map((d) => d.shipmentId));
  const customerOf = (orderIds: string[]) => {
    const names = [...new Set(orderIds.map((id) => data.customers.find((c) => c.id === data.orders.find((o) => o.id === id)?.customerId)?.name).filter(Boolean))];
    return names.join(", ") || "—";
  };

  for (const trip of trips.values()) {
    const s = trip.shipment;
    if (trip.health === "done" && recorded.has(s.id)) continue;
    for (const st of trip.stops) {
      if (st.index === 0 || st.kind !== "Entrega") continue;
      let state: DeliveryState;
      if (st.state === "done") state = "atendida";
      else if (st.delayMin > 0) state = "atrasada";
      else if (st.state === "risk") state = "em-risco";
      else if (trip.tracked || s.status !== "Planned") state = "a-caminho";
      else state = "programada";
      rows.push({
        key: `${s.id}:${st.index}`,
        shipmentId: s.id,
        routeCode: s.routeCode ?? s.id,
        stopIndex: st.index,
        locationName: st.name,
        city: st.city,
        customerName: customerOf(st.orderIds),
        orderIds: st.orderIds,
        windowStart: st.windowStart,
        windowEnd: st.windowEnd,
        time: st.state === "done" ? (st.actualTime ?? null) : st.eta,
        delayMin: st.delayMin,
        slackMin: st.slackMin,
        state,
      });
    }
  }

  for (const d of data.deliveries) {
    const s = data.shipments.find((x) => x.id === d.shipmentId);
    const loc = data.locations.find((l) => l.id === data.orders.find((o) => o.id === d.orderId)?.destinationId);
    rows.push({
      key: `del:${d.id}`,
      shipmentId: d.shipmentId,
      routeCode: s?.routeCode ?? d.shipmentId,
      stopIndex: null,
      locationName: loc?.name ?? "—",
      city: loc?.city,
      customerName: data.customers.find((c) => c.id === d.customerId)?.name ?? "—",
      orderIds: [d.orderId],
      windowStart: d.plannedWindowStart,
      windowEnd: d.plannedWindowEnd,
      time: d.completedAt ?? d.arrivalTime ?? null,
      delayMin: d.completedAt && d.plannedWindowEnd ? Math.max(0, Math.round((new Date(d.completedAt).getTime() - new Date(d.plannedWindowEnd).getTime()) / 60000)) : 0,
      slackMin: null,
      state: d.result ? RESULT_STATE[d.result] : "a-caminho",
      result: d.result,
      podDocumentId: d.podDocumentId,
      deliveryId: d.id,
    });
  }

  const order: Record<DeliveryState, number> = { atrasada: 0, "em-risco": 1, "a-caminho": 2, programada: 3, "nao-realizada": 4, devolvida: 5, parcial: 6, atendida: 7, entregue: 8 };
  return rows.sort((a, b) => order[a.state] - order[b.state] || (a.time ?? "~").localeCompare(b.time ?? "~"));
}

/** Folga legível: minutos, horas ou "janela aberta" (janelas de dia inteiro). */
export function fmtSlack(min: number): string {
  if (min >= 12 * 60) return "janela aberta";
  if (min >= 60) return `folga ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  return `folga ${min} min`;
}

/**
 * Ação de resolução sugerida por tipo de ocorrência — regra fixa e visível
 * (não é recomendação inteligente). A pessoa sempre pode escolher outra.
 */
export const SUGGESTED_ACTION: Record<OccurrenceType, OccurrenceAction> = {
  Atraso: "Reagendar",
  Avaria: "Contatar cliente",
  "Destinatário ausente": "Nova tentativa",
  "Endereço incorreto": "Contatar cliente",
  "Problema mecânico": "Reagendar",
  Acidente: "Contatar cliente",
  Extravio: "Contatar cliente",
  Roubo: "Contatar cliente",
  Recusa: "Devolver",
  Devolução: "Devolver",
};
