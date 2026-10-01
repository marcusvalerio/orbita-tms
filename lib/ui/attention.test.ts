import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAtlasOperation } from "../sim/generate-atlas";
import type { OperationDataset, Shipment } from "../domain/types";
import type { VehiclePosition } from "../geo/types";
import { readTrip, RISK_MARGIN_MIN } from "./trip";
import { attentionFor, attentionQueue, levelFor } from "./attention";

const NOW = new Date("2026-09-30T23:30:00.000Z");
const data = (): OperationDataset => generateAtlasOperation(NOW);
const iso = (min: number) => new Date(NOW.getTime() + min * 60000).toISOString();

/** Viagem multiparada sintética, em rota, sem ocorrência. */
function tripFixture(d: OperationDataset, windowEndOffsetMin: number[], etaOffsetMin: number[]): { shipment: Shipment; pos: VehiclePosition } {
  const base = d.shipments.find((s) => s.stops.length >= 3 && s.status === "In Transit")!;
  const stops = base.stops.map((st, i) => ({ ...st, windowStart: iso(-120), windowEnd: iso(windowEndOffsetMin[i] ?? 600), plannedTime: iso(etaOffsetMin[i] ?? 0) }));
  const shipment: Shipment = { ...base, id: "VIA-TESTE", routeCode: "RJ-TESTE-001", status: "In Transit", occurrenceIds: [], stops };
  const pos: VehiclePosition = {
    shipmentId: shipment.id,
    position: { lat: -22.9, lng: -43.3 },
    headingDeg: 90,
    speedKmh: 32,
    progress: 0.3,
    stopProgress: stops.map((_, i) => (i === 0 ? "Entregue" : i === 1 ? "Em rota" : "Pendente")),
    etaByStop: stops.map((_, i) => (i === 0 ? null : iso(etaOffsetMin[i] ?? 0))),
    recordedAt: NOW.toISOString(),
    source: "demo",
  };
  return { shipment, pos };
}

test("ETA além da janela: parada atrasada, motivo explícito e ações", () => {
  const d = data();
  const { shipment, pos } = tripFixture(d, [600, 30, 600], [0, 48, 90]);
  d.shipments.push(shipment);
  const trip = readTrip(d, shipment, pos);
  assert.equal(trip.stops[1].state, "late");
  assert.equal(trip.stops[1].delayMin, 18);
  assert.equal(trip.health, "late");
  const item = attentionFor(d, trip, NOW.getTime())!;
  assert.match(item.headline, /excede a janela .* em 18 min/);
  assert.equal(item.reasons[0].code, "late");
  assert.equal(item.score, 58);
  assert.equal(item.level, "alta");
  assert.deepEqual(item.actions, ["registrar-atraso", "ver-rota"]);
  assert.equal(item.stopIndex, 1);
});

test(`folga ≤ ${RISK_MARGIN_MIN} min: em risco, não atrasada`, () => {
  const d = data();
  const { shipment, pos } = tripFixture(d, [600, 50, 600], [0, 40, 90]);
  const trip = readTrip(d, shipment, pos);
  assert.equal(trip.stops[1].state, "risk");
  assert.equal(trip.health, "risk");
  const item = attentionFor(d, trip, NOW.getTime())!;
  assert.equal(item.reasons[0].code, "risk");
  assert.match(item.headline, /Folga de 10 min/);
  assert.equal(item.level, "baixa");
});

test("sem motivo, sem item: viagem no prazo não entra na fila", () => {
  const d = data();
  const { shipment, pos } = tripFixture(d, [600, 600, 600], [0, 40, 90]);
  const trip = readTrip(d, shipment, pos);
  assert.equal(trip.health, "ok");
  assert.equal(attentionFor(d, trip, NOW.getTime()), null);
});

test("ocorrência aberta: motivo, ação Resolver e nível pela severidade", () => {
  const d = data();
  const withOcc = d.shipments.find((s) => d.occurrences.some((o) => !o.resolved && s.occurrenceIds.includes(o.id)))!;
  assert.ok(withOcc, "cenário demo tem ocorrência aberta");
  const trip = readTrip(d, withOcc, null);
  assert.equal(trip.health, "exception");
  const item = attentionFor(d, trip, NOW.getTime())!;
  assert.ok(item.reasons.some((r) => r.code === "occurrence"));
  assert.equal(item.actions[0], "resolver");
  assert.ok(item.occurrence);
});

test("viagem planejada com saída vencida pede para iniciar", () => {
  const d = data();
  const planned = { ...d.shipments.find((s) => s.status === "Planned")!, departureTime: iso(-30) };
  const item = attentionFor(d, readTrip(d, planned, null), NOW.getTime())!;
  assert.equal(item.reasons[0].code, "not-started");
  assert.match(item.headline, /não foi iniciada \(30 min\)/);
  assert.equal(item.actions[0], "iniciar");
});

test("determinístico e ordenado: mesma entrada, mesma fila", () => {
  const a = attentionQueue(data(), new Map(), NOW.getTime());
  const b = attentionQueue(data(), new Map(), NOW.getTime());
  assert.deepEqual(
    a.items.map((i) => [i.shipmentId, i.score, i.headline]),
    b.items.map((i) => [i.shipmentId, i.score, i.headline])
  );
  for (let i = 1; i < a.items.length; i++) assert.ok(a.items[i - 1].score >= a.items[i].score);
  for (const item of a.items) assert.ok(item.reasons.length > 0 && item.headline.length > 0);
});

test("níveis", () => {
  assert.equal(levelFor(85, false), "critica");
  assert.equal(levelFor(10, true), "critica");
  assert.equal(levelFor(60, false), "alta");
  assert.equal(levelFor(30, false), "media");
  assert.equal(levelFor(29, false), "baixa");
});

test("horizonte agrupa paradas por hora de ETA (atrasada / em risco / no prazo)", async () => {
  const { horizon } = await import("./horizon");
  const d = data();
  const { shipment, pos } = tripFixture(d, [600, 30, 600], [0, 48, 90]);
  const trip = readTrip(d, shipment, pos);
  const h = horizon([trip], NOW.getTime(), 6);
  assert.equal(h.buckets.length, 6);
  assert.equal(h.late, 1);
  assert.ok(h.ok >= 1);
  const pending = trip.stops.filter((s) => s.index > 0 && s.state !== "done").length;
  assert.equal(h.buckets.reduce((n, b) => n + b.late + b.risk + b.ok, 0), pending);
});
