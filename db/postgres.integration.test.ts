import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { migrate, listMigrations } from "./migrate";
import { getPool } from "../lib/infrastructure/postgres/pool";
import { PostgresAuditLog, PostgresOperationStore } from "../lib/infrastructure/postgres/operation-store";
import { PostgresMembershipStore } from "../lib/infrastructure/postgres/membership-store";
import { executeCommand } from "../lib/application/execute-command";
import { generateAtlasOperation } from "../lib/sim/generate-atlas";
import { generateEmptyOperation } from "../lib/sim/generate-empty";
import { reduce } from "../lib/sim/reducer";
import * as domain from "../lib/domain/types";
import type { Actor } from "../lib/authz/rbac";

// Testes de integração contra PostgreSQL real (local ou branch Neon efêmero).
//   TEST_DATABASE_URL=postgres://postgres@localhost:55432/orbita_test npm run test:integration
// O banco é recriado do zero: a URL precisa apontar para um banco com "test" no nome.

const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL não definido" : !/test/.test(new URL(url).pathname) ? "banco sem 'test' no nome" : false;
const NOW = new Date("2026-09-30T15:00:00.000Z");

let pool: pg.Pool;
let store: PostgresOperationStore;

before(async () => {
  if (skip) return;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query("drop schema public cascade; create schema public;");
  await admin.query("drop role if exists orbita_app_test");
  await admin.end();
  await migrate(url!, () => {});
  pool = getPool(url!);
  store = new PostgresOperationStore(pool);
});

after(async () => {
  if (pool) await pool.end();
});

/** Remove chaves undefined recursivamente (o banco não distingue ausente de nulo). */
const normalize = <T>(v: T): T => JSON.parse(JSON.stringify(v));

test("migrations aplicam do zero e são idempotentes", { skip }, async () => {
  await migrate(url!, () => {});
  const res = await pool.query("select count(*)::int as n from schema_migrations");
  assert.equal(res.rows[0].n, listMigrations().length);
});

