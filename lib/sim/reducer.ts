import type {
  OperationDataset,
  Order,
  OrderItem,
  CargoCharacteristic,
  Load,
  Shipment,
  Occurrence,
  OccurrenceType,
  OccurrenceAction,
  Delivery,
  TmsDocument,
  OrderEvent,
  EntityCounters,
} from "../domain/types";
import type { TransportOptionQuote } from "../planning/quote";

export interface NewOrderItemInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitWeightKg: number;
  volumeM3?: number;
}

export interface NewOrderInput {
  customerId: string;
  originId: string;
  destinationId: string;
  operationType: "B2B" | "B2C" | "Outro";
  requestedBy?: string;
  priority: "Normal" | "Alta" | "Urgente";
  generalNotes?: string;
  pickupDate: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  dueDate: string;
  deliveryWindowStart?: string;
  deliveryWindowEnd?: string;
  destinationContactName?: string;
  destinationContactPhone?: string;
  items: NewOrderItemInput[];
  cargoCharacteristics: CargoCharacteristic[];
  temperatureMin?: number;
  temperatureMax?: number;
  temperatureNotes?: string;
}

export type SimulationAction =
  | { type: "CREATE_ORDER"; input: NewOrderInput }
  | { type: "CREATE_LOAD"; orderIds: string[] }
  | { type: "CREATE_SHIPMENT"; loadId: string; option: TransportOptionQuote }
  | { type: "START_SHIPMENT"; shipmentId: string }
  | { type: "CREATE_OCCURRENCE"; shipmentId: string; occurrenceType: OccurrenceType }
  | { type: "RESOLVE_OCCURRENCE"; occurrenceId: string; action: OccurrenceAction }
  | { type: "COMPLETE_DELIVERY"; shipmentId: string };

/** Gera o próximo ID sequencial de um tipo de entidade e retorna os contadores atualizados. */
function takeId(counters: EntityCounters, key: keyof EntityCounters, prefix: string): [string, EntityCounters] {
  const n = counters[key];
  const id = `${prefix}-${n.toString().padStart(5, "0")}`;
  return [id, { ...counters, [key]: n + 1 }];
}

function withEvents(
  events: OrderEvent[],
  counters: EntityCounters,
  orderIds: string[],
  message: string
): [OrderEvent[], EntityCounters] {
  const now = new Date().toISOString();
  let c = counters;
  const newEvents: OrderEvent[] = orderIds.map((orderId) => {
    let id: string;
    [id, c] = takeId(c, "event", "evt");
    return { id, orderId, message, timestamp: now };
  });
  return [[...events, ...newEvents], c];
}

