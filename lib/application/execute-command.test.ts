import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCommand, readOperation } from "./execute-command";
import { MemoryAuditLog, MemoryOperationStore } from "../infrastructure/memory/memory-store";
import { generateAtlasOperation } from "../sim/generate-atlas";
import { ROLES, ROLE_PERMISSIONS, COMMAND_PERMISSION, can, type Actor, type Role } from "../authz/rbac";
import type { SimulationAction } from "../sim/reducer";

const NOW = new Date("2026-09-30T15:00:00.000Z");
const clock = { now: () => NOW };

function setup() {
  const store = new MemoryOperationStore({ atlas: generateAtlasOperation(NOW) });
  const audit = new MemoryAuditLog();
  return { deps: { store, audit, clock }, store, audit };
}

const actor = (role: Role, extra: Partial<Actor> = {}): Actor => ({
  userId: `u-${role}`,
  email: `${role}@atlas.test`,
  name: role,
  tenantId: "atlas",
  role,
  ...extra,
});

async function newOrderAction(store: MemoryOperationStore): Promise<SimulationAction> {
  const data = (await store.load("atlas"))!;
  return {
    type: "CREATE_ORDER",
    input: {
      customerId: data.customers[0].id,
      originId: "loc-cd-1",
      destinationId: "loc-cli-1",
      operationType: "B2B",
      priority: "Normal",
      pickupDate: "2026-09-30",
      dueDate: "2026-10-01",
      items: [{ description: "Caixas", quantity: 2, unitWeightKg: 10 }],
      cargoCharacteristics: [],
    },
  };
}

test("RBAC: todo comando do domínio exige uma permissão declarada", () => {
  for (const [type, permission] of Object.entries(COMMAND_PERMISSION)) {
    assert.ok(permission, type);
  }
});

test("RBAC: administrador pode tudo; somente leitura não escreve", () => {
  for (const p of ROLE_PERMISSIONS.administrador) assert.ok(can({ role: "administrador" }, p));
  assert.deepEqual([...ROLE_PERMISSIONS.visualizacao], ["operation:read"]);
  assert.ok(ROLES.every((r) => ROLE_PERMISSIONS[r].length > 0));
});

test("comando permitido é aplicado, persistido e auditado", async () => {
  const { deps, store, audit } = setup();
  const before = (await store.load("atlas"))!.orders.length;
  const out = await executeCommand(deps, actor("operador"), await newOrderAction(store));
  assert.equal(out.ok, true);
  assert.equal((await store.load("atlas"))!.orders.length, before + 1);
  assert.equal(audit.entries.at(-1)!.outcome, "applied");
  assert.equal(audit.entries.at(-1)!.email, "operador@atlas.test");
});

test("comando sem permissão é negado, não altera a operação e fica auditado", async () => {
  const { deps, store, audit } = setup();
  const before = (await store.load("atlas"))!;
  const out = await executeCommand(deps, actor("visualizacao"), await newOrderAction(store));
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.code, "denied");
  assert.equal(await store.load("atlas"), before);
  assert.equal(audit.entries.at(-1)!.outcome, "denied");
});

test("violação de regra é rejeitada com mensagem e auditada", async () => {
  const { deps, audit } = setup();
  const out = await executeCommand(deps, actor("operador"), { type: "COMPLETE_DELIVERY", shipmentId: "VIA-99999" });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.code, "rule");
  assert.equal(audit.entries.at(-1)!.outcome, "rejected");
});

test("parceiro só solicita em nome da própria empresa", async () => {
  const { deps, store } = setup();
  const data = (await store.load("atlas"))!;
  const partnerId = data.partnerCompanies[0].id;
  const input = {
    partnerCompanyId: "PAR-99999",
    operationType: "B2B" as const,
    originId: "loc-cd-1",
    destinationId: "loc-cli-1",
    pickupDate: "2026-09-30",
    deliveryDate: "2026-10-01",
    productDescription: "Caixas",
    quantity: 1,
    totalWeightKg: 5,
    cargoCharacteristics: [],
  };
  const partner = actor("parceiro", { partnerCompanyId: partnerId });
  const denied = await executeCommand(deps, partner, { type: "CREATE_SOLICITATION", input });
  assert.equal(denied.ok, false);
  const allowed = await executeCommand(deps, partner, { type: "CREATE_SOLICITATION", input: { ...input, partnerCompanyId: partnerId } });
  assert.equal(allowed.ok, true);
});

test("projeção: parceiro nunca recebe pedidos, frota, outros parceiros nem código de acesso", async () => {
  const { deps, store } = setup();
  const data = (await store.load("atlas"))!;
  const partnerId = data.partnerCompanies[0].id;
  const view = (await readOperation(deps, actor("parceiro", { partnerCompanyId: partnerId })))!;
  assert.equal(view.orders.length, 0);
  assert.equal(view.vehicles.length, 0);
  assert.equal(view.customers.length, 0);
  assert.ok(view.partnerCompanies.every((p) => p.id === partnerId && p.accessCode === ""));
  assert.ok(view.solicitations.every((s) => s.partnerCompanyId === partnerId));
});

test("comandos concorrentes na mesma empresa são serializados (sem IDs duplicados)", async () => {
  const { deps, store } = setup();
  const action = await newOrderAction(store);
  await Promise.all(Array.from({ length: 5 }, () => executeCommand(deps, actor("operador"), action)));
  const ids = (await store.load("atlas"))!.orders.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
});
