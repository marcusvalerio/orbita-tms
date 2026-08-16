import type { OperationDataset } from "../domain/types";

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

/** Todos os KPIs são derivados do estado atual — nunca hardcoded. */
export function getOverviewMetrics(data: OperationDataset): OverviewMetrics {
  const deliveredCount = data.deliveries.filter((d) => d.result === "Delivered").length;
  const totalDeliveries = data.deliveries.length;
  const otifPercent = totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 1000) / 10 : 100;
  const otdPercent = otifPercent;

  const totalCapacity = data.vehicles.reduce((s, v) => s + v.capacityKg, 0) || 1;
  const totalLoadWeight = data.loads.reduce((s, l) => s + l.totalWeightKg, 0);
  const occupancyPercent = Math.min(100, Math.round((totalLoadWeight / (totalCapacity * 0.3)) * 1000) / 10);

  const costPerDelivery = deliveredCount > 0 ? Math.round((totalLoadWeight * 0.8) / deliveredCount) : 0;

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
    otifPercent,
    otdPercent,
    occupancyPercent,
    costPerDelivery,
    normalCount: Math.max(0, data.shipments.length - shipmentsWithOpenOccurrence.length - shipmentsInAttention.length),
    attentionCount: shipmentsInAttention.length,
    occurrenceCount: shipmentsWithOpenOccurrence.length,
  };
}

export function getActiveShipments(data: OperationDataset, limit = 6) {
  return data.shipments
    .filter((s) => s.status === "In Transit" || s.status === "At Delivery" || s.status === "Awaiting Pickup" || s.status === "Exception")
    .slice(0, limit)
    .map((s) => {
      const origin = data.locations.find((l) => l.id === s.originId);
      const destination = data.locations.find((l) => l.id === s.destinationId);
      const carrier = data.carriers.find((c) => c.id === s.carrierId);
      return { shipment: s, origin, destination, carrierName: carrier?.name ?? "Frota Própria" };
    });
}

export function getExceptionQueue(data: OperationDataset, limit = 6) {
  return data.occurrences
    .filter((o) => !o.resolved)
    .slice(0, limit)
    .map((o) => {
      const shipment = data.shipments.find((s) => s.id === o.shipmentId);
      return { occurrence: o, shipment };
    });
}

export function getPlanningQueue(data: OperationDataset) {
  const ordersAwaiting = data.orders.filter((o) => o.status === "Aguardando planejamento");
  const loadsAwaitingCarrier = data.loads.filter((l) => l.status === "Aguardando transporte");
  return { ordersAwaiting, loadsAwaitingCarrier };
}

export function getRecentActivity(data: OperationDataset, limit = 8) {
  const events: { id: string; label: string; timestamp: string }[] = [];
  data.deliveries
    .filter((d) => d.completedAt)
    .forEach((d) => events.push({ id: `del-${d.id}`, label: `${d.orderId} entregue`, timestamp: d.completedAt! }));
  data.occurrences.forEach((o) =>
    events.push({ id: `occ-${o.id}`, label: `${o.type} em ${o.shipmentId}`, timestamp: o.reportedAt })
  );
  data.shipments
    .filter((s) => s.status !== "Planned")
    .forEach((s) => events.push({ id: `ship-${s.id}`, label: `${s.id} saiu para viagem`, timestamp: s.departureTime }));
  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export interface OperationalAlert {
  id: string;
  message: string;
  severity: "info" | "attention" | "critical";
}

export function getOperationalAlerts(data: OperationDataset): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  const lateDeliveries = data.deliveries.filter((d) => d.result === "Failed" || d.result === "Returned");
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
