import type {
  OperationDataset,
  Order,
  Load,
  Shipment,
  Occurrence,
  OccurrenceType,
  OccurrenceAction,
  Delivery,
  TmsDocument,
} from "../domain/types";
import type { TransportOptionQuote } from "../planning/quote";

export type SimulationAction =
  | { type: "CREATE_LOAD"; orderIds: string[] }
  | { type: "CREATE_SHIPMENT"; loadId: string; option: TransportOptionQuote }
  | { type: "START_SHIPMENT"; shipmentId: string }
  | { type: "CREATE_OCCURRENCE"; shipmentId: string; occurrenceType: OccurrenceType }
  | { type: "RESOLVE_OCCURRENCE"; occurrenceId: string; action: OccurrenceAction }
  | { type: "COMPLETE_DELIVERY"; shipmentId: string };

let seq = 900; // contador de IDs para novas entidades criadas na sessão

function nextId(prefix: string, pad = 5) {
  seq += 1;
  return `${prefix}-${seq.toString().padStart(pad, "0")}`;
}

export function reduce(state: OperationDataset, action: SimulationAction): OperationDataset {
  switch (action.type) {
    case "CREATE_LOAD": {
      const orders = state.orders.filter((o) => action.orderIds.includes(o.id));
      if (orders.length === 0) return state;
      const totalWeightKg = orders.reduce((sum, o) => sum + o.totalWeightKg, 0);
      const totalVolumeM3 = Math.round(orders.reduce((sum, o) => sum + o.totalVolumeM3, 0) * 10) / 10;
      const load: Load = {
        id: nextId("LOAD"),
        orderIds: orders.map((o) => o.id),
        originId: orders[0].originId,
        destinationId: orders[0].destinationId,
        totalWeightKg,
        totalVolumeM3,
        status: "Aguardando transporte",
      };
      return {
        ...state,
        loads: [...state.loads, load],
        orders: state.orders.map((o) =>
          action.orderIds.includes(o.id) ? { ...o, status: "Planejado", loadId: load.id } : o
        ),
      };
    }

    case "CREATE_SHIPMENT": {
      const load = state.loads.find((l) => l.id === action.loadId);
      if (!load) return state;
      const vehicle = state.vehicles.find((v) => v.status === "Disponível" && v.capacityKg >= load.totalWeightKg);
      const driver = state.drivers.find((d) => d.status === "Disponível");
      const shipment: Shipment = {
        id: nextId("SHIP", 6),
        loadId: load.id,
        carrierId: action.option.isOwnFleet ? state.carriers[0]?.id ?? "own-fleet" : action.option.id,
        vehicleId: vehicle?.id ?? state.vehicles[0]?.id ?? "TRK-001",
        driverId: driver?.id ?? state.drivers[0]?.id ?? "driver-01",
        originId: load.originId,
        destinationId: load.destinationId,
        departureTime: new Date().toISOString(),
        etaTime: new Date(Date.now() + action.option.etaDays * 86400000).toISOString(),
        status: "Planned",
        stops: [
          { id: nextId("stop", 4), locationId: load.originId, sequence: 1, kind: "Coleta", plannedTime: new Date().toISOString() },
          {
            id: nextId("stop", 4),
            locationId: load.destinationId,
            sequence: 2,
            kind: "Entrega",
            plannedTime: new Date(Date.now() + action.option.etaDays * 86400000).toISOString(),
          },
        ],
        occurrenceIds: [],
      };
      return {
        ...state,
        shipments: [...state.shipments, shipment],
        loads: state.loads.map((l) => (l.id === load.id ? { ...l, status: "Contratada", shipmentId: shipment.id } : l)),
        vehicles: state.vehicles.map((v) => (v.id === vehicle?.id ? { ...v, status: "Em Viagem" } : v)),
        drivers: state.drivers.map((d) => (d.id === driver?.id ? { ...d, status: "Em Viagem" } : d)),
      };
    }

    case "START_SHIPMENT": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment || shipment.status !== "Planned") return state;
      const load = state.loads.find((l) => l.id === shipment.loadId);
      return {
        ...state,
        shipments: state.shipments.map((s) => (s.id === shipment.id ? { ...s, status: "In Transit" } : s)),
        loads: state.loads.map((l) => (l.id === load?.id ? { ...l, status: "Em viagem" } : l)),
        orders: state.orders.map((o) =>
          load?.orderIds.includes(o.id) ? { ...o, status: "Em transporte" } : o
        ),
      };
    }

    case "CREATE_OCCURRENCE": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment) return state;
      const load = state.loads.find((l) => l.id === shipment.loadId);
      const occurrence: Occurrence = {
        id: nextId("OCC", 4),
        shipmentId: shipment.id,
        type: action.occurrenceType,
        description: `${action.occurrenceType} registrado(a) durante a execução de ${shipment.id}.`,
        reportedAt: new Date().toISOString(),
        resolved: false,
        severity: "Média",
      };
      return {
        ...state,
        occurrences: [...state.occurrences, occurrence],
        shipments: state.shipments.map((s) =>
          s.id === shipment.id ? { ...s, status: "Exception", occurrenceIds: [...s.occurrenceIds, occurrence.id] } : s
        ),
        orders: state.orders.map((o) =>
          load?.orderIds.includes(o.id) ? { ...o, status: "Com ocorrência" } : o
        ),
      };
    }

    case "RESOLVE_OCCURRENCE": {
      const occurrence = state.occurrences.find((o) => o.id === action.occurrenceId);
      if (!occurrence) return state;
      const shipment = state.shipments.find((s) => s.id === occurrence.shipmentId);
      const load = shipment ? state.loads.find((l) => l.id === shipment.loadId) : undefined;
      const backToTransit = action.action === "Nova tentativa" || action.action === "Reagendar";
      return {
        ...state,
        occurrences: state.occurrences.map((o) =>
          o.id === occurrence.id ? { ...o, resolved: true, action: action.action } : o
        ),
        shipments: state.shipments.map((s) =>
          s.id === shipment?.id ? { ...s, status: backToTransit ? "In Transit" : "At Delivery" } : s
        ),
        orders: state.orders.map((o) =>
          load?.orderIds.includes(o.id) ? { ...o, status: "Em transporte" } : o
        ),
      };
    }

    case "COMPLETE_DELIVERY": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment) return state;
      const load = state.loads.find((l) => l.id === shipment.loadId);
      if (!load) return state;
      const now = new Date().toISOString();

      const newDeliveries: Delivery[] = [];
      const newDocuments: TmsDocument[] = [];
      load.orderIds.forEach((orderId) => {
        const order = state.orders.find((o) => o.id === orderId);
        const podId = nextId("SIM", 6);
        newDocuments.push({ id: podId, type: "POD", shipmentId: shipment.id, simulated: true, issuedAt: now });
        newDeliveries.push({
          id: nextId("deliv", 4),
          shipmentId: shipment.id,
          orderId,
          customerId: order?.customerId ?? "",
          plannedWindowStart: shipment.etaTime,
          plannedWindowEnd: shipment.etaTime,
          arrivalTime: now,
          completedAt: now,
          result: "Delivered",
          podDocumentId: podId,
        });
      });

      return {
        ...state,
        shipments: state.shipments.map((s) => (s.id === shipment.id ? { ...s, status: "Delivered" } : s)),
        loads: state.loads.map((l) => (l.id === load.id ? { ...l, status: "Concluída" } : l)),
        orders: state.orders.map((o) => (load.orderIds.includes(o.id) ? { ...o, status: "Entregue" } : o)),
        deliveries: [...state.deliveries, ...newDeliveries],
        documents: [...state.documents, ...newDocuments],
        vehicles: state.vehicles.map((v) => (v.id === shipment.vehicleId ? { ...v, status: "Disponível" } : v)),
        drivers: state.drivers.map((d) => (d.id === shipment.driverId ? { ...d, status: "Disponível" } : d)),
      };
    }

    default:
      return state;
  }
}

export function toastForAction(action: SimulationAction): string {
  switch (action.type) {
    case "CREATE_LOAD":
      return "Carga criada e pedidos associados.";
    case "CREATE_SHIPMENT":
      return "Viagem criada com transporte contratado.";
    case "START_SHIPMENT":
      return "Viagem iniciada — em trânsito.";
    case "CREATE_OCCURRENCE":
      return `Ocorrência registrada: ${action.occurrenceType}.`;
    case "RESOLVE_OCCURRENCE":
      return `Ocorrência resolvida: ${action.action}.`;
    case "COMPLETE_DELIVERY":
      return "Entrega concluída — POD gerado.";
    default:
      return "";
  }
}
