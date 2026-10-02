import type { OperationDataset, Delivery } from "../domain/types";

export interface OverviewMetrics {
  orderCount: number;
  loadCount: number;
  shipmentCount: number;
  deliveryCount: number;
  otifPercent: number | null;
  otdPercent: number | null;
  occupancyPercent: number | null;
  costPerDelivery: number | null;
  normalCount: number;
  attentionCount: number;
  occurrenceCount: number;
}

/** Entrega concluída dentro da janela combinada (ou do dia do prazo, se não houver janela). */
export function isOnTime(d: Delivery): boolean {
  return Boolean(d.completedAt) && new Date(d.completedAt!).getTime() <= new Date(d.plannedWindowEnd).getTime();
}

/**
 * Todos os KPIs são derivados do estado atual — nunca hardcoded. Sem
 * movimentação real, o indicador é `null` ("—" na interface).
 *
 * - OTD: entregas realizadas (total ou parcial) dentro da janela ÷ entregas encerradas.
 * - OTIF: entregas realizadas por completo dentro da janela ÷ entregas encerradas.
 * - Ocupação: média de peso da carga ÷ capacidade do veículo, nas viagens de frota.
 * - Custo por entrega: frete contratado das viagens encerradas ÷ entregas dessas viagens.
 */
export function getOverviewMetrics(data: OperationDataset): OverviewMetrics {
  const closed = data.deliveries.filter((d) => d.completedAt);
  const pct = (n: number) => (closed.length > 0 ? Math.round((n / closed.length) * 1000) / 10 : null);
  const otdPercent = pct(closed.filter((d) => (d.result === "Delivered" || d.result === "Partial Delivery") && isOnTime(d)).length);
  const otifPercent = pct(closed.filter((d) => d.result === "Delivered" && isOnTime(d)).length);

  const fleetShipments = data.shipments.filter((s) => s.vehicleId);
  const ratios = fleetShipments.flatMap((s) => {
    const vehicle = data.vehicles.find((v) => v.id === s.vehicleId);
    const load = data.loads.find((l) => l.id === s.loadId);
    return vehicle && load ? [load.totalWeightKg / vehicle.capacityKg] : [];
  });
  const occupancyPercent =
    ratios.length > 0 ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 1000) / 10 : null;

  const closedShipmentIds = new Set(closed.map((d) => d.shipmentId));
  const freightCost = data.freights
    .filter((f) => closedShipmentIds.has(f.shipmentId))
    .reduce((sum, f) => sum + f.totalCost, 0);
  const costPerDelivery = closed.length > 0 && freightCost > 0 ? Math.round(freightCost / closed.length) : null;

  const shipmentsWithOpenOccurrence = data.shipments.filter((s) =>
    s.occurrenceIds.some((occId) => data.occurrences.find((o) => o.id === occId && !o.resolved))
  );
  const shipmentsInAttention = data.shipments.filter(
    (s) => s.status === "At Delivery" || s.status === "Awaiting Pickup"
  );
  const activeCount = data.shipments.filter((s) => s.status !== "Delivered" && s.status !== "Closed").length;

  return {
    orderCount: data.orders.length,
    loadCount: data.loads.length,
    shipmentCount: data.shipments.length,
    deliveryCount: data.deliveries.length,
    otifPercent,
    otdPercent,
    occupancyPercent,
    costPerDelivery,
    normalCount: Math.max(0, activeCount - shipmentsWithOpenOccurrence.length - shipmentsInAttention.length),
    attentionCount: shipmentsInAttention.length,
    occurrenceCount: shipmentsWithOpenOccurrence.length,
  };
}

/** Paradas ainda não atendidas cuja chegada prevista já ultrapassa o fim da janela. */
export function getStopsAtRisk(data: OperationDataset) {
  return data.shipments
    .filter((s) => s.status === "In Transit" || s.status === "At Delivery" || s.status === "Exception")
    .flatMap((s) =>
      s.stops
        .filter((st) => st.kind === "Entrega" && !st.actualTime && st.windowEnd)
        .filter((st) => new Date(st.plannedTime).getTime() > new Date(st.windowEnd!).getTime())
        .map((stop) => ({ shipment: s, stop }))
    );
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
  href?: string;
}

export function getOperationalAlerts(data: OperationDataset): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  const lateDeliveries = data.deliveries.filter((d) => d.completedAt && d.result !== "Returned" && d.result !== "Failed" && !isOnTime(d));
  if (lateDeliveries.length > 0) {
    alerts.push({
      id: "late-deliveries",
      message:
        lateDeliveries.length === 1
          ? "1 entrega foi concluída fora da janela prevista."
          : `${lateDeliveries.length} entregas foram concluídas fora da janela prevista.`,
      severity: "attention",
      href: "/deliveries",
    });
  }

  const failed = data.deliveries.filter((d) => d.result === "Failed" || d.result === "Returned");
  if (failed.length > 0) {
    alerts.push({
      id: "failed-deliveries",
      message: failed.length === 1 ? "1 entrega não foi realizada (devolvida ou malsucedida)." : `${failed.length} entregas não foram realizadas (devolvidas ou malsucedidas).`,
      severity: "critical",
      href: "/deliveries",
    });
  }

  const atRisk = getStopsAtRisk(data);
  if (atRisk.length > 0) {
    alerts.push({
      id: "stops-at-risk",
      message: atRisk.length === 1 ? "1 parada tem chegada prevista após a janela do cliente." : `${atRisk.length} paradas têm chegada prevista após a janela do cliente.`,
      severity: "critical",
      href: "/shipments",
    });
  }

  const loadsAwaitingContract = data.loads.filter((l) => l.status === "Aguardando transporte");
  if (loadsAwaitingContract.length > 0) {
    alerts.push({
      id: "loads-awaiting-carrier",
      message:
        loadsAwaitingContract.length === 1
          ? "1 carga aguarda contratação."
          : `${loadsAwaitingContract.length} cargas aguardam contratação.`,
      severity: "attention",
      href: "/contratacao",
    });
  }

  const unresolvedOccurrences = data.occurrences.filter((o) => !o.resolved);
  if (unresolvedOccurrences.length > 0) {
    alerts.push({
      id: "open-occurrences",
      message:
        unresolvedOccurrences.length === 1
          ? "1 ocorrência aguarda resolução."
          : `${unresolvedOccurrences.length} ocorrências aguardam resolução.`,
      severity: "critical",
      href: "/occurrences",
    });
  }

  return alerts;
}
