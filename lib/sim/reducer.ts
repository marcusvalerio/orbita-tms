import type {
  OperationDataset,
  Order,
  OrderItem,
  CargoCharacteristic,
  Load,
  Shipment,
  Stop,
  Occurrence,
  OccurrenceType,
  OccurrenceAction,
  Delivery,
  TmsDocument,
  OrderEvent,
  EntityCounters,
  PartnerCompany,
  Solicitation,
  Freight,
  Location,
} from "../domain/types";
import { DomainError, isDomainError } from "../domain/errors";
import { estimateLeg, nearestNeighborOrder } from "../domain/geo";
import { findVehicleForWeight, type TransportOptionQuote } from "../planning/quote";

// Núcleo de regras da operação. Função pura: (estado, comando, instante) →
// novo estado. Não conhece React, banco nem autenticação — o mesmo núcleo é
// executado no navegador (Modo Demo) e no servidor (Modo Produção).

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

export interface NewPartnerCompanyInput {
  legalName: string;
  tradeName?: string;
  cnpj?: string;
  responsibleName?: string;
  phone?: string;
  email?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
}

export interface NewSolicitationInput {
  partnerCompanyId: string;
  requestedBy?: string;
  contact?: string;
  operationType: "B2B" | "B2C";
  originId: string;
  destinationId: string;
  pickupDate: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  deliveryDate: string;
  deliveryWindowStart?: string;
  deliveryWindowEnd?: string;
  destinationContactName?: string;
  destinationContactPhone?: string;
  productDescription: string;
  quantity: number;
  totalWeightKg: number;
  totalVolumeM3?: number;
  unit?: string;
  cargoCharacteristics: CargoCharacteristic[];
  temperatureMin?: number;
  temperatureMax?: number;
  temperatureNotes?: string;
  nfeNumber?: string;
  romaneioNumber?: string;
  otherDocuments?: string;
  notes?: string;
}

export type SimulationAction =
  | { type: "CREATE_ORDER"; input: NewOrderInput }
  | { type: "CREATE_LOAD"; orderIds: string[] }
  | {
      type: "CREATE_SHIPMENT";
      loadId: string;
      option: TransportOptionQuote;
      /** Escolha explícita do gestor; sem ela, o sistema sugere o menor veículo que comporta a carga. */
      vehicleId?: string;
      driverId?: string;
      routeCode?: string;
    }
  | { type: "START_SHIPMENT"; shipmentId: string }
  | { type: "CREATE_OCCURRENCE"; shipmentId: string; occurrenceType: OccurrenceType }
  | { type: "RESOLVE_OCCURRENCE"; occurrenceId: string; action: OccurrenceAction }
  | { type: "COMPLETE_DELIVERY"; shipmentId: string }
  | { type: "CREATE_PARTNER_COMPANY"; input: NewPartnerCompanyInput }
  | { type: "REGENERATE_PARTNER_CODE"; partnerCompanyId: string }
  | { type: "CREATE_SOLICITATION"; input: NewSolicitationInput }
  | { type: "CONVERT_SOLICITATION_TO_ORDER"; solicitationId: string; customerId: string; priority: "Normal" | "Alta" | "Urgente" };

export type SimulationActionType = SimulationAction["type"];

/** Fuso da operação. O Brasil não adota horário de verão desde 2019. */
export const OPERATION_UTC_OFFSET = "-03:00";

/** Tempo médio de atendimento por parada de entrega (descarga + conferência). */
export const DEFAULT_SERVICE_MINUTES = 20;

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
  message: string,
  now: string
): [OrderEvent[], EntityCounters] {
  let c = counters;
  const newEvents: OrderEvent[] = orderIds.map((orderId) => {
    let id: string;
    [id, c] = takeId(c, "event", "evt");
    return { id, orderId, message, timestamp: now };
  });
  return [[...events, ...newEvents], c];
}

