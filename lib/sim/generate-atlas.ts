import { createRng, pick, pickMany, intBetween, floatBetween, chance } from "./rng";
import type {
  Company,
  Location,
  Customer,
  Product,
  Vehicle,
  Driver,
  Carrier,
  Order,
  OrderItem,
  OrderStatus,
  Load,
  LoadStatus,
  Tender,
  TenderOption,
  Shipment,
  ShipmentStatus,
  Stop,
  Occurrence,
  OccurrenceType,
  Delivery,
  Rate,
  Freight,
  TmsDocument,
  KpiSnapshot,
  OperationDataset,
} from "../domain/types";

const SEED = 8420; // fixo — a simulação é sempre a mesma

// ---------------------------------------------------------------------------
// Dados de referência do mundo simulado
// ---------------------------------------------------------------------------

const CDS = [
  { name: "CD Rio de Janeiro", city: "Rio de Janeiro", state: "RJ", lat: -22.9068, lng: -43.1729 },
  { name: "CD São Paulo", city: "São Paulo", state: "SP", lat: -23.5505, lng: -46.6333 },
  { name: "CD Belo Horizonte", city: "Belo Horizonte", state: "MG", lat: -19.9167, lng: -43.9345 },
];

const CLIENT_CITIES = [
  { city: "Niterói", state: "RJ", lat: -22.8833, lng: -43.1036 },
  { city: "Petrópolis", state: "RJ", lat: -22.5112, lng: -43.1779 },
  { city: "Duque de Caxias", state: "RJ", lat: -22.7856, lng: -43.3117 },
  { city: "Campinas", state: "SP", lat: -22.9099, lng: -47.0626 },
  { city: "Santos", state: "SP", lat: -23.9608, lng: -46.3336 },
  { city: "Guarulhos", state: "SP", lat: -23.4538, lng: -46.5333 },
  { city: "Sorocaba", state: "SP", lat: -23.5015, lng: -47.4526 },
  { city: "Uberlândia", state: "MG", lat: -18.9186, lng: -48.2772 },
  { city: "Juiz de Fora", state: "MG", lat: -21.7642, lng: -43.3467 },
  { city: "Contagem", state: "MG", lat: -19.9317, lng: -44.0536 },
  { city: "Vitória", state: "ES", lat: -20.3155, lng: -40.3128 },
  { city: "Vila Velha", state: "ES", lat: -20.3297, lng: -40.2925 },
];

const CUSTOMER_NAMES = [
  "Mercado Bom Preço", "Farmácia Vitalis", "Distribuidora Central", "Auto Peças Rota Sul",
  "Supermercado Raiz", "Constrular Materiais", "Ótica Visão Clara", "Papelaria Horizonte",
  "Móveis Bento", "Eletro Fácil", "Padaria Trigo Dourado", "Depósito São Judas",
  "Farmavida Drogaria", "Mercearia Ponto Certo", "Casa das Tintas", "Comercial Alvorada",
  "Rede Nutrimais", "Atacado União", "Distribuidora Rio Verde", "Loja Estrela Sul",
  "Armazém do Zé", "Mercado Nova Era", "Grupo Ferraz Distribuição", "Center Box Atacado",
  "Comercial Planalto", "Distribuidora Bela Vista", "Rede Popular", "Atacadão Serrano",
];

const PRODUCTS = [
  { name: "Caixa de bebidas", category: "Alimentos e Bebidas" },
  { name: "Pallet de material de construção", category: "Construção" },
  { name: "Caixa de medicamentos", category: "Farma" },
  { name: "Lote de eletrodomésticos", category: "Eletro" },
  { name: "Fardo de papelaria", category: "Papelaria" },
  { name: "Caixa de autopeças", category: "Autopeças" },
  { name: "Lote de móveis desmontados", category: "Móveis" },
  { name: "Caixa de produtos de limpeza", category: "Higiene e Limpeza" },
];

const CARRIER_NAMES = [
  "RioLog", "FastCargo", "Trans Serrana", "Malha Sudeste", "Vetor Cargas",
  "Elo Transportes", "Cargo Prime", "Rota Azul Log", "Bravo Trans", "Union Cargas",
];