test("listas de status no SQL são idênticas às constantes do domínio", { skip }, () => {
  const sql = readFileSync(join(import.meta.dirname, "migrations", "0003_operation.sql"), "utf8");
  const checkOf = (col: string, table: string) => {
    const block = sql.slice(sql.indexOf(`create table ${table} (`));
    const m = block.match(new RegExp(`\\b${col} text[^\\n]*?check \\(${col} in \\(([^)]*)\\)\\)`));
    assert.ok(m, `${table}.${col}`);
    return m![1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
  };
  assert.deepEqual(checkOf("status", "orders"), [...domain.ORDER_STATUSES]);
  assert.deepEqual(checkOf("status", "loads"), [...domain.LOAD_STATUSES]);
  assert.deepEqual(checkOf("status", "shipments"), [...domain.SHIPMENT_STATUSES]);
  assert.deepEqual(checkOf("type", "occurrences"), [...domain.OCCURRENCE_TYPES]);
  assert.deepEqual(checkOf("action", "occurrences"), [...domain.OCCURRENCE_ACTIONS]);
  assert.deepEqual(checkOf("result", "deliveries"), [...domain.DELIVERY_RESULTS]);
  assert.deepEqual(checkOf("type", "documents"), [...domain.DOCUMENT_TYPES]);
  assert.deepEqual(checkOf("status", "solicitations"), [...domain.SOLICITATION_STATUSES]);
});

test("round-trip: operação completa gravada e relida é idêntica", { skip }, async () => {
  const demo = generateAtlasOperation(NOW);
  await store.replaceAll("atlas", demo);
  const loaded = await store.load("atlas");
  assert.deepEqual(normalize(loaded), normalize(demo));
});

test("comando via Postgres persiste só o que mudou e audita", { skip }, async () => {
  const actor: Actor = { userId: "u1", email: "op@atlas.test", name: "Op", tenantId: "atlas", role: "operador" };
  const deps = { store, audit: new PostgresAuditLog(pool), clock: { now: () => NOW } };
  const before = (await store.load("atlas"))!;
  const ship = before.shipments.find((s) => s.routeCode === "RJ-ZONA-OESTE-042")!;

  const out = await executeCommand(deps, actor, { type: "COMPLETE_DELIVERY", shipmentId: ship.id });
  assert.equal(out.ok, true);

  const expected = reduce(before, { type: "COMPLETE_DELIVERY", shipmentId: ship.id }, NOW);
  assert.deepEqual(normalize(await store.load("atlas")), normalize(expected));

  const audit = await pool.query("select outcome, email, command_type from audit_log order by id desc limit 1");
  assert.deepEqual(audit.rows[0], { outcome: "applied", email: "op@atlas.test", command_type: "COMPLETE_DELIVERY" });
});

test("comandos concorrentes da mesma empresa não duplicam IDs", { skip }, async () => {
  const actor: Actor = { userId: "u1", email: "op@atlas.test", name: "Op", tenantId: "atlas", role: "operador" };
  const deps = { store, audit: new PostgresAuditLog(pool), clock: { now: () => NOW } };
  const data = (await store.load("atlas"))!;
  const input = {
    customerId: data.customers[0].id, originId: "loc-cd-1", destinationId: "loc-cli-1", operationType: "B2B" as const,
    priority: "Normal" as const, pickupDate: "2026-09-30", dueDate: "2026-10-01",
    items: [{ description: "Caixas", quantity: 1, unitWeightKg: 5 }], cargoCharacteristics: [],
  };
  const results = await Promise.all(Array.from({ length: 6 }, () => executeCommand(deps, actor, { type: "CREATE_ORDER", input })));
  assert.ok(results.every((r) => r.ok));
  const ids = (await store.load("atlas"))!.orders.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("RLS: papel da aplicação só enxerga a empresa da transação", { skip }, async () => {
  await store.replaceAll("outra", { ...generateEmptyOperation(), company: { ...generateEmptyOperation().company, id: "outra", name: "Outra" } });
  await pool.query("create role orbita_app_test login password 'x'; grant usage on schema public to orbita_app_test; grant select, insert, update, delete on all tables in schema public to orbita_app_test;");
  const appUrl = new URL(url!);
  appUrl.username = "orbita_app_test";
  appUrl.password = "x";
  const client = new pg.Client({ connectionString: appUrl.toString() });
  await client.connect();
  try {
    const none = await client.query("select count(*)::int as n from orders");
    assert.equal(none.rows[0].n, 0, "sem contexto de empresa, nada é visível");

    await client.query("begin");
    await client.query("select set_config('app.company_id', 'outra', true)");
    const other = await client.query("select count(*)::int as n from orders");
    assert.equal(other.rows[0].n, 0, "a outra empresa não vê pedidos da atlas");
    await assert.rejects(
      client.query("insert into products (company_id, id, name, category) values ('atlas', 'x', 'x', 'x')"),
      /row-level security/
    );
    await client.query("rollback");
  } finally {
    await client.end();
  }
});

test("FK composta impede referenciar cadastro de outra empresa", { skip }, async () => {
  const data = generateEmptyOperation();
  let s = { ...data, company: { ...data.company, id: "outra" } };
  s = reduce(s, {
    type: "CREATE_ORDER",
    input: {
      customerId: s.customers[0].id, originId: "loc-cd-1", destinationId: "loc-cli-1", operationType: "B2B",
      priority: "Normal", pickupDate: "2026-09-30", dueDate: "2026-10-01", items: [{ description: "Caixas", quantity: 1, unitWeightKg: 1 }], cargoCharacteristics: [],
    },
  }, NOW);
  // Cliente inexistente na empresa "outra" → a FK composta rejeita no commit.
  const tampered = { ...s, orders: s.orders.map((o) => ({ ...o, customerId: "cust-que-so-existe-na-atlas" })) };
  await assert.rejects(store.replaceAll("outra", tampered), /foreign key/);
});

test("memberships: convite por e-mail e vínculo no primeiro acesso", { skip }, async () => {
  const members = new PostgresMembershipStore(pool);
  await members.grant({ companyId: "atlas", email: "Gestora@Atlas.test", role: "gerente" });
  await members.bindUser("atlas", "gestora@atlas.test", "neon-user-1");
  const list = await members.listForEmail("GESTORA@atlas.test");
  assert.equal(list.length, 1);
  assert.equal(list[0].role, "gerente");
  assert.equal(list[0].userId, "neon-user-1");
});
