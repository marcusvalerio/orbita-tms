import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAtlasOperation } from "./generate-atlas";
import { getOverviewMetrics, getExceptionQueue } from "../data/atlas";

const NOW = new Date("2026-09-30T15:00:00.000Z");
const demo = generateAtlasOperation(NOW);

test("cenário demo é determinístico para o mesmo instante", () => {
  assert.deepEqual(generateAtlasOperation(NOW).shipments, demo.shipments);
});

test("L9: toda viagem em exceção tem ocorrência aberta — e vice-versa", () => {
  for (const s of demo.shipments) {
    const open = demo.occurrences.some((o) => o.shipmentId === s.id && !o.resolved);
    assert.equal(s.status === "Exception", open, `${s.id} status=${s.status} open=${open}`);
  }
  assert.ok(getExceptionQueue(demo).length > 0, "o cenário mostra ao menos uma exceção real");
});

test("L10: janelas de entrega são válidas (início ≤ fim)", () => {
  for (const d of demo.deliveries) {
    assert.ok(new Date(d.plannedWindowStart) <= new Date(d.plannedWindowEnd), d.id);
  }
  for (const s of demo.shipments) {
    for (const st of s.stops) {
      if (st.windowStart && st.windowEnd) assert.ok(st.windowStart <= st.windowEnd, `${s.id}/${st.id}`);
    }
  }
});

test("L11: IDs seguem o mesmo padrão da operação real", () => {
  demo.orders.forEach((o) => assert.match(o.id, /^PED-\d{5}$/));
  demo.loads.forEach((l) => assert.match(l.id, /^CAR-\d{5}$/));
  demo.shipments.forEach((s) => assert.match(s.id, /^VIA-\d{5}$/));
  demo.occurrences.forEach((o) => assert.match(o.id, /^OCC-\d{5}$/));
  demo.deliveries.forEach((d) => assert.match(d.id, /^ENT-\d{5}$/));
});

test("nenhum veículo ou motorista está em duas viagens ativas", () => {
  const active = demo.shipments.filter((s) => s.status !== "Delivered" && s.status !== "Closed");
  const vehicles = active.flatMap((s) => (s.vehicleId ? [s.vehicleId] : []));
  const drivers = active.flatMap((s) => (s.driverId ? [s.driverId] : []));
  assert.equal(new Set(vehicles).size, vehicles.length);
  assert.equal(new Set(drivers).size, drivers.length);
  for (const id of vehicles) assert.equal(demo.vehicles.find((v) => v.id === id)!.status, "Em Viagem");
});

test("rota de referência RJ-ZONA-OESTE-042 existe com ORBT-014, Carlos Mendes e múltiplas paradas", () => {
  const route = demo.shipments.find((s) => s.routeCode === "RJ-ZONA-OESTE-042")!;
  assert.ok(route);
  assert.equal(route.vehicleId, "ORBT-014");
  assert.equal(demo.drivers.find((d) => d.id === route.driverId)!.name, "Carlos Mendes");
  assert.equal(route.status, "In Transit");
  assert.ok(route.stops.length >= 5);
});

test("indicadores do cenário são calculáveis e dentro de 0–100%", () => {
  const m = getOverviewMetrics(demo);
  for (const v of [m.otifPercent, m.otdPercent, m.occupancyPercent]) {
    assert.ok(v !== null && v >= 0 && v <= 100);
  }
  assert.ok(m.otdPercent! < 100, "o cenário inclui entrega fora do prazo");
  assert.ok(m.costPerDelivery! > 0);
});