const DRIVER_NAMES = [
  "Carlos Silva", "Marcos Andrade", "José Ribeiro", "Antônio Farias", "Paulo Nascimento",
  "Roberto Lima", "Eduardo Souza", "Fernando Alves", "Ricardo Gomes", "André Pereira",
  "Sérgio Barbosa", "Luiz Fernandes", "Marcelo Teixeira", "Bruno Cardoso", "Diego Martins",
];

function pad(n: number, len: number): string {
  return n.toString().padStart(len, "0");
}

function isoDaysFromNow(days: number, hour = 8, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Geração principal
// ---------------------------------------------------------------------------

/**
 * Dados de referência (cadastros): localidades, clientes, produtos, frota,
 * motoristas e transportadoras. Representam a infraestrutura da operação —
 * não fazem parte do que "Reiniciar Simulação" apaga, pois não são
 * movimentações, e por isso ficam disponíveis tanto para a operação vazia
 * quanto para o cenário de demonstração.
 */
export function generateReferenceData(rng: () => number) {
  const company: Company = {
    id: "atlas",
    name: "Atlas Distribuição",
    region: "Sudeste",
    operationType: "Rodoviária",
  };

  // --- Locations ------------------------------------------------------------
  const locations: Location[] = [];
  CDS.forEach((cd, i) => {
    locations.push({
      id: `loc-cd-${i + 1}`,
      name: cd.name,
      city: cd.city,
      state: cd.state,
      kind: "CD",
      lat: cd.lat,
      lng: cd.lng,
    });
  });
  CLIENT_CITIES.forEach((c, i) => {
    locations.push({
      id: `loc-cli-${i + 1}`,
      name: c.city,
      city: c.city,
      state: c.state,
      kind: "Cliente",
      lat: c.lat,
      lng: c.lng,
    });
  });
  const clientLocations = locations.filter((l) => l.kind === "Cliente");

  // --- Customers --------------------------------------------------------
  const customers: Customer[] = CUSTOMER_NAMES.map((name, i) => ({
    id: `cust-${pad(i + 1, 3)}`,
    name,
    locationId: pick(rng, clientLocations).id,
  }));

  // --- Products -----------------------------------------------------------
  const products: Product[] = PRODUCTS.map((p, i) => ({
    id: `prod-${pad(i + 1, 2)}`,
    name: p.name,
    category: p.category,
  }));

  // --- Vehicles -------------------------------------------------------------
  const vehicleTypes: { type: Vehicle["type"]; capKg: number; capM3: number }[] = [
    { type: "Van", capKg: 1200, capM3: 6 },
    { type: "Toco", capKg: 3500, capM3: 20 },
    { type: "Truck", capKg: 8000, capM3: 40 },
    { type: "Carreta", capKg: 27000, capM3: 90 },
  ];
  const vehicleCount = 15;
  const vehicles: Vehicle[] = Array.from({ length: vehicleCount }, (_, i) => {
    const spec = pick(rng, vehicleTypes);
    return {
      id: `TRK-${pad(i + 1, 3)}`,
      plate: `RIO${intBetween(rng, 1000, 9999)}`,
      type: spec.type,
      capacityKg: spec.capKg,
      capacityM3: spec.capM3,
      ownership: chance(rng, 0.4) ? "Frota Própria" : "Terceiro",
      status: pick(rng, ["Disponível", "Disponível", "Em Viagem", "Manutenção"] as const),
    };
  });

  // --- Drivers ----------------------------------------------------------
  const drivers: Driver[] = DRIVER_NAMES.map((name, i) => ({
    id: `driver-${pad(i + 1, 2)}`,
    name,
    cnhCategory: pick(rng, ["B", "C", "D", "E"]),
    status: pick(rng, ["Disponível", "Disponível", "Em Viagem", "Folga"] as const),
  }));

  // --- Carriers -----------------------------------------------------------
  const carrierCount = 5;
  const carriers: Carrier[] = CARRIER_NAMES.slice(0, carrierCount).map((name, i) => ({
    id: `carrier-${pad(i + 1, 2)}`,
    name,
    regions: pickMany(rng, ["RJ", "SP", "MG", "ES"], intBetween(rng, 1, 3)),
    cargoTypes: pickMany(rng, ["Fracionado", "Lotação", "Distribuição", "Transferência"], intBetween(rng, 1, 2)),
    slaPercent: floatBetween(rng, 82, 98, 1),
    otifPercent: floatBetween(rng, 78, 97, 1),
    avgCostPerKm: floatBetween(rng, 1.4, 3.2, 2),
    occurrenceRate: floatBetween(rng, 0.02, 0.18, 2),
  }));

  return { company, locations, customers, products, vehicles, drivers, carriers };
}

export function generateAtlasOperation(): OperationDataset {
  const rng = createRng(SEED);

  const { company, locations, customers, products, vehicles, drivers, carriers } = generateReferenceData(rng);
  const cds = locations.filter((l) => l.kind === "CD");
  const clientLocations = locations.filter((l) => l.kind === "Cliente");

  // --- Orders -------------------------------------------------------------
  const orderStatusPool: OrderStatus[] = [
    "Aguardando planejamento", "Aguardando planejamento", "Aguardando planejamento",
    "Aguardando planejamento", "Aguardando planejamento",
    "Planejado",
    "Em transporte", "Em transporte",
    "Entregue", "Entregue", "Entregue", "Entregue",
    "Com ocorrência",
  ];

  const orderCount = 20;
  const orders: Order[] = Array.from({ length: orderCount }, (_, i) => {
    const origin = pick(rng, cds);
    const destination = pick(rng, clientLocations);
    const customer = pick(rng, customers.filter((c) => c.locationId === destination.id)) ??
      pick(rng, customers);
    const itemCount = intBetween(rng, 1, 3);
    const items: OrderItem[] = Array.from({ length: itemCount }, (_, j) => {
      const quantity = intBetween(rng, 1, 40);
      const unitWeightKg = Math.round((intBetween(rng, 60, 900) / quantity) * 10) / 10;
      const weight = Math.round(quantity * unitWeightKg * 10) / 10;
      return {
        id: `item-${pad(i + 1, 3)}-${j + 1}`,
        productId: pick(rng, products).id,
        quantity,
        unitWeightKg,
        weightKg: weight,
      };
    });
    const totalWeightKg = items.reduce((sum, it) => sum + it.weightKg, 0);
    const pickupDate = isoDaysFromNow(intBetween(rng, -2, 0));
    return {
      id: `PED-${10480 + i}`,
      originId: origin.id,
      destinationId: destination.id,
      customerId: customer.id,
      items,
      totalWeightKg,
      totalVolumeM3: Math.round((totalWeightKg / 140) * 10) / 10,
      dueDate: isoDaysFromNow(intBetween(rng, -1, 4)),
      priority: pick(rng, ["Normal", "Normal", "Normal", "Alta", "Urgente"] as const),
      status: pick(rng, orderStatusPool),
      operationType: pick(rng, ["B2B", "B2C", "B2C"] as const),
      requestDate: pickupDate,
      pickupDate,
      cargoCharacteristics: [],
    };
  });

  // --- Loads: consolida pedidos compatíveis (mesma origem+destino) --------
  const loads: Load[] = [];
  const groupable = orders.filter((o) => o.status !== "Aguardando planejamento");
  const groupedKeys = new Map<string, Order[]>();
  groupable.forEach((o) => {
    const key = `${o.originId}__${o.destinationId}`;
    const arr = groupedKeys.get(key) ?? [];
    arr.push(o);
    groupedKeys.set(key, arr);
  });

  let loadSeq = 380;
  groupedKeys.forEach((groupOrders) => {
    // quebra o grupo em cargas de até 3 pedidos
    for (let i = 0; i < groupOrders.length; i += 2) {
      const chunk = groupOrders.slice(i, i + 2);
      loadSeq += 1;
      const totalWeightKg = chunk.reduce((s, o) => s + o.totalWeightKg, 0);
      const totalVolumeM3 = Math.round(chunk.reduce((s, o) => s + o.totalVolumeM3, 0) * 10) / 10;
      const anyEmTransito = chunk.some((o) => o.status === "Em transporte" || o.status === "Com ocorrência");
      const anyEntregue = chunk.every((o) => o.status === "Entregue");
      const status: LoadStatus = anyEntregue
        ? "Concluída"
        : anyEmTransito
        ? "Em viagem"
        : chance(rng, 0.5)
        ? "Contratada"
        : "Aguardando transporte";
      const load: Load = {
        id: `LOAD-${pad(loadSeq, 5)}`,
        orderIds: chunk.map((o) => o.id),
        originId: chunk[0].originId,
        destinationId: chunk[0].destinationId,
        totalWeightKg,
        totalVolumeM3,
        status,
      };
      loads.push(load);
      chunk.forEach((o) => (o.loadId = load.id));
    }
  });

  // --- Tenders --------------------------------------------------------------
  const tenders: Tender[] = loads
    .filter((l) => l.status !== "Aguardando transporte")
    .map((load) => {
      const optionCarriers = pickMany(rng, carriers, Math.min(2, carriers.length));
      const options: TenderOption[] = [
        {
          id: `tender-opt-${load.id}-own`,
          loadId: load.id,
          carrierId: "own-fleet",
          isOwnFleet: true,
          price: Math.round(load.totalWeightKg * floatBetween(rng, 0.7, 0.95, 2)),
          etaDays: 1,
          slaPercent: 100,
          occupancyPercent: intBetween(rng, 55, 90),
        },
        ...optionCarriers.map((carrier, idx) => ({
          id: `tender-opt-${load.id}-${carrier.id}`,
          loadId: load.id,
          carrierId: carrier.id,
          isOwnFleet: false,
          price: Math.round(load.totalWeightKg * carrier.avgCostPerKm * 0.05 * (1 + idx * 0.1)),
          etaDays: intBetween(rng, 1, 2),
          slaPercent: carrier.slaPercent,
          occupancyPercent: intBetween(rng, 55, 90),
        })),
      ];
      const selected = pick(rng, options);
      return {
        id: `tender-${load.id}`,
        loadId: load.id,
        options,
        selectedOptionId: selected.id,
      };
    });

  // --- Shipments --------------------------------------------------------------
  const availableVehicles = vehicles.filter((v) => v.status !== "Manutenção");
  const shipments: Shipment[] = [];
  let shipSeq = 380;
  tenders.forEach((tender) => {
    const load = loads.find((l) => l.id === tender.loadId)!;
    const selectedOption = tender.options.find((o) => o.id === tender.selectedOptionId)!;
    const vehicle = pick(rng, availableVehicles);
    const driver = pick(rng, drivers);
    shipSeq += 1;

    let status: ShipmentStatus = "Planned";
    switch (load.status) {
      case "Concluída":
        status = "Delivered";
        break;
      case "Em viagem":
        status = pick(rng, ["In Transit", "At Delivery", "Exception"] as const);
        break;
      default:
        status = pick(rng, ["Planned", "Awaiting Pickup"] as const);
    }

    const departure = isoDaysFromNow(intBetween(rng, -2, 1), intBetween(rng, 6, 9), 30);
    const eta = isoDaysFromNow(intBetween(rng, -1, 2), intBetween(rng, 12, 18), 0);

    const stops: Stop[] = [
      {
        id: `stop-${shipSeq}-1`,
        locationId: load.originId,
        sequence: 1,
        kind: "Coleta",
        plannedTime: departure,
        actualTime: status !== "Planned" ? departure : undefined,
      },
      {
        id: `stop-${shipSeq}-2`,
        locationId: load.destinationId,
        sequence: 2,
        kind: "Entrega",
        plannedTime: eta,
        actualTime: status === "Delivered" ? eta : undefined,
      },
    ];

    const shipment: Shipment = {
      id: `SHIP-${pad(shipSeq, 6)}`,
      loadId: load.id,
      carrierId: selectedOption.isOwnFleet ? carriers[0]?.id ?? "own-fleet" : selectedOption.carrierId,
      vehicleId: vehicle.id,
      driverId: driver.id,
      originId: load.originId,
      destinationId: load.destinationId,
      departureTime: departure,
      etaTime: eta,
      status,
      stops,
      occurrenceIds: [],
    };
    shipments.push(shipment);
    load.shipmentId = shipment.id;
  });

  // --- Occurrences ----------------------------------------------------------
  const occurrenceTypes: OccurrenceType[] = [
    "Atraso", "Avaria", "Destinatário ausente", "Endereço incorreto",
    "Problema mecânico", "Acidente", "Extravio", "Roubo", "Recusa", "Devolução",
  ];
  const occurrences: Occurrence[] = [];
  shipments
    .filter((s) => s.status === "Exception" || (s.status !== "Planned" && chance(rng, 0.12)))
    .forEach((s, i) => {
      const type = pick(rng, occurrenceTypes);
      const resolved = s.status !== "Exception" ? true : chance(rng, 0.3);
      const occurrence: Occurrence = {
        id: `occ-${pad(i + 1, 3)}`,
        shipmentId: s.id,
        type,
        description: `${type} registrado(a) durante a execução de ${s.id}.`,
        reportedAt: s.departureTime,
        resolved,
        action: resolved ? pick(rng, ["Reagendar", "Nova tentativa", "Devolver", "Contatar cliente"] as const) : undefined,
        severity: pick(rng, ["Baixa", "Média", "Crítica"] as const),
      };
      occurrences.push(occurrence);
      s.occurrenceIds.push(occurrence.id);
      if (!resolved) s.status = "Exception";
    });

  // --- Deliveries -----------------------------------------------------------
  const deliveries: Delivery[] = [];
  let docSeq = 380;
  const documents: TmsDocument[] = [];

  shipments.forEach((s) => {
    const load = loads.find((l) => l.id === s.loadId)!;
    const orderIds = load.orderIds;
    orderIds.forEach((orderId) => {
      const order = orders.find((o) => o.id === orderId)!;
      const windowStart = s.etaTime;
      const windowEnd = isoDaysFromNow(0, new Date(s.etaTime).getHours() + 2);
      let result: Delivery["result"];
      let completedAt: string | undefined;
      if (s.status === "Delivered" || s.status === "Closed") {
        result = s.occurrenceIds.length > 0 && chance(rng, 0.4) ? "Partial Delivery" : "Delivered";
        completedAt = s.etaTime;
      } else if (s.status === "Exception" && !occurrences.find((o) => o.shipmentId === s.id && !o.resolved)) {
        result = chance(rng, 0.5) ? "Failed" : "Returned";
      }

      let podId: string | undefined;
      if (result === "Delivered" || result === "Partial Delivery") {
        docSeq += 1;
        podId = `SIM-${pad(docSeq, 6)}`;
        documents.push({
          id: podId,
          type: "POD",
          shipmentId: s.id,
          simulated: true,
          issuedAt: completedAt ?? s.etaTime,
        });
      }

      deliveries.push({
        id: `deliv-${orderId}`,
        shipmentId: s.id,
        orderId,
        customerId: order.customerId,
        plannedWindowStart: windowStart,
        plannedWindowEnd: windowEnd,
        arrivalTime: result ? s.etaTime : undefined,
        completedAt,
        result,
        podDocumentId: podId,
      });
      if (result) order.status = result === "Delivered" ? "Entregue" : order.status;
    });

    // Documentos de transporte por shipment
    docSeq += 1;
    documents.push({
      id: `SIM-${pad(docSeq, 6)}`,
      type: "Ordem de Transporte",
      shipmentId: s.id,
      simulated: true,
      issuedAt: s.departureTime,
    });
    docSeq += 1;
    documents.push({
      id: `SIM-${pad(docSeq, 6)}`,
      type: "MDF-e",
      shipmentId: s.id,
      simulated: true,
      issuedAt: s.departureTime,
    });
    load.orderIds.forEach(() => {
      docSeq += 1;
      documents.push({
        id: `SIM-${pad(docSeq, 6)}`,
        type: "CT-e",
        shipmentId: s.id,
        simulated: true,
        issuedAt: s.departureTime,
      });
    });
  });

  // --- Rates ------------------------------------------------------------
  const rates: Rate[] = carriers.map((carrier, i) => ({
    id: `rate-${pad(i + 1, 2)}`,
    carrierId: carrier.id,
    originState: "RJ",
    destinationState: pick(rng, ["SP", "MG", "ES", "RJ"]),
    brackets: [
      { minKg: 0, maxKg: 500, price: Math.round(500 * carrier.avgCostPerKm * 0.6) },
      { minKg: 501, maxKg: 1000, price: Math.round(1000 * carrier.avgCostPerKm * 0.55) },
      { minKg: 1001, maxKg: 2000, price: Math.round(2000 * carrier.avgCostPerKm * 0.5) },
    ],
    toll: intBetween(rng, 40, 120),
    gris: floatBetween(rng, 0.1, 0.35, 2),
    adValorem: floatBetween(rng, 0.1, 0.3, 2),
    pickupFee: intBetween(rng, 30, 90),
    deliveryFee: intBetween(rng, 30, 90),
  }));

  // --- Freights ---------------------------------------------------------
  const freights: Freight[] = shipments.map((s, i) => {
    const rate = pick(rng, rates.filter((r) => r.carrierId === s.carrierId)) ?? pick(rng, rates);
    const baseCost = Math.round(floatBetween(rng, 700, 2600, 0));
    const toll = rate?.toll ?? intBetween(rng, 40, 120);
    const gris = Math.round(baseCost * (rate?.gris ?? 0.15));
    const adValorem = Math.round(baseCost * (rate?.adValorem ?? 0.15));
    const additionalFees = (rate?.pickupFee ?? 40) + (rate?.deliveryFee ?? 40);
    return {
      id: `freight-${pad(i + 1, 3)}`,
      shipmentId: s.id,
      rateId: rate?.id ?? "rate-01",
      baseCost,
      toll,
      gris,
      adValorem,
      additionalFees,
      totalCost: baseCost + toll + gris + adValorem + additionalFees,
    };
  });

  // --- KPI history (14 dias, calculado + variação determinística) -----------
  const deliveredCount = deliveries.filter((d) => d.result === "Delivered" || d.result === "Partial Delivery").length;
  const onTimeCount = deliveries.filter((d) => d.result === "Delivered").length;
  const baseOtif = deliveries.length > 0 ? (onTimeCount / deliveries.length) * 100 : 90;
  const baseOtd = deliveries.length > 0 ? (deliveredCount / deliveries.length) * 100 : 92;
  const totalFreightCost = freights.reduce((s, f) => s + f.totalCost, 0);
  const baseCostPerDelivery = deliveredCount > 0 ? totalFreightCost / deliveredCount : 0;
  const totalCapacity = vehicles.reduce((s, v) => s + v.capacityKg, 0);
  const totalLoadWeight = loads.reduce((s, l) => s + l.totalWeightKg, 0);
  const baseOccupancy = totalCapacity > 0 ? Math.min(100, (totalLoadWeight / (totalCapacity * 0.3)) * 100) : 80;

  const kpiHistory: KpiSnapshot[] = Array.from({ length: 14 }, (_, i) => {
    const dayOffset = i - 13;
    const wobble = floatBetween(rng, -3, 3, 1);
    return {
      date: isoDaysFromNow(dayOffset, 0, 0).slice(0, 10),
      otifPercent: Math.max(0, Math.min(100, Math.round((baseOtif + wobble) * 10) / 10)),
      otdPercent: Math.max(0, Math.min(100, Math.round((baseOtd + wobble * 0.8) * 10) / 10)),
      occupancyPercent: Math.max(0, Math.min(100, Math.round((baseOccupancy + wobble) * 10) / 10)),
      costPerDelivery: Math.max(0, Math.round(baseCostPerDelivery + wobble * 5)),
      costPerKm: floatBetween(rng, 1.6, 3.4, 2),
    };
  });

  return {
    company,
    locations,
    customers,
    products,
    vehicles,
    drivers,
    carriers,
    orders,
    loads,
    tenders,
    shipments,
    occurrences,
    deliveries,
    rates,
    freights,
    documents,
    kpiHistory,
    orderEvents: [],
    counters: { order: 1, load: 1, shipment: 1, delivery: 1, occurrence: 1, document: 1, pod: 1, event: 1, partner: 1, solicitation: 1 },
    partnerCompanies: [],
    solicitations: [],
  };
}
