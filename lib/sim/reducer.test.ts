import { test } from "node:test";
import assert from "node:assert/strict";
import { reduce, applyCommand, type NewOrderInput } from "./reducer";
import { generateEmptyOperation } from "./generate-empty";
import { quoteTransportOptions } from "../planning/quote";
import type { OperationDataset } from "../domain/types";

const T0 = new Date("2026-09-30T12:00:00.000Z");
const at = (min: number) => new Date(T0.getTime() + min * 60000);

function orderInput(state: OperationDataset, destinationName: string, weightKg = 200, extra: Partial<NewOrderInput> = {}): NewOrderInput {
  const dest = state.locations.find((l) => l.name === destinationName)!;
  return {
    customerId: state.customers[0].id,
    originId: "loc-cd-1",
    destinationId: dest.id,
    operationType: "B2B",
    priority: "Normal",
    pickupDate: "2026-09-30",
    dueDate: "2026-09-30",
    items: [{ description: "Caixas", quantity: 10, unitWeightKg: weightKg / 10 }],
    cargoCharacteristics: [],
    ...extra,
  };
}

function withOrders(names: string[], weightKg = 200) {
  let s = generateEmptyOperation();
  names.forEach((n) => (s = reduce(s, { type: "CREATE_ORDER", input: orderInput(s, n, weightKg) }, T0)));
  return s;
}

const ownFleet = (s: OperationDataset, kg: number) => quoteTransportOptions(kg, s.carriers).find((o) => o.isOwnFleet)!;
const thirdParty = (s: OperationDataset, kg: number) => quoteTransportOptions(kg, s.carriers).find((o) => !o.isOwnFleet)!;

function dispatched(names: string[], weightKg = 200) {
  let s = withOrders(names, weightKg);
  s = reduce(s, { type: "CREATE_LOAD", orderIds: s.orders.map((o) => o.id) }, T0);
  const load = s.loads[0];
  s = reduce(s, { type: "CREATE_SHIPMENT", loadId: load.id, option: ownFleet(s, load.totalWeightKg) }, T0);
  return s;
}

// --- Fluxo principal preservado --------------------------------------------------

test("fluxo completo pedido → carga → viagem → entrega mantém os estados esperados", () => {
  let s = dispatched(["Barra da Tijuca"]);
  const ship = s.shipments[0];
  assert.equal(s.orders[0].status, "Planejado");
  assert.equal(s.loads[0].status, "Contratada");
  assert.equal(ship.status, "Planned");
  assert.match(ship.id, /^VIA-\d{5}$/);

  s = reduce(s, { type: "START_SHIPMENT", shipmentId: ship.id }, at(10));
  assert.equal(s.shipments[0].status, "In Transit");
  assert.equal(s.orders[0].status, "Em transporte");

  s = reduce(s, { type: "COMPLETE_DELIVERY", shipmentId: ship.id }, at(60));
  assert.equal(s.shipments[0].status, "Delivered");
  assert.equal(s.orders[0].status, "Entregue");
  assert.equal(s.deliveries.length, 1);
  assert.equal(s.documents[0].type, "POD");
  assert.equal(s.vehicles.find((v) => v.id === ship.vehicleId)!.status, "Disponível");
});

test("o instante do comando vem do relógio injetado (determinismo)", () => {
  const s = reduce(generateEmptyOperation(), { type: "CREATE_ORDER", input: orderInput(generateEmptyOperation(), "Niterói") }, T0);
  assert.equal(s.orders[0].requestDate, T0.toISOString());
  assert.equal(s.orderEvents[0].timestamp, T0.toISOString());
});

// --- L1: feedback nunca afirma sucesso de um comando rejeitado --------------------

test("L1: comando inválido retorna erro de regra e não altera o estado", () => {
  const s = generateEmptyOperation();
  const r = applyCommand(s, { type: "CREATE_ORDER", input: { ...orderInput(s, "Niterói"), items: [] } }, T0);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.kind, "rule");
    assert.match(r.error, /pelo menos um item/);
  }
});

