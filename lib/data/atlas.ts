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