export function reduce(state: OperationDataset, action: SimulationAction): OperationDataset {
  switch (action.type) {
    case "CREATE_ORDER": {
      const { input } = action;

      // Validações de domínio — não dependem só da UI (seção 23 do pedido).
      if (input.items.length === 0) return state;
      const hasInvalidItem = input.items.some(
        (it) => it.quantity <= 0 || it.unitWeightKg <= 0 || (it.volumeM3 !== undefined && it.volumeM3 < 0)
      );
      if (hasInvalidItem) return state;
      if (new Date(input.dueDate).getTime() < new Date(input.pickupDate).getTime()) return state;
      if (
        input.pickupWindowStart &&
        input.pickupWindowEnd &&
        input.pickupWindowEnd < input.pickupWindowStart
      ) {
        return state;
      }
      if (
        input.deliveryWindowStart &&
        input.deliveryWindowEnd &&
        input.deliveryWindowEnd < input.deliveryWindowStart
      ) {
        return state;
      }

      const [orderId, counters] = takeId(state.counters, "order", "PED");

      const items: OrderItem[] = input.items.map((it, i) => {
        const weightKg = Math.round(it.quantity * it.unitWeightKg * 100) / 100;
        return {
          id: `${orderId}-item-${i + 1}`,
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unitWeightKg: it.unitWeightKg,
          weightKg,
          volumeM3: it.volumeM3,
        };
      });
      const totalWeightKg = Math.round(items.reduce((sum, it) => sum + it.weightKg, 0) * 100) / 100;
      // Volume: soma o informado por item; para itens sem volume declarado, estima a partir do peso.
      const totalVolumeM3 =
        Math.round(
          items.reduce((sum, it) => sum + (it.volumeM3 ?? it.weightKg / 140), 0) * 100
        ) / 100;

      const order: Order = {
        id: orderId,
        originId: input.originId,
        destinationId: input.destinationId,
        customerId: input.customerId,
        items,
        totalWeightKg,
        totalVolumeM3,
        dueDate: input.dueDate,
        priority: input.priority,
        status: "Aguardando planejamento",
        operationType: input.operationType,
        requestedBy: input.requestedBy,
        requestDate: new Date().toISOString(),
        generalNotes: input.generalNotes,
        pickupDate: input.pickupDate,
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        deliveryWindowStart: input.deliveryWindowStart,
        deliveryWindowEnd: input.deliveryWindowEnd,
        destinationContactName: input.destinationContactName,
        destinationContactPhone: input.destinationContactPhone,
        cargoCharacteristics: input.cargoCharacteristics,
        temperatureMin: input.temperatureMin,
        temperatureMax: input.temperatureMax,
        temperatureNotes: input.temperatureNotes,
      };

      const [orderEvents, counters2] = withEvents(state.orderEvents, counters, [order.id], "Pedido criado e enviado para planejamento.");

      return {
        ...state,
        orders: [...state.orders, order],
        orderEvents,
        counters: counters2,
      };
    }

    case "CREATE_LOAD": {
      const orders = state.orders.filter((o) => action.orderIds.includes(o.id));
      if (orders.length === 0) return state;
      const totalWeightKg = orders.reduce((sum, o) => sum + o.totalWeightKg, 0);
      const totalVolumeM3 = Math.round(orders.reduce((sum, o) => sum + o.totalVolumeM3, 0) * 10) / 10;

      const [loadId, counters] = takeId(state.counters, "load", "CAR");

      const load: Load = {
        id: loadId,
        orderIds: orders.map((o) => o.id),
        originId: orders[0].originId,
        destinationId: orders[0].destinationId,
        totalWeightKg,
        totalVolumeM3,
        status: "Aguardando transporte",
      };

      const [orderEvents, counters2] = withEvents(state.orderEvents, counters, action.orderIds, `Carga ${load.id} formada.`);

      return {
        ...state,
        loads: [...state.loads, load],
        orders: state.orders.map((o) =>
          action.orderIds.includes(o.id) ? { ...o, status: "Planejado", loadId: load.id } : o
        ),
        orderEvents,
        counters: counters2,
      };
    }

    case "CREATE_SHIPMENT": {
      const load = state.loads.find((l) => l.id === action.loadId);
      if (!load) return state;
      const vehicle = state.vehicles.find((v) => v.status === "Disponível" && v.capacityKg >= load.totalWeightKg);
      const driver = state.drivers.find((d) => d.status === "Disponível");

      const [shipmentId, counters] = takeId(state.counters, "shipment", "VIA");

      const departure = new Date().toISOString();
      const eta = new Date(Date.now() + action.option.etaDays * 86400000).toISOString();

      const shipment: Shipment = {
        id: shipmentId,
        loadId: load.id,
        carrierId: action.option.isOwnFleet ? state.carriers[0]?.id ?? "own-fleet" : action.option.id,
        vehicleId: vehicle?.id ?? state.vehicles[0]?.id ?? "TRK-001",
        driverId: driver?.id ?? state.drivers[0]?.id ?? "driver-01",
        originId: load.originId,
        destinationId: load.destinationId,
        departureTime: departure,
        etaTime: eta,
        status: "Planned",
        stops: [
          { id: `${shipmentId}-stop-1`, locationId: load.originId, sequence: 1, kind: "Coleta", plannedTime: departure },
          { id: `${shipmentId}-stop-2`, locationId: load.destinationId, sequence: 2, kind: "Entrega", plannedTime: eta },
        ],
        occurrenceIds: [],
      };

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        load.orderIds,
        `Transportadora selecionada (${action.option.label}) · Frete confirmado: R$ ${action.option.price.toLocaleString("pt-BR")} · Viagem ${shipment.id} criada.`
      );

      return {
        ...state,
        shipments: [...state.shipments, shipment],
        loads: state.loads.map((l) => (l.id === load.id ? { ...l, status: "Contratada", shipmentId: shipment.id } : l)),
        vehicles: state.vehicles.map((v) => (v.id === vehicle?.id ? { ...v, status: "Em Viagem" } : v)),
        drivers: state.drivers.map((d) => (d.id === driver?.id ? { ...d, status: "Em Viagem" } : d)),
        orderEvents,
        counters: counters2,
      };
    }

    case "START_SHIPMENT": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment || shipment.status !== "Planned") return state;
      const load = state.loads.find((l) => l.id === shipment.loadId);

      const [orderEvents, counters] = withEvents(
        state.orderEvents,
        state.counters,
        load?.orderIds ?? [],
        "Viagem iniciada — em trânsito."
      );

      return {
        ...state,
        shipments: state.shipments.map((s) => (s.id === shipment.id ? { ...s, status: "In Transit" } : s)),
        loads: state.loads.map((l) => (l.id === load?.id ? { ...l, status: "Em viagem" } : l)),
        orders: state.orders.map((o) =>
          load?.orderIds.includes(o.id) ? { ...o, status: "Em transporte" } : o
        ),
        orderEvents,
        counters,
      };
    }

    case "CREATE_OCCURRENCE": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment) return state;
      const load = state.loads.find((l) => l.id === shipment.loadId);

      const [occurrenceId, counters] = takeId(state.counters, "occurrence", "OCC");

      const occurrence: Occurrence = {
        id: occurrenceId,
        shipmentId: shipment.id,
        type: action.occurrenceType,
        description: `${action.occurrenceType} registrado(a) durante a execução de ${shipment.id}.`,
        reportedAt: new Date().toISOString(),
        resolved: false,
        severity: "Média",
      };

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        load?.orderIds ?? [],
        `Ocorrência registrada: ${action.occurrenceType}.`
      );

      return {
        ...state,
        occurrences: [...state.occurrences, occurrence],
        shipments: state.shipments.map((s) =>
          s.id === shipment.id ? { ...s, status: "Exception", occurrenceIds: [...s.occurrenceIds, occurrence.id] } : s
        ),
        orders: state.orders.map((o) =>
          load?.orderIds.includes(o.id) ? { ...o, status: "Com ocorrência" } : o
        ),
        orderEvents,
        counters: counters2,
      };
    }

    case "RESOLVE_OCCURRENCE": {
      const occurrence = state.occurrences.find((o) => o.id === action.occurrenceId);
      if (!occurrence) return state;
      const shipment = state.shipments.find((s) => s.id === occurrence.shipmentId);
      const load = shipment ? state.loads.find((l) => l.id === shipment.loadId) : undefined;
      const backToTransit = action.action === "Nova tentativa" || action.action === "Reagendar";

      const [orderEvents, counters] = withEvents(
        state.orderEvents,
        state.counters,
        load?.orderIds ?? [],
        `Ocorrência resolvida: ${action.action}.`
      );

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
        orderEvents,
        counters,
      };
    }

    case "COMPLETE_DELIVERY": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment) return state;
      const load = state.loads.find((l) => l.id === shipment.loadId);
      if (!load) return state;
      const now = new Date().toISOString();

      let counters = state.counters;
      const newDeliveries: Delivery[] = [];
      const newDocuments: TmsDocument[] = [];

      load.orderIds.forEach((orderId) => {
        const order = state.orders.find((o) => o.id === orderId);
        let deliveryId: string;
        [deliveryId, counters] = takeId(counters, "delivery", "ENT");
        let podId: string;
        [podId, counters] = takeId(counters, "pod", "POD");

        newDocuments.push({ id: podId, type: "POD", shipmentId: shipment.id, simulated: true, issuedAt: now });
        newDeliveries.push({
          id: deliveryId,
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

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        load.orderIds,
        "Entrega realizada — POD simulado gerado."
      );

      return {
        ...state,
        shipments: state.shipments.map((s) => (s.id === shipment.id ? { ...s, status: "Delivered" } : s)),
        loads: state.loads.map((l) => (l.id === load.id ? { ...l, status: "Concluída" } : l)),
        orders: state.orders.map((o) => (load.orderIds.includes(o.id) ? { ...o, status: "Entregue" } : o)),
        deliveries: [...state.deliveries, ...newDeliveries],
        documents: [...state.documents, ...newDocuments],
        vehicles: state.vehicles.map((v) => (v.id === shipment.vehicleId ? { ...v, status: "Disponível" } : v)),
        drivers: state.drivers.map((d) => (d.id === shipment.driverId ? { ...d, status: "Disponível" } : d)),
        orderEvents,
        counters: counters2,
      };
    }

    default:
      return state;
  }
}

export function toastForAction(action: SimulationAction): string {
  switch (action.type) {
    case "CREATE_ORDER":
      return "Pedido criado e enviado para a fila de planejamento.";
    case "CREATE_LOAD":
      return "Carga criada e pedidos associados.";
    case "CREATE_SHIPMENT":
      return "Contratação confirmada — viagem criada.";
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