test("L1: comando válido retorna ok com novo estado", () => {
  const s = generateEmptyOperation();
  const r = applyCommand(s, { type: "CREATE_ORDER", input: orderInput(s, "Niterói") }, T0);
  assert.equal(r.ok, true);
});

// --- L2/L3: alocação coerente com o plano e com a modalidade ----------------------

test("L2: frota própria aloca o MENOR veículo disponível que comporta a carga (mesma regra do planejamento)", () => {
  const s = dispatched(["Barra da Tijuca"], 900);
  const vehicle = s.vehicles.find((v) => v.id === s.shipments[0].vehicleId)!;
  assert.equal(vehicle.type, "Van");
  assert.equal(vehicle.status, "Em Viagem");
});

test("L2: veículo em manutenção nunca é alocado, nem como fallback", () => {
  let s = withOrders(["Barra da Tijuca"], 3000);
  s = { ...s, vehicles: s.vehicles.map((v) => (v.capacityKg >= 3000 ? { ...v, status: "Manutenção" as const } : v)) };
  s = reduce(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0);
  const r = applyCommand(s, { type: "CREATE_SHIPMENT", loadId: s.loads[0].id, option: ownFleet(s, 3000) }, T0);
  assert.equal(r.ok, false);
});

test("L2: veículo escolhido pelo gestor é validado (disponível e com capacidade)", () => {
  let s = withOrders(["Barra da Tijuca"], 2000);
  s = reduce(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0);
  const van = s.vehicles.find((v) => v.type === "Van")!;
  const r = applyCommand(s, { type: "CREATE_SHIPMENT", loadId: s.loads[0].id, option: ownFleet(s, 2000), vehicleId: van.id }, T0);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /não comporta/);
});

test("L3: frota própria não é atribuída a uma transportadora", () => {
  const s = dispatched(["Barra da Tijuca"]);
  assert.equal(s.shipments[0].carrierId, undefined);
});

test("L3: transportadora contratada não consome veículo nem motorista da frota", () => {
  let s = withOrders(["Niterói"]);
  s = reduce(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0);
  const option = thirdParty(s, 200);
  s = reduce(s, { type: "CREATE_SHIPMENT", loadId: s.loads[0].id, option }, T0);
  const ship = s.shipments[0];
  assert.equal(ship.carrierId, option.id);
  assert.equal(ship.vehicleId, undefined);
  assert.ok(s.vehicles.every((v) => v.status !== "Em Viagem"));
  assert.equal(s.freights[0].totalCost, option.price);
});

test("L3: a mesma carga não pode ser contratada duas vezes", () => {
  const s = dispatched(["Barra da Tijuca"]);
  const r = applyCommand(s, { type: "CREATE_SHIPMENT", loadId: s.loads[0].id, option: ownFleet(s, 200) }, T0);
  assert.equal(r.ok, false);
});

// --- L4: ocorrências ------------------------------------------------------------

test("L4: resolver uma de duas ocorrências mantém a viagem em exceção", () => {
  let s = dispatched(["Barra da Tijuca"]);
  const id = s.shipments[0].id;
  s = reduce(s, { type: "START_SHIPMENT", shipmentId: id }, at(1));
  s = reduce(s, { type: "CREATE_OCCURRENCE", shipmentId: id, occurrenceType: "Atraso" }, at(2));
  s = reduce(s, { type: "CREATE_OCCURRENCE", shipmentId: id, occurrenceType: "Avaria" }, at(3));
  s = reduce(s, { type: "RESOLVE_OCCURRENCE", occurrenceId: s.occurrences[0].id, action: "Nova tentativa" }, at(4));
  assert.equal(s.shipments[0].status, "Exception");
  assert.equal(s.orders[0].status, "Com ocorrência");
  s = reduce(s, { type: "RESOLVE_OCCURRENCE", occurrenceId: s.occurrences[1].id, action: "Contatar cliente" }, at(5));
  assert.equal(s.shipments[0].status, "In Transit");
  assert.equal(s.orders[0].status, "Em transporte");
});

