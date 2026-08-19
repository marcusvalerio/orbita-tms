import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePersistedState, SCHEMA_VERSION } from "./persistence.ts";

function minimalArrays() {
  return {
    locations: [],
    customers: [],
    products: [],
    vehicles: [],
    drivers: [],
    carriers: [],
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
  };
}

function validCounters() {
  return { order: 3, load: 1, shipment: 1, delivery: 1, occurrence: 1, document: 1, pod: 1, event: 5 };
}

function validCurrentDataset() {
  return {
    company: { id: "atlas", name: "Atlas Distribuição", region: "Sudeste", operationType: "Rodoviária" },
    ...minimalArrays(),
    orderEvents: [],
    counters: validCounters(),
  };
}

test("estado atual válido (v2) é aceito sem alterações", () => {
  const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, data: validCurrentDataset() });
  const result = parsePersistedState(raw);
  assert.ok(result);
  assert.deepEqual(result?.counters, validCounters());
});

test("estado antigo sem `counters` é migrado com contadores neutros", () => {
  const legacy = {
    company: { id: "atlas", name: "Atlas Distribuição", region: "Sudeste", operationType: "Rodoviária" },
    ...minimalArrays(),
    orderEvents: [{ id: "evt-1", orderId: "PED-1", message: "x", timestamp: "2026-01-01" }],
    // sem `counters`
  };
  const raw = JSON.stringify({ schemaVersion: 1, data: legacy });
  const result = parsePersistedState(raw);
  assert.ok(result);
  assert.deepEqual(result?.counters, { order: 1, load: 1, shipment: 1, delivery: 1, occurrence: 1, document: 1, pod: 1, event: 1 });
  assert.equal(result?.orderEvents.length, 1);
});

test("estado antigo sem `orderEvents` é migrado para array vazio", () => {
  const legacy = {
    company: { id: "atlas", name: "Atlas Distribuição", region: "Sudeste", operationType: "Rodoviária" },
    ...minimalArrays(),
    counters: validCounters(),
    // sem `orderEvents`
  };
  const raw = JSON.stringify({ schemaVersion: 1, data: legacy });
  const result = parsePersistedState(raw);
  assert.ok(result);
  assert.deepEqual(result?.orderEvents, []);
});

test("estado de versão anterior salvo sem envelope (legado pré-versionamento) é reconhecido como v1 e migrado", () => {
  const legacyNoEnvelope = {
    company: { id: "atlas", name: "Atlas Distribuição", region: "Sudeste", operationType: "Rodoviária" },
    ...minimalArrays(),
    // sem envelope, sem counters, sem orderEvents
  };
  const raw = JSON.stringify(legacyNoEnvelope);
  const result = parsePersistedState(raw);
  assert.ok(result);
  assert.ok(result?.counters);
  assert.deepEqual(result?.orderEvents, []);
});

test("JSON inválido retorna null sem lançar exceção", () => {
  const result = parsePersistedState("{ isso não é json ");
  assert.equal(result, null);
});

test("estrutura parcialmente corrompida (campo com tipo errado) é descartada", () => {
  const corrupted = {
    ...validCurrentDataset(),
    orders: "isso deveria ser um array",
  };
  const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, data: corrupted });
  const result = parsePersistedState(raw);
  assert.equal(result, null);
});

test("localStorage vazio (null) retorna null", () => {
  assert.equal(parsePersistedState(null), null);
});

test("migração explícita de versão (schemaVersion 1 → 2) preserva dados existentes", () => {
  const legacy = {
    company: { id: "atlas", name: "Atlas Distribuição", region: "Sudeste", operationType: "Rodoviária" },
    ...minimalArrays(),
    orders: [{ id: "PED-00001", status: "Aguardando planejamento" }],
  };
  const raw = JSON.stringify({ schemaVersion: 1, data: legacy });
  const result = parsePersistedState(raw);
  assert.ok(result);
  assert.equal(result?.orders.length, 1);
  assert.equal((result?.orders[0] as { id: string }).id, "PED-00001");
  assert.ok(result?.counters);
});

test("estado totalmente incompatível (objeto não relacionado) é descartado", () => {
  const raw = JSON.stringify({ foo: "bar", somethingElse: 42 });
  const result = parsePersistedState(raw);
  assert.equal(result, null);
});