/** "2026-09-30" ou ISO completo + "HH:MM" → ISO no fuso da operação. */
export function operationDateTime(date: string, time: string): string {
  return new Date(`${date.slice(0, 10)}T${time}:00${OPERATION_UTC_OFFSET}`).toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function requireLocation(state: OperationDataset, id: string, role: string): Location {
  const loc = state.locations.find((l) => l.id === id);
  if (!loc) throw new DomainError(`${role} não encontrada no cadastro de locais.`);
  return loc;
}

/** Janela de entrega de um pedido: horário combinado ou, na falta dele, o dia inteiro do prazo. */
function orderDeliveryWindow(order: Order): { start: string; end: string } {
  if (order.deliveryWindowStart && order.deliveryWindowEnd) {
    return {
      start: operationDateTime(order.dueDate, order.deliveryWindowStart),
      end: operationDateTime(order.dueDate, order.deliveryWindowEnd),
    };
  }
  return { start: operationDateTime(order.dueDate, "00:00"), end: operationDateTime(order.dueDate, "23:59") };
}

/**
 * Monta as paradas da viagem: coleta na origem e uma parada de entrega por
 * destino distinto, na sequência sugerida pelo vizinho mais próximo.
 */
function buildStops(
  state: OperationDataset,
  shipmentId: string,
  load: Load,
  departure: string
): { stops: Stop[]; distanceKm: number; durationMin: number } {
  const origin = requireLocation(state, load.originId, "Origem");
  const orders = state.orders.filter((o) => load.orderIds.includes(o.id));
  const byDestination = new Map<string, Order[]>();
  orders.forEach((o) => byDestination.set(o.destinationId, [...(byDestination.get(o.destinationId) ?? []), o]));
  const destinations = [...byDestination.keys()].map((id) => requireLocation(state, id, "Destino"));
  const sequence = nearestNeighborOrder(origin, destinations);

  const stops: Stop[] = [
    { id: `${shipmentId}-P1`, locationId: origin.id, sequence: 1, kind: "Coleta", plannedTime: departure },
  ];
  let clock = departure;
  let distanceKm = 0;
  let durationMin = 0;
  let previous: Location = origin;
  sequence.forEach((dest, i) => {
    const leg = estimateLeg(previous, dest);
    distanceKm += leg.distanceKm;
    durationMin += leg.durationMin + DEFAULT_SERVICE_MINUTES;
    clock = addMinutes(clock, leg.durationMin);
    const stopOrders = byDestination.get(dest.id)!;
    const windows = stopOrders.map(orderDeliveryWindow);
    stops.push({
      id: `${shipmentId}-P${i + 2}`,
      locationId: dest.id,
      sequence: i + 2,
      kind: "Entrega",
      plannedTime: clock,
      orderIds: stopOrders.map((o) => o.id),
      windowStart: windows.map((w) => w.start).sort()[windows.length - 1],
      windowEnd: windows.map((w) => w.end).sort()[0],
      serviceMinutes: DEFAULT_SERVICE_MINUTES,
    });
    clock = addMinutes(clock, DEFAULT_SERVICE_MINUTES);
    previous = dest;
  });
  return { stops, distanceKm: Math.round(distanceKm * 10) / 10, durationMin };
}

const ACTIVE_SHIPMENT_STATUSES = ["Awaiting Pickup", "Pickup Completed", "In Transit", "At Delivery", "Exception"];

const OCCURRENCE_SEVERITY: Record<OccurrenceType, Occurrence["severity"]> = {
  Atraso: "Baixa",
  "Endereço incorreto": "Baixa",
  "Destinatário ausente": "Média",
  Avaria: "Média",
  "Problema mecânico": "Média",
  Recusa: "Média",
  Devolução: "Média",
  Acidente: "Crítica",
  Extravio: "Crítica",
  Roubo: "Crítica",
};

export function reduce(state: OperationDataset, action: SimulationAction, nowDate: Date = new Date()): OperationDataset {
  const now = nowDate.toISOString();
  switch (action.type) {
    case "CREATE_ORDER": {
      const { input } = action;

      // Validações de domínio — não dependem só da UI.
      if (input.items.length === 0) throw new DomainError("O pedido precisa de pelo menos um item.");
      const hasInvalidItem = input.items.some(
        (it) => it.quantity <= 0 || it.unitWeightKg <= 0 || (it.volumeM3 !== undefined && it.volumeM3 < 0)
      );
      if (hasInvalidItem) throw new DomainError("Quantidade e peso dos itens devem ser maiores que zero.");
      if (input.items.some((it) => !it.productId && !it.description?.trim())) {
        throw new DomainError("Cada item precisa de um produto do catálogo ou de uma descrição.");
      }
      if (new Date(input.dueDate).getTime() < new Date(input.pickupDate).getTime()) {
        throw new DomainError("A data de entrega não pode ser anterior à coleta.");
      }
      if (input.pickupWindowStart && input.pickupWindowEnd && input.pickupWindowEnd < input.pickupWindowStart) {
        throw new DomainError("A janela de coleta termina antes de começar.");
      }
      if (
        input.deliveryWindowStart &&
        input.deliveryWindowEnd &&
        input.deliveryWindowEnd < input.deliveryWindowStart
      ) {
        throw new DomainError("A janela de entrega termina antes de começar.");
      }
      if (!state.customers.some((c) => c.id === input.customerId)) throw new DomainError("Cliente não encontrado.");
      requireLocation(state, input.originId, "Origem");
      requireLocation(state, input.destinationId, "Destino");

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
        Math.round(items.reduce((sum, it) => sum + (it.volumeM3 ?? it.weightKg / 140), 0) * 100) / 100;

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
        requestDate: now,
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

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        [order.id],
        "Pedido criado e enviado para planejamento.",
        now
      );

      return { ...state, orders: [...state.orders, order], orderEvents, counters: counters2 };
    }

    case "CREATE_LOAD": {
      const orders = state.orders.filter((o) => action.orderIds.includes(o.id));
      if (orders.length === 0 || orders.length !== new Set(action.orderIds).size) {
        throw new DomainError("Selecione pedidos existentes para formar a carga.");
      }
      const notAwaiting = orders.find((o) => o.status !== "Aguardando planejamento");
      if (notAwaiting) throw new DomainError(`${notAwaiting.id} não está aguardando planejamento.`);
      if (new Set(orders.map((o) => o.originId)).size > 1) {
        throw new DomainError("Uma carga só consolida pedidos da mesma origem.");
      }
      const totalWeightKg = Math.round(orders.reduce((sum, o) => sum + o.totalWeightKg, 0) * 100) / 100;
      const maxCapacity = Math.max(0, ...state.vehicles.map((v) => v.capacityKg));
      if (state.vehicles.length > 0 && totalWeightKg > maxCapacity) {
        throw new DomainError(
          `A carga (${totalWeightKg.toLocaleString("pt-BR")} kg) excede o maior veículo da frota (${maxCapacity.toLocaleString("pt-BR")} kg).`
        );
      }
      const totalVolumeM3 = Math.round(orders.reduce((sum, o) => sum + o.totalVolumeM3, 0) * 10) / 10;

      const [loadId, counters] = takeId(state.counters, "load", "CAR");
      const origin = requireLocation(state, orders[0].originId, "Origem");
      const destinations = [...new Set(orders.map((o) => o.destinationId))].map((id) =>
        requireLocation(state, id, "Destino")
      );
      const lastStop = nearestNeighborOrder(origin, destinations).at(-1)!;

      const load: Load = {
        id: loadId,
        orderIds: orders.map((o) => o.id),
        originId: origin.id,
        destinationId: lastStop.id,
        totalWeightKg,
        totalVolumeM3,
        status: "Aguardando transporte",
      };

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        load.orderIds,
        `Carga ${load.id} formada.`,
        now
      );

      return {
        ...state,
        loads: [...state.loads, load],
        orders: state.orders.map((o) =>
          load.orderIds.includes(o.id) ? { ...o, status: "Planejado", loadId: load.id } : o
        ),
        orderEvents,
        counters: counters2,
      };
    }

    case "CREATE_SHIPMENT": {
      const load = state.loads.find((l) => l.id === action.loadId);
      if (!load) throw new DomainError("Carga não encontrada.");
      if (load.status !== "Aguardando transporte" || load.shipmentId) {
        throw new DomainError(`A carga ${load.id} já foi contratada.`);
      }
      const { option } = action;

      let carrierId: string | undefined;
      let vehicleId: string | undefined;
      let driverId: string | undefined;
      if (option.isOwnFleet) {
        const vehicle = action.vehicleId
          ? state.vehicles.find((v) => v.id === action.vehicleId)
          : findVehicleForWeight(state.vehicles, load.totalWeightKg);
        if (!vehicle) throw new DomainError("Nenhum veículo disponível comporta esta carga.");
        if (vehicle.status !== "Disponível") throw new DomainError(`O veículo ${vehicle.id} não está disponível.`);
        if (vehicle.capacityKg < load.totalWeightKg) {
          throw new DomainError(`O veículo ${vehicle.id} não comporta ${load.totalWeightKg.toLocaleString("pt-BR")} kg.`);
        }
        const driver = action.driverId
          ? state.drivers.find((d) => d.id === action.driverId)
          : state.drivers.find((d) => d.status === "Disponível");
        if (!driver) throw new DomainError("Nenhum motorista disponível.");
        if (driver.status !== "Disponível") throw new DomainError(`${driver.name} não está disponível.`);
        vehicleId = vehicle.id;
        driverId = driver.id;
      } else {
        const carrier = state.carriers.find((c) => c.id === option.id);
        if (!carrier) throw new DomainError("Transportadora não encontrada.");
        carrierId = carrier.id;
      }

      const [shipmentId, counters] = takeId(state.counters, "shipment", "VIA");
      const { stops, distanceKm, durationMin } = buildStops(state, shipmentId, load, now);
      const origin = requireLocation(state, load.originId, "Origem");
      const firstDelivery = requireLocation(state, stops[1].locationId, "Destino");
      const routeNumber = shipmentId.split("-")[1].slice(-3);
      const routeCode =
        action.routeCode?.trim() || `${origin.state}-${slug(firstDelivery.city)}-${routeNumber}`;

      const shipment: Shipment = {
        id: shipmentId,
        routeCode,
        loadId: load.id,
        carrierId,
        vehicleId,
        driverId,
        originId: load.originId,
        destinationId: load.destinationId,
        departureTime: now,
        etaTime: stops.at(-1)!.plannedTime,
        status: "Planned",
        stops,
        plannedDistanceKm: distanceKm,
        plannedDurationMin: durationMin,
        occurrenceIds: [],
      };

      const { breakdown } = option;
      const freight: Freight = {
        id: `FRT-${shipmentId}`,
        shipmentId,
        label: option.label,
        baseCost: breakdown.freightWeight,
        toll: breakdown.toll,
        gris: breakdown.gris,
        adValorem: breakdown.adValorem,
        additionalFees: breakdown.deliveryFee,
        totalCost: breakdown.total,
      };

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        load.orderIds,
        `Transportadora selecionada (${option.label}) · Frete confirmado: R$ ${option.price.toLocaleString("pt-BR")} · Viagem ${shipment.id} criada.`,
        now
      );

      return {
        ...state,
        shipments: [...state.shipments, shipment],
        freights: [...state.freights, freight],
        loads: state.loads.map((l) => (l.id === load.id ? { ...l, status: "Contratada", shipmentId: shipment.id } : l)),
        vehicles: state.vehicles.map((v) => (v.id === vehicleId ? { ...v, status: "Em Viagem" } : v)),
        drivers: state.drivers.map((d) => (d.id === driverId ? { ...d, status: "Em Viagem" } : d)),
        orderEvents,
        counters: counters2,
      };
    }

    case "START_SHIPMENT": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment) throw new DomainError("Viagem não encontrada.");
      if (shipment.status !== "Planned" && shipment.status !== "Awaiting Pickup") {
        throw new DomainError(`A viagem ${shipment.id} já foi iniciada.`);
      }
      const load = state.loads.find((l) => l.id === shipment.loadId);
      // A saída real reancora o plano: todas as chegadas previstas se deslocam juntas.
      const shiftMs = new Date(now).getTime() - new Date(shipment.departureTime).getTime();
      const shift = (iso: string) => new Date(new Date(iso).getTime() + shiftMs).toISOString();
      const stops = shipment.stops.map((s, i) =>
        i === 0 ? { ...s, plannedTime: now, actualTime: now } : { ...s, plannedTime: shift(s.plannedTime) }
      );

      const [orderEvents, counters] = withEvents(
        state.orderEvents,
        state.counters,
        load?.orderIds ?? [],
        "Viagem iniciada — em trânsito.",
        now
      );

      return {
        ...state,
        shipments: state.shipments.map((s) =>
          s.id === shipment.id
            ? { ...s, status: "In Transit", departureTime: now, etaTime: stops.at(-1)!.plannedTime, stops }
            : s
        ),
        loads: state.loads.map((l) => (l.id === load?.id ? { ...l, status: "Em viagem" } : l)),
        orders: state.orders.map((o) => (load?.orderIds.includes(o.id) ? { ...o, status: "Em transporte" } : o)),
        orderEvents,
        counters,
      };
    }

    case "CREATE_OCCURRENCE": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment) throw new DomainError("Viagem não encontrada.");
      if (shipment.status === "Delivered" || shipment.status === "Closed") {
        throw new DomainError(`A viagem ${shipment.id} já foi encerrada.`);
      }
      const load = state.loads.find((l) => l.id === shipment.loadId);

      const [occurrenceId, counters] = takeId(state.counters, "occurrence", "OCC");

      const occurrence: Occurrence = {
        id: occurrenceId,
        shipmentId: shipment.id,
        type: action.occurrenceType,
        description: `${action.occurrenceType} registrado(a) durante a execução de ${shipment.id}.`,
        reportedAt: now,
        resolved: false,
        severity: OCCURRENCE_SEVERITY[action.occurrenceType],
      };

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        load?.orderIds ?? [],
        `Ocorrência registrada: ${action.occurrenceType}.`,
        now
      );

      return {
        ...state,
        occurrences: [...state.occurrences, occurrence],
        shipments: state.shipments.map((s) =>
          s.id === shipment.id ? { ...s, status: "Exception", occurrenceIds: [...s.occurrenceIds, occurrence.id] } : s
        ),
        orders: state.orders.map((o) => (load?.orderIds.includes(o.id) ? { ...o, status: "Com ocorrência" } : o)),
        orderEvents,
        counters: counters2,
      };
    }

    case "RESOLVE_OCCURRENCE": {
      const occurrence = state.occurrences.find((o) => o.id === action.occurrenceId);
      if (!occurrence) throw new DomainError("Ocorrência não encontrada.");
      if (occurrence.resolved) throw new DomainError(`A ocorrência ${occurrence.id} já foi resolvida.`);
      const shipment = state.shipments.find((s) => s.id === occurrence.shipmentId);
      if (!shipment) throw new DomainError("Viagem da ocorrência não encontrada.");
      const load = state.loads.find((l) => l.id === shipment.loadId);
      const orderIds = load?.orderIds ?? [];

      const occurrences = state.occurrences.map((o) =>
        o.id === occurrence.id ? { ...o, resolved: true, resolvedAt: now, action: action.action } : o
      );

      if (action.action === "Devolver") {
        // Devolução encerra a viagem: a mercadoria retorna à origem e os recursos são liberados.
        let counters = state.counters;
        const returned: Delivery[] = orderIds.map((orderId) => {
          const order = state.orders.find((o) => o.id === orderId);
          const window = order ? orderDeliveryWindow(order) : { start: shipment.etaTime, end: shipment.etaTime };
          let deliveryId: string;
          [deliveryId, counters] = takeId(counters, "delivery", "ENT");
          return {
            id: deliveryId,
            shipmentId: shipment.id,
            orderId,
            customerId: order?.customerId ?? "",
            plannedWindowStart: window.start,
            plannedWindowEnd: window.end,
            completedAt: now,
            result: "Returned",
          };
        });
        const [orderEvents, counters2] = withEvents(
          state.orderEvents,
          counters,
          orderIds,
          "Ocorrência resolvida: Devolver — mercadoria retorna à origem.",
          now
        );
        return {
          ...state,
          occurrences,
          shipments: state.shipments.map((s) => (s.id === shipment.id ? { ...s, status: "Closed" } : s)),
          loads: state.loads.map((l) => (l.id === load?.id ? { ...l, status: "Concluída" } : l)),
          orders: state.orders.map((o) => (orderIds.includes(o.id) ? { ...o, status: "Devolvido" } : o)),
          deliveries: [...state.deliveries, ...returned],
          vehicles: state.vehicles.map((v) => (v.id === shipment.vehicleId ? { ...v, status: "Disponível" } : v)),
          drivers: state.drivers.map((d) => (d.id === shipment.driverId ? { ...d, status: "Disponível" } : d)),
          orderEvents,
          counters: counters2,
        };
      }

      const stillOpen = occurrences.some((o) => o.shipmentId === shipment.id && !o.resolved);
      const started = Boolean(shipment.stops[0]?.actualTime);
      const shipmentStatus = stillOpen ? "Exception" : started ? "In Transit" : "Planned";
      const orderStatus = stillOpen ? "Com ocorrência" : started ? "Em transporte" : "Planejado";

      const [orderEvents, counters] = withEvents(
        state.orderEvents,
        state.counters,
        orderIds,
        `Ocorrência resolvida: ${action.action}.`,
        now
      );

      return {
        ...state,
        occurrences,
        shipments: state.shipments.map((s) => (s.id === shipment.id ? { ...s, status: shipmentStatus } : s)),
        orders: state.orders.map((o) => (orderIds.includes(o.id) ? { ...o, status: orderStatus } : o)),
        orderEvents,
        counters,
      };
    }

    case "COMPLETE_DELIVERY": {
      const shipment = state.shipments.find((s) => s.id === action.shipmentId);
      if (!shipment) throw new DomainError("Viagem não encontrada.");
      if (shipment.status === "Exception") {
        throw new DomainError("Resolva as ocorrências abertas antes de concluir a entrega.");
      }
      if (shipment.status === "Planned" || shipment.status === "Awaiting Pickup") {
        throw new DomainError("Inicie a viagem antes de concluir a entrega.");
      }
      if (!ACTIVE_SHIPMENT_STATUSES.includes(shipment.status)) {
        throw new DomainError(`A viagem ${shipment.id} já foi encerrada.`);
      }
      const load = state.loads.find((l) => l.id === shipment.loadId);
      if (!load) throw new DomainError("Carga da viagem não encontrada.");

      let counters = state.counters;
      const newDeliveries: Delivery[] = [];
      const newDocuments: TmsDocument[] = [];

      load.orderIds.forEach((orderId) => {
        const order = state.orders.find((o) => o.id === orderId);
        const window = order ? orderDeliveryWindow(order) : { start: shipment.etaTime, end: shipment.etaTime };
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
          plannedWindowStart: window.start,
          plannedWindowEnd: window.end,
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
        "Entrega realizada — POD simulado gerado.",
        now
      );

      return {
        ...state,
        shipments: state.shipments.map((s) =>
          s.id === shipment.id
            ? {
                ...s,
                status: "Delivered",
                stops: s.stops.map((st) => (st.actualTime ? st : { ...st, actualTime: now })),
              }
            : s
        ),
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

    case "CREATE_PARTNER_COMPANY": {
      if (!action.input.legalName.trim()) throw new DomainError("Informe a razão social.");
      const [partnerId, counters] = takeId(state.counters, "partner", "PAR");
      const accessCode = generateAccessCode(action.input.legalName, state.partnerCompanies);
      const partner: PartnerCompany = {
        id: partnerId,
        ...action.input,
        status: "Ativa",
        accessCode,
        createdAt: now,
      };
      return { ...state, partnerCompanies: [...state.partnerCompanies, partner], counters };
    }

    case "REGENERATE_PARTNER_CODE": {
      const partner = state.partnerCompanies.find((p) => p.id === action.partnerCompanyId);
      if (!partner) throw new DomainError("Empresa parceira não encontrada.");
      const accessCode = generateAccessCode(partner.legalName, state.partnerCompanies);
      return {
        ...state,
        partnerCompanies: state.partnerCompanies.map((p) => (p.id === partner.id ? { ...p, accessCode } : p)),
      };
    }

    case "CREATE_SOLICITATION": {
      const { input } = action;
      const partner = state.partnerCompanies.find((p) => p.id === input.partnerCompanyId);
      if (!partner || partner.status !== "Ativa") throw new DomainError("Empresa parceira inativa ou inexistente.");
      if (input.quantity <= 0 || input.totalWeightKg <= 0) {
        throw new DomainError("Quantidade e peso devem ser maiores que zero.");
      }
      if (new Date(input.deliveryDate).getTime() < new Date(input.pickupDate).getTime()) {
        throw new DomainError("A data de entrega não pode ser anterior à coleta.");
      }
      requireLocation(state, input.originId, "Origem");
      requireLocation(state, input.destinationId, "Destino");

      const [solicitationId, counters] = takeId(state.counters, "solicitation", "SOL");
      const solicitation: Solicitation = { id: solicitationId, ...input, status: "Solicitada", createdAt: now };
      return { ...state, solicitations: [...state.solicitations, solicitation], counters };
    }

    case "CONVERT_SOLICITATION_TO_ORDER": {
      const solicitation = state.solicitations.find((s) => s.id === action.solicitationId);
      if (!solicitation) throw new DomainError("Solicitação não encontrada.");
      if (solicitation.status === "Convertida em Pedido" || solicitation.status === "Recusada") {
        throw new DomainError(`A solicitação ${solicitation.id} já foi ${solicitation.status === "Recusada" ? "recusada" : "convertida"}.`);
      }
      if (!state.customers.some((c) => c.id === action.customerId)) throw new DomainError("Cliente não encontrado.");

      const [orderId, counters] = takeId(state.counters, "order", "PED");
      const item: OrderItem = {
        id: `${orderId}-item-1`,
        description: solicitation.productDescription,
        quantity: solicitation.quantity,
        unitWeightKg: Math.round((solicitation.totalWeightKg / solicitation.quantity) * 100) / 100,
        weightKg: solicitation.totalWeightKg,
        volumeM3: solicitation.totalVolumeM3,
      };
      const order: Order = {
        id: orderId,
        originId: solicitation.originId,
        destinationId: solicitation.destinationId,
        customerId: action.customerId,
        items: [item],
        totalWeightKg: solicitation.totalWeightKg,
        totalVolumeM3: solicitation.totalVolumeM3 ?? Math.round((solicitation.totalWeightKg / 140) * 100) / 100,
        dueDate: solicitation.deliveryDate,
        priority: action.priority,
        status: "Aguardando planejamento",
        operationType: solicitation.operationType,
        requestedBy: solicitation.requestedBy,
        requestDate: solicitation.createdAt,
        generalNotes: solicitation.notes,
        pickupDate: solicitation.pickupDate,
        pickupWindowStart: solicitation.pickupWindowStart,
        pickupWindowEnd: solicitation.pickupWindowEnd,
        deliveryWindowStart: solicitation.deliveryWindowStart,
        deliveryWindowEnd: solicitation.deliveryWindowEnd,
        destinationContactName: solicitation.destinationContactName,
        destinationContactPhone: solicitation.destinationContactPhone,
        cargoCharacteristics: solicitation.cargoCharacteristics,
        temperatureMin: solicitation.temperatureMin,
        temperatureMax: solicitation.temperatureMax,
        temperatureNotes: solicitation.temperatureNotes,
      };

      const [orderEvents, counters2] = withEvents(
        state.orderEvents,
        counters,
        [order.id],
        `Pedido originado da solicitação ${solicitation.id}.`,
        now
      );

      return {
        ...state,
        orders: [...state.orders, order],
        solicitations: state.solicitations.map((s) =>
          s.id === solicitation.id ? { ...s, status: "Convertida em Pedido", orderId: order.id } : s
        ),
        orderEvents,
        counters: counters2,
      };
    }

    default:
      return state;
  }
}

export type CommandResult =
  | { ok: true; state: OperationDataset }
  | { ok: false; error: string; kind: "rule" | "unexpected" };

/**
 * Aplica um comando e informa explicitamente se ele foi aceito. Violação de
 * regra vira mensagem para a pessoa usuária; falha inesperada vira mensagem
 * genérica e o estado permanece intacto.
 */
export function applyCommand(state: OperationDataset, action: SimulationAction, now: Date = new Date()): CommandResult {
  try {
    return { ok: true, state: reduce(state, action, now) };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: err.message, kind: "rule" };
    console.error("Falha inesperada ao aplicar comando:", { type: action.type, error: err });
    return { ok: false, error: "Não foi possível concluir a ação. A operação não foi alterada.", kind: "unexpected" };
  }
}

/** Código de acesso provisório ao Portal do Parceiro — memorável, não é o ID interno, único por operação. */
function generateAccessCode(legalName: string, existing: PartnerCompany[]): string {
  const initials =
    legalName
      .toUpperCase()
      .replace(/[^A-ZÀ-Ú\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 3) || "PAR";

  let code = "";
  do {
    const digits = Math.floor(1000 + Math.random() * 9000);
    code = `${initials}-${digits}`;
  } while (existing.some((p) => p.accessCode === code));
  return code;
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
    case "CREATE_PARTNER_COMPANY":
      return "Empresa parceira cadastrada — código de acesso gerado.";
    case "REGENERATE_PARTNER_CODE":
      return "Código de acesso regenerado.";
    case "CREATE_SOLICITATION":
      return "Solicitação enviada para análise.";
    case "CONVERT_SOLICITATION_TO_ORDER":
      return "Solicitação convertida em pedido.";
    default:
      return "";
  }
}