test("L4: ocorrência antes da saída volta a viagem para Planejada ao ser resolvida", () => {
  let s = dispatched(["Barra da Tijuca"]);
  const id = s.shipments[0].id;
  s = reduce(s, { type: "CREATE_OCCURRENCE", shipmentId: id, occurrenceType: "Problema mecânico" }, at(1));
  s = reduce(s, { type: "RESOLVE_OCCURRENCE", occurrenceId: s.occurrences[0].id, action: "Reagendar" }, at(2));
  assert.equal(s.shipments[0].status, "Planned");
  assert.equal(s.orders[0].status, "Planejado");
});

test("L4: Devolver encerra a viagem, registra devolução e libera recursos", () => {
  let s = dispatched(["Barra da Tijuca"]);
  const ship = s.shipments[0];
  s = reduce(s, { type: "START_SHIPMENT", shipmentId: ship.id }, at(1));
  s = reduce(s, { type: "CREATE_OCCURRENCE", shipmentId: ship.id, occurrenceType: "Recusa" }, at(2));
  s = reduce(s, { type: "RESOLVE_OCCURRENCE", occurrenceId: s.occurrences[0].id, action: "Devolver" }, at(3));
  assert.equal(s.shipments[0].status, "Closed");
  assert.equal(s.orders[0].status, "Devolvido");
  assert.equal(s.deliveries[0].result, "Returned");
  assert.equal(s.vehicles.find((v) => v.id === ship.vehicleId)!.status, "Disponível");
});

test("L4: ocorrência já resolvida não pode ser resolvida de novo", () => {
  let s = dispatched(["Barra da Tijuca"]);
  const id = s.shipments[0].id;
  s = reduce(s, { type: "CREATE_OCCURRENCE", shipmentId: id, occurrenceType: "Atraso" }, at(1));
  s = reduce(s, { type: "RESOLVE_OCCURRENCE", occurrenceId: s.occurrences[0].id, action: "Reagendar" }, at(2));
  assert.equal(applyCommand(s, { type: "RESOLVE_OCCURRENCE", occurrenceId: s.occurrences[0].id, action: "Reagendar" }, at(3)).ok, false);
});

test("severidade da ocorrência decorre do tipo", () => {
  let s = dispatched(["Barra da Tijuca"]);
  s = reduce(s, { type: "CREATE_OCCURRENCE", shipmentId: s.shipments[0].id, occurrenceType: "Roubo" }, at(1));
  assert.equal(s.occurrences[0].severity, "Crítica");
});

// --- L5: máquina de estados da entrega --------------------------------------------

test("L5: não conclui entrega de viagem não iniciada", () => {
  const s = dispatched(["Barra da Tijuca"]);
  const r = applyCommand(s, { type: "COMPLETE_DELIVERY", shipmentId: s.shipments[0].id }, at(1));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Inicie a viagem/);
});

test("L5: não conclui entrega com ocorrência aberta", () => {
  let s = dispatched(["Barra da Tijuca"]);
  const id = s.shipments[0].id;
  s = reduce(s, { type: "START_SHIPMENT", shipmentId: id }, at(1));
  s = reduce(s, { type: "CREATE_OCCURRENCE", shipmentId: id, occurrenceType: "Atraso" }, at(2));
  assert.equal(applyCommand(s, { type: "COMPLETE_DELIVERY", shipmentId: id }, at(3)).ok, false);
});

test("L5: janela planejada da entrega vem do pedido, não do ETA", () => {
  let s = generateEmptyOperation();
  s = reduce(s, { type: "CREATE_ORDER", input: orderInput(s, "Barra da Tijuca", 200, { deliveryWindowStart: "09:00", deliveryWindowEnd: "11:00" }) }, T0);
  s = reduce(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0);
  s = reduce(s, { type: "CREATE_SHIPMENT", loadId: s.loads[0].id, option: ownFleet(s, 200) }, T0);
  s = reduce(s, { type: "START_SHIPMENT", shipmentId: s.shipments[0].id }, T0);
  s = reduce(s, { type: "COMPLETE_DELIVERY", shipmentId: s.shipments[0].id }, at(30));
  assert.equal(s.deliveries[0].plannedWindowStart, "2026-09-30T12:00:00.000Z"); // 09:00 BRT
  assert.equal(s.deliveries[0].plannedWindowEnd, "2026-09-30T14:00:00.000Z"); // 11:00 BRT
});

