import { generateAtlasOperation } from "../sim/generate-atlas";
import type { OperationDataset } from "../domain/types";

let cached: OperationDataset | null = null;

/** Retorna o dataset simulado da Atlas Distribuição. Gerado uma única vez (seed fixa). */
export function getOperationData(): OperationDataset {
  if (!cached) cached = generateAtlasOperation();
  return cached;
}

export interface OverviewMetrics {
  orderCount: number;
  loadCount: number;
  shipmentCount: number;
  deliveryCount: number;
  otifPercent: number;
  otdPercent: number;
  occupancyPercent: number;
  costPerDelivery: number;
  normalCount: number;
  attentionCount: number;
  occurrenceCount: number;
}

export function getOverviewMetrics(): OverviewMetrics {
  const data = getOperationData();
  const latest = data.kpiHistory[data.kpiHistory.length - 1];

  const shipmentsWithOpenOccurrence = data.shipments.filter((s) =>
    s.occurrenceIds.some((occId) => data.occurrences.find((o) => o.id === occId && !o.resolved))
  );
  const shipmentsInAttention = data.shipments.filter(
    (s) => s.status === "At Delivery" || s.status === "Awaiting Pickup"
  );

  return {
    orderCount: data.orders.length,
    loadCount: data.loads.length,
    shipmentCount: data.shipments.length,
    deliveryCount: data.deliveries.length,
    otifPercent: latest?.otifPercent ?? 0,
    otdPercent: latest?.otdPercent ?? 0,
    occupancyPercent: latest?.occupancyPercent ?? 0,
    costPerDelivery: latest?.costPerDelivery ?? 0,
    normalCount: data.shipments.length - shipmentsWithOpenOccurrence.length - shipmentsInAttention.length,
    attentionCount: shipmentsInAttention.length,
    occurrenceCount: shipmentsWithOpenOccurrence.length,
  };
}

export function getActiveShipments(limit = 6) {
  const data = getOperationData();
  return data.shipments
    .filter((s) => s.status === "In Transit" || s.status === "At Delivery" || s.status === "Awaiting Pickup")
    .slice(0, limit)
    .map((s) => {
      const origin = data.locations.find((l) => l.id === s.originId);
      const destination = data.locations.find((l) => l.id === s.destinationId);
      const carrier = data.carriers.find((c) => c.id === s.carrierId);
      return { shipment: s, origin, destination, carrierName: carrier?.name ?? "Frota Própria" };
    });
}

export function getExceptionQueue(limit = 6) {
  const data = getOperationData();
  return data.occurrences
    .filter((o) => !o.resolved)
    .slice(0, limit)
    .map((o) => {
      const shipment = data.shipments.find((s) => s.id === o.shipmentId);
      return { occurrence: o, shipment };
    });
}

export function getPlanningQueue() {
  const data = getOperationData();
  const ordersAwaiting = data.orders.filter((o) => o.status === "Aguardando planejamento");
  const loadsAwaitingCarrier = data.loads.filter((l) => l.status === "Aguardando transporte");
  return { ordersAwaiting, loadsAwaitingCarrier };
}

export function getRecentActivity(limit = 8) {
  const data = getOperationData();
  const events: { id: string; label: string; timestamp: string }[] = [];
  data.deliveries
    .filter((d) => d.completedAt)
    .forEach((d) =>
      events.push({ id: `del-${d.id}`, label: `${d.orderId} entregue`, timestamp: d.completedAt! })
    );
  data.occurrences.forEach((o) =>
    events.push({ id: `occ-${o.id}`, label: `${o.type} em ${o.shipmentId}`, timestamp: o.reportedAt })
  );
  data.shipments
    .filter((s) => s.status !== "Planned")
    .forEach((s) =>
      events.push({ id: `ship-${s.id}`, label: `${s.id} saiu para viagem`, timestamp: s.departureTime })
    );
  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export interface OperationalAlert {
  id: string;
  message: string;
  severity: "info" | "attention" | "critical";
}

export function getOperationalAlerts(): OperationalAlert[] {
  const data = getOperationData();
  const alerts: OperationalAlert[] = [];

  const lateDeliveries = data.deliveries.filter(
    (d) => d.result === "Failed" || d.result === "Returned"
  );
  if (lateDeliveries.length > 0) {
    alerts.push({
      id: "late-deliveries",
      message: `${lateDeliveries.length} entregas ultrapassaram a janela prevista.`,
      severity: "critical",
    });
  }

  const loadsAwaitingContract = data.loads.filter((l) => l.status === "Aguardando transporte");
  if (loadsAwaitingContract.length > 0) {
    alerts.push({
      id: "loads-awaiting-carrier",
      message: `${loadsAwaitingContract.length} cargas aguardam contratação.`,
      severity: "attention",
    });
  }

  const nearCapacity = data.loads.filter((l) => {
    const vehicleMatch = data.vehicles.find((v) => v.capacityKg >= l.totalWeightKg);
    return vehicleMatch && l.totalWeightKg / vehicleMatch.capacityKg > 0.85;
  });
  if (nearCapacity.length > 0) {
    alerts.push({
      id: "near-capacity",
      message: `${nearCapacity.length} veículos estão próximos do limite de capacidade.`,
      severity: "attention",
    });
  }

  const unresolvedOccurrences = data.occurrences.filter((o) => !o.resolved);
  if (unresolvedOccurrences.length > 0) {
    alerts.push({
      id: "open-occurrences",
      message: `${unresolvedOccurrences.length} ocorrências em aberto na operação.`,
      severity: "critical",
    });
  }

  return alerts;
}
