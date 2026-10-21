import { createRng } from "./rng";
import { generateReferenceData } from "./reference-data";
import { reduce, OPERATION_UTC_OFFSET, type SimulationAction, type NewOrderInput } from "./reducer";
import { quoteTransportOptions } from "../planning/quote";
import type { OperationDataset, OccurrenceType, OccurrenceAction } from "../domain/types";

const SEED = 8420; // fixo — mesmos cadastros sempre

/**
 * Cenário de demonstração "Atlas Distribuição".
 *
 * Em vez de fabricar estados diretamente, o cenário é um ROTEIRO DE COMANDOS
 * executado pelo mesmo núcleo de regras da operação real (reducer). Assim a
 * demonstração é coerente por construção: toda viagem "Em Exceção" tem uma
 * ocorrência aberta, toda entrega tem janela válida, nenhum veículo está em
 * duas viagens, e os IDs seguem o mesmo padrão da operação real.
 *
 * Os instantes são relativos ao momento em que o cenário é carregado, para
 * que as rotas em andamento estejam de fato em andamento.
 */
export function generateAtlasOperation(now: Date = new Date()): OperationDataset {
  const ref = generateReferenceData(createRng(SEED));
  let state: OperationDataset = {
    ...ref,
    orders: [],
    loads: [],
    tenders: [],
    shipments: [],
    occurrences: [],
    deliveries: [],
    rates: [],
    freights: [],
    documents: [],
    kpiHistory: [],
    orderEvents: [],
    counters: { order: 1, load: 1, shipment: 1, delivery: 1, occurrence: 1, document: 1, pod: 1, event: 1, partner: 1, solicitation: 1 },
    partnerCompanies: [],
    solicitations: [],
  };

  const minutes = (m: number) => new Date(now.getTime() + m * 60000);
  const run = (action: SimulationAction, atMinutes: number) => {
    state = reduce(state, action, minutes(atMinutes));
  };
  const lastId = <T extends { id: string }>(list: T[]) => list[list.length - 1].id;

  const loc = (name: string) => {
    const l = state.locations.find((x) => x.name === name);
    if (!l) throw new Error(`Local de demonstração ausente: ${name}`);
    return l;
  };
  const customerAt = (locationId: string) =>
    (state.customers.find((c) => c.locationId === locationId) ?? state.customers[0]).id;

  /** Data e janela "HH:MM" no fuso da operação, a partir de um deslocamento em minutos. */
  const opClock = (offsetMin: number) => {
    const local = new Date(minutes(offsetMin).getTime() + utcOffsetMinutes() * 60000);
    return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) };
  };
  const windowAround = (startMin: number, endMin: number) => {
    const s = opClock(startMin);
    const e = opClock(endMin);
    return { dueDate: s.date, deliveryWindowStart: s.time, deliveryWindowEnd: e.date === s.date ? e.time : "23:59" };
  };

  const order = (
    origin: string,
    destination: string,
    weights: [productIdx: number, qty: number, unitKg: number][],
    extra: Partial<NewOrderInput>,
    atMinutes: number
  ): string => {
    const dest = loc(destination);
    run(
      {
        type: "CREATE_ORDER",
        input: {
          customerId: customerAt(dest.id),
          originId: loc(origin).id,
          destinationId: dest.id,
          operationType: "B2B",
          priority: "Normal",
          pickupDate: opClock(atMinutes).date,
          dueDate: opClock(atMinutes + 24 * 60).date,
          items: weights.map(([p, quantity, unitWeightKg]) => ({
            productId: state.products[p].id,
            quantity,
            unitWeightKg,
          })),
          cargoCharacteristics: [],
          ...extra,
        },
      },
      atMinutes
    );
    return lastId(state.orders);
  };

  const dispatch = (
    orderIds: string[],
    atMinutes: number,
    opts: { carrierName?: string; vehicleId?: string; driverName?: string; routeCode?: string } = {}
  ): string => {
    run({ type: "CREATE_LOAD", orderIds }, atMinutes);
    const load = state.loads[state.loads.length - 1];
    const options = quoteTransportOptions(load.totalWeightKg, state.carriers);
    const option = opts.carrierName
      ? options.find((o) => o.label === opts.carrierName)!
      : options.find((o) => o.isOwnFleet)!;
    run(
      {
        type: "CREATE_SHIPMENT",
        loadId: load.id,
        option,
        vehicleId: opts.vehicleId,
        driverId: opts.driverName ? state.drivers.find((d) => d.name === opts.driverName)!.id : undefined,
        routeCode: opts.routeCode,
      },
      atMinutes + 5
    );
    return lastId(state.shipments);
  };

  const start = (shipmentId: string, at: number) => run({ type: "START_SHIPMENT", shipmentId }, at);
  const occur = (shipmentId: string, occurrenceType: OccurrenceType, at: number) => {
    run({ type: "CREATE_OCCURRENCE", shipmentId, occurrenceType }, at);
    return lastId(state.occurrences);
  };
  const resolve = (occurrenceId: string, action: OccurrenceAction, at: number) =>
    run({ type: "RESOLVE_OCCURRENCE", occurrenceId, action }, at);
  const complete = (shipmentId: string, at: number) => run({ type: "COMPLETE_DELIVERY", shipmentId }, at);

  const RIO = "CD Rio de Janeiro";
  const SP = "CD São Paulo";
  const BH = "CD Belo Horizonte";
  const DAY = 24 * 60;

  // --- Ontem: operação encerrada (base dos indicadores) -----------------------
  const e1 = order(SP, "Campinas", [[0, 40, 12]], { dueDate: opClock(-DAY).date }, -2 * DAY);
  const e2 = order(SP, "Sorocaba", [[3, 6, 55]], { dueDate: opClock(-2 * DAY).date, priority: "Alta" }, -2 * DAY);
  const shipE = dispatch([e1, e2], -DAY - 600, { routeCode: "SP-INTERIOR-011" });
  start(shipE, -DAY - 560);
  complete(shipE, -DAY - 200); // e2 chega um dia após o prazo → fora do OTD

  const f1 = order(RIO, "Duque de Caxias", [[4, 25, 9]], { dueDate: opClock(-DAY).date }, -2 * DAY);
  const shipF = dispatch([f1], -DAY - 540, { carrierName: "RioLog" });
  start(shipF, -DAY - 500);
  const occF = occur(shipF, "Destinatário ausente", -DAY - 420);
  resolve(occF, "Nova tentativa", -DAY - 400);
  complete(shipF, -DAY - 300);

  const g1 = order(BH, "Uberlândia", [[6, 12, 48]], { dueDate: opClock(-DAY).date, operationType: "B2C" }, -2 * DAY);
  const shipG = dispatch([g1], -DAY - 700);
  start(shipG, -DAY - 660);
  const occG = occur(shipG, "Recusa", -DAY - 200);
  resolve(occG, "Devolver", -DAY - 180);

  // --- Hoje: rotas de distribuição em andamento ------------------------------
  const rj = [
    order(RIO, "Taquara", [[0, 30, 11]], windowAround(-10, 150), -180),
    order(RIO, "Freguesia (Jacarepaguá)", [[2, 60, 3.5], [7, 20, 6]], windowAround(20, 180), -175),
    order(RIO, "Barra da Tijuca", [[3, 4, 62]], { ...windowAround(40, 100), priority: "Urgente" }, -170),
    order(RIO, "Recreio dos Bandeirantes", [[0, 25, 12], [4, 10, 8]], windowAround(60, 240), -165),
    order(RIO, "Campo Grande", [[5, 18, 14]], windowAround(90, 300), -160),
  ];
  const shipRJ = dispatch(rj, -90, { vehicleId: "ORBT-014", driverName: "Carlos Mendes", routeCode: "RJ-ZONA-OESTE-042" });
  start(shipRJ, -62);

  const sp = [
    order(SP, "Pinheiros", [[2, 80, 3.2]], windowAround(-40, 60), -200),
    order(SP, "Moema", [[7, 30, 5.5]], windowAround(0, 120), -195),
    order(SP, "Tatuapé", [[0, 45, 12]], windowAround(30, 200), -190),
    order(SP, "Santana", [[1, 2, 420]], { ...windowAround(60, 240), priority: "Alta" }, -185),
  ];
  const shipSP = dispatch(sp, -130, { routeCode: "SP-ZONA-OESTE-017" });
  start(shipSP, -105);
  occur(shipSP, "Atraso", -18); // aberta: exceção real na Central

  const bh = [
    order(BH, "Savassi", [[2, 50, 3]], windowAround(10, 140), -150),
    order(BH, "Pampulha", [[6, 6, 45]], windowAround(40, 220), -148),
    order(BH, "Barreiro", [[0, 20, 12]], windowAround(80, 300), -146),
  ];
  const shipBH = dispatch(bh, -70, { routeCode: "BH-CENTRO-SUL-008" });
  start(shipBH, -41);

  // Intermunicipal contratada com transportadora, aguardando saída.
  const d1 = order(RIO, "Niterói", [[1, 3, 380]], { dueDate: opClock(DAY).date }, -120);
  const d2 = order(RIO, "Petrópolis", [[3, 5, 58]], { dueDate: opClock(DAY).date }, -118);
  dispatch([d1, d2], -30, { carrierName: "FastCargo" });

  // Carga formada aguardando contratação.
  const c1 = order(SP, "Santos", [[0, 60, 12]], { dueDate: opClock(DAY).date }, -100);
  const c2 = order(SP, "Guarulhos", [[5, 30, 14]], { dueDate: opClock(DAY).date }, -98);
  run({ type: "CREATE_LOAD", orderIds: [c1, c2] }, -20);

  // Fila de planejamento.
  order(RIO, "Vitória", [[1, 4, 400]], { dueDate: opClock(2 * DAY).date }, -80);
  order(BH, "Juiz de Fora", [[3, 8, 55]], { dueDate: opClock(DAY).date, priority: "Alta" }, -75);
  order(BH, "Contagem", [[4, 40, 9]], { dueDate: opClock(DAY).date }, -60);
  order(SP, "Campinas", [[7, 25, 6]], { dueDate: opClock(2 * DAY).date }, -45);
  order(RIO, "Vila Velha", [[6, 10, 48]], { dueDate: opClock(2 * DAY).date, operationType: "B2C" }, -30);
  order(RIO, "Barra da Tijuca", [[2, 30, 3.5]], { ...windowAround(24 * 60 + 60, 24 * 60 + 240), priority: "Urgente" }, -15);

  // --- Portal do Parceiro ------------------------------------------------------
  run(
    {
      type: "CREATE_PARTNER_COMPANY",
      input: { legalName: "Farmavida Distribuidora Ltda", tradeName: "Farmavida", city: "Rio de Janeiro", state: "RJ" },
    },
    -3 * DAY
  );
  const partnerId = lastId(state.partnerCompanies);
  const solicitation = (destination: string, description: string, at: number) =>
    run(
      {
        type: "CREATE_SOLICITATION",
        input: {
          partnerCompanyId: partnerId,
          operationType: "B2B",
          originId: loc(RIO).id,
          destinationId: loc(destination).id,
          pickupDate: opClock(at).date,
          deliveryDate: opClock(at + DAY).date,
          productDescription: description,
          quantity: 40,
          totalWeightKg: 160,
          cargoCharacteristics: ["Temperatura ambiente"],
        },
      },
      at
    );
  solicitation("Niterói", "Caixas de medicamentos", -300);
  run(
    { type: "CONVERT_SOLICITATION_TO_ORDER", solicitationId: lastId(state.solicitations), customerId: customerAt(loc("Niterói").id), priority: "Alta" },
    -290
  );
  solicitation("Taquara", "Caixas de dermocosméticos", -25);

  return state;
}

function utcOffsetMinutes(): number {
  const [, sign, h, m] = OPERATION_UTC_OFFSET.match(/([+-])(\d\d):(\d\d)/)!;
  return (sign === "-" ? -1 : 1) * (Number(h) * 60 + Number(m));
}