// --- L6: consolidação validada no domínio --------------------------------------------

test("L6: carga não mistura origens", () => {
  let s = withOrders(["Barra da Tijuca"]);
  s = reduce(s, { type: "CREATE_ORDER", input: { ...orderInput(s, "Moema"), originId: "loc-cd-2" } }, T0);
  assert.equal(applyCommand(s, { type: "CREATE_LOAD", orderIds: s.orders.map((o) => o.id) }, T0).ok, false);
});

test("L6: pedido já planejado não entra em outra carga", () => {
  let s = withOrders(["Barra da Tijuca"]);
  s = reduce(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0);
  assert.equal(applyCommand(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0).ok, false);
});

test("L6: carga acima do maior veículo da frota é rejeitada", () => {
  const s = withOrders(["Barra da Tijuca"], 30000);
  assert.equal(applyCommand(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0).ok, false);
});

// --- Rotas multi-parada -------------------------------------------------------------

test("destinos distintos viram paradas sequenciadas pelo vizinho mais próximo", () => {
  const s = dispatched(["Campo Grande", "Barra da Tijuca", "Recreio dos Bandeirantes", "Freguesia (Jacarepaguá)"]);
  const ship = s.shipments[0];
  assert.equal(ship.stops.length, 5);
  assert.equal(ship.stops[0].kind, "Coleta");
  const names = ship.stops.slice(1).map((st) => s.locations.find((l) => l.id === st.locationId)!.name);
  assert.deepEqual(names, ["Freguesia (Jacarepaguá)", "Barra da Tijuca", "Recreio dos Bandeirantes", "Campo Grande"]);
  // chegadas previstas são crescentes e o ETA é a última parada
  const times = ship.stops.map((st) => new Date(st.plannedTime).getTime());
  assert.ok(times.every((t, i) => i === 0 || t > times[i - 1]));
  assert.equal(ship.etaTime, ship.stops.at(-1)!.plannedTime);
  assert.ok(ship.plannedDistanceKm! > 0);
  assert.equal(s.loads[0].destinationId, ship.stops.at(-1)!.locationId);
});

test("iniciar a viagem reancora todas as chegadas previstas no horário real de saída", () => {
  let s = dispatched(["Barra da Tijuca", "Campo Grande"]);
  const before = s.shipments[0].stops.map((st) => new Date(st.plannedTime).getTime());
  s = reduce(s, { type: "START_SHIPMENT", shipmentId: s.shipments[0].id }, at(45));
  const after = s.shipments[0].stops.map((st) => new Date(st.plannedTime).getTime());
  after.forEach((t, i) => assert.equal(t - before[i], 45 * 60000));
});

test("código de rota é informado pelo gestor ou gerado a partir da origem", () => {
  let s = withOrders(["Barra da Tijuca"]);
  s = reduce(s, { type: "CREATE_LOAD", orderIds: [s.orders[0].id] }, T0);
  s = reduce(s, { type: "CREATE_SHIPMENT", loadId: s.loads[0].id, option: ownFleet(s, 200) }, T0);
  assert.equal(s.shipments[0].routeCode, "RJ-RIO-DE-JANEIRO-001");
});

test("item sem produto nem descrição é rejeitado no domínio (não só no banco)", () => {
  const s = generateEmptyOperation();
  const r = applyCommand(s, { type: "CREATE_ORDER", input: { ...orderInput(s, "Niterói"), items: [{ quantity: 1, unitWeightKg: 1 }] } }, T0);
  assert.equal(r.ok, false);
});
