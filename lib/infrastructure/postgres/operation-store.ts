import type { Pool, PoolClient } from "pg";
import type { AuditEntry, AuditLog, OperationStore } from "../../application/ports";
import type { OperationDataset, Order, Load, Shipment, Stop, OrderItem } from "../../domain/types";
import { COLLECTIONS, COUNTER_COLUMNS, compact, fromDb, rowToEntity, toDb, type CollectionSpec } from "./mapping";

// Adapter PostgreSQL (Neon) da porta OperationStore.
// Cada transação: BEGIN → contexto RLS da empresa → lock da empresa →
// leitura → regra → gravação apenas do que mudou → COMMIT.

type Entity = Record<string, unknown>;
const CHUNK = 400;

/** Contexto da transação: papel sem BYPASSRLS + empresa ativa para as políticas RLS. */
async function setTenant(client: PoolClient, tenantId: string) {
  await client.query("set local role orbita_app");
  await client.query("select set_config('app.company_id', $1, true)", [tenantId]);
}

async function readDataset(client: PoolClient, tenantId: string): Promise<OperationDataset | null> {
  const company = await client.query("select id, name, region, operation_type from companies where id = $1", [tenantId]);
  if (company.rowCount === 0) return null;
  const counters = await client.query("select * from operation_counters where company_id = $1", [tenantId]);

  const data: Record<string, unknown> = {
    company: {
      id: company.rows[0].id,
      name: company.rows[0].name,
      region: company.rows[0].region ?? "",
      operationType: company.rows[0].operation_type,
    },
  };
  for (const spec of COLLECTIONS) {
    const order = spec.idCol === "date" ? "date" : "seq";
    const res = await client.query(`select * from ${spec.table} where company_id = $1 order by ${order}`, [tenantId]);
    data[spec.collection] = res.rows.map((row) => rowToEntity(spec, row));
  }

  const row = counters.rows[0] ?? {};
  data.counters = Object.fromEntries(
    Object.entries(COUNTER_COLUMNS).map(([key, col]) => [key, Number(row[col] ?? 1)])
  );

  // Filhos: itens do pedido, pedidos da carga, paradas da viagem.
  const items = await client.query("select * from order_items where company_id = $1 order by order_id, position", [tenantId]);
  const itemsByOrder = groupBy(items.rows, "order_id");
  (data.orders as Order[]).forEach((o) => {
    o.items = (itemsByOrder.get(o.id) ?? []).map(
      (r) =>
        compact({
          id: r.id,
          productId: fromDb(r.product_id, "text"),
          description: fromDb(r.description, "text"),
          quantity: fromDb(r.quantity, "num"),
          unitWeightKg: fromDb(r.unit_weight_kg, "num"),
          weightKg: fromDb(r.weight_kg, "num"),
          volumeM3: fromDb(r.volume_m3, "num"),
        }) as OrderItem
    );
  });

  const loadOrders = await client.query("select * from load_orders where company_id = $1 order by load_id, position", [tenantId]);
  const byLoad = groupBy(loadOrders.rows, "load_id");
  (data.loads as Load[]).forEach((l) => {
    l.orderIds = (byLoad.get(l.id) ?? []).map((r) => r.order_id as string);
  });

  const stops = await client.query("select * from shipment_stops where company_id = $1 order by shipment_id, sequence", [tenantId]);
  const byShipment = groupBy(stops.rows, "shipment_id");
  const occurrencesByShipment = new Map<string, string[]>();
  (data.occurrences as { id: string; shipmentId: string }[]).forEach((o) =>
    occurrencesByShipment.set(o.shipmentId, [...(occurrencesByShipment.get(o.shipmentId) ?? []), o.id])
  );
  (data.shipments as Shipment[]).forEach((s) => {
    s.stops = (byShipment.get(s.id) ?? []).map(
      (r) =>
        compact({
          id: r.id,
          locationId: r.location_id,
          sequence: Number(r.sequence),
          kind: r.kind,
          plannedTime: fromDb(r.planned_time, "ts"),
          actualTime: fromDb(r.actual_time, "ts"),
          orderIds: fromDb(r.order_ids, "textArr"),
          windowStart: fromDb(r.window_start, "ts"),
          windowEnd: fromDb(r.window_end, "ts"),
          serviceMinutes: fromDb(r.service_minutes, "int"),
        }) as Stop
    );
    s.occurrenceIds = occurrencesByShipment.get(s.id) ?? [];
  });

  return data as unknown as OperationDataset;
}

function groupBy(rows: Entity[], key: string): Map<string, Entity[]> {
  const map = new Map<string, Entity[]>();
  rows.forEach((r) => map.set(r[key] as string, [...(map.get(r[key] as string) ?? []), r]));
  return map;
}

/** Forma canônica para detectar mudança (ignora campos derivados). */
function canonical(spec: CollectionSpec, entity: Entity): string {
  const copy = { ...entity };
  if (spec.collection === "shipments") delete copy.occurrenceIds;
  return JSON.stringify(compact(copy));
}

async function upsertRows(client: PoolClient, tenantId: string, spec: CollectionSpec, entities: Entity[]) {
  const cols = ["company_id", spec.idCol, ...spec.columns.map((c) => c.col)];
  const updates = spec.columns.map((c) => `${c.col} = excluded.${c.col}`).join(", ");
  for (let i = 0; i < entities.length; i += CHUNK) {
    const chunk = entities.slice(i, i + CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((e) => {
      const values = [tenantId, toDb(e[spec.idKey], spec.idCol === "date" ? "date" : "text"), ...spec.columns.map((c) => toDb(e[c.key], c.kind))];
      const placeholders = values.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `insert into ${spec.table} (${cols.join(", ")}) values ${tuples.join(", ")}
       on conflict (company_id, ${spec.idCol}) do update set ${updates}`,
      params
    );
  }
}

async function insertMany(client: PoolClient, table: string, cols: string[], rows: unknown[][]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const params: unknown[] = [];
    const tuples = rows.slice(i, i + CHUNK).map(
      (r) => `(${r.map((v) => (params.push(v), `$${params.length}`)).join(", ")})`
    );
    await client.query(`insert into ${table} (${cols.join(", ")}) values ${tuples.join(", ")}`, params);
  }
}

async function replaceChildren(client: PoolClient, tenantId: string, spec: CollectionSpec, parents: Entity[]) {
  if (parents.length === 0) return;
  const ids = parents.map((p) => p.id as string);
  if (spec.collection === "orders") {
    await client.query("delete from order_items where company_id = $1 and order_id = any($2)", [tenantId, ids]);
    const rows = (parents as unknown as Order[]).flatMap((o) =>
      o.items.map((it, position) => [
        tenantId, o.id, it.id, position, it.productId ?? null, it.description ?? null,
        it.quantity, it.unitWeightKg, it.weightKg, it.volumeM3 ?? null,
      ])
    );
    await insertMany(client, "order_items",
      ["company_id", "order_id", "id", "position", "product_id", "description", "quantity", "unit_weight_kg", "weight_kg", "volume_m3"], rows);
  }
  if (spec.collection === "loads") {
    await client.query("delete from load_orders where company_id = $1 and load_id = any($2)", [tenantId, ids]);
    const rows = (parents as unknown as Load[]).flatMap((l) => l.orderIds.map((orderId, position) => [tenantId, l.id, orderId, position]));
    await insertMany(client, "load_orders", ["company_id", "load_id", "order_id", "position"], rows);
  }
  if (spec.collection === "shipments") {
    await client.query("delete from shipment_stops where company_id = $1 and shipment_id = any($2)", [tenantId, ids]);
    const rows = (parents as unknown as Shipment[]).flatMap((s) =>
      s.stops.map((st) => [
        tenantId, s.id, st.id, st.locationId, st.sequence, st.kind, st.plannedTime, st.actualTime ?? null,
        st.orderIds ?? null, st.windowStart ?? null, st.windowEnd ?? null, st.serviceMinutes ?? null,
      ])
    );
    await insertMany(client, "shipment_stops",
      ["company_id", "shipment_id", "id", "location_id", "sequence", "kind", "planned_time", "actual_time", "order_ids", "window_start", "window_end", "service_minutes"], rows);
  }
}

/** Grava a diferença entre `previous` e `next` (previous = null grava tudo). */
export async function writeChanges(client: PoolClient, tenantId: string, previous: OperationDataset | null, next: OperationDataset) {
  const prevCompany = previous?.company;
  if (!prevCompany || JSON.stringify(prevCompany) !== JSON.stringify(next.company)) {
    await client.query(
      `insert into companies (id, name, region, operation_type) values ($1, $2, $3, $4)
       on conflict (id) do update set name = excluded.name, region = excluded.region, operation_type = excluded.operation_type`,
      [tenantId, next.company.name, next.company.region, next.company.operationType]
    );
  }

  for (const spec of COLLECTIONS) {
    const before = new Map(((previous?.[spec.collection] as unknown as Entity[]) ?? []).map((e) => [String(e[spec.idKey]), canonical(spec, e)]));
    const after = next[spec.collection] as unknown as Entity[];
    const changed = after.filter((e) => before.get(String(e[spec.idKey])) !== canonical(spec, e));
    const afterIds = new Set(after.map((e) => String(e[spec.idKey])));
    const removed = [...before.keys()].filter((id) => !afterIds.has(id));

    if (removed.length > 0) {
      await client.query(`delete from ${spec.table} where company_id = $1 and ${spec.idCol}::text = any($2)`, [tenantId, removed]);
    }
    if (changed.length > 0) {
      await upsertRows(client, tenantId, spec, changed);
      await replaceChildren(client, tenantId, spec, changed);
    }
  }

  if (!previous || JSON.stringify(previous.counters) !== JSON.stringify(next.counters)) {
    const cols = Object.values(COUNTER_COLUMNS);
    const values = Object.keys(COUNTER_COLUMNS).map((k) => next.counters[k as keyof typeof COUNTER_COLUMNS]);
    await client.query(
      `insert into operation_counters (company_id, ${cols.join(", ")}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")})
       on conflict (company_id) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}`,
      [tenantId, ...values]
    );
  }
}

export class PostgresOperationStore implements OperationStore {
  constructor(private readonly pool: Pool) {}

  async load(tenantId: string): Promise<OperationDataset | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin read only");
      await setTenant(client, tenantId);
      const data = await readDataset(client, tenantId);
      await client.query("commit");
      return data;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async transact<T>(
    tenantId: string,
    work: (current: OperationDataset) => Promise<{ next?: OperationDataset; result: T }> | { next?: OperationDataset; result: T }
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await setTenant(client, tenantId);
      // Lock da empresa: comandos concorrentes da mesma empresa são serializados.
      const lock = await client.query("select id from companies where id = $1 for update", [tenantId]);
      if (lock.rowCount === 0) throw new Error(`Empresa ${tenantId} não encontrada.`);
      const current = await readDataset(client, tenantId);
      const { next, result } = await work(current!);
      if (next) await writeChanges(client, tenantId, current, next);
      await client.query("commit");
      return result;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** Cria (ou substitui por completo) a operação de uma empresa — usado pelo seed. */
  async replaceAll(tenantId: string, data: OperationDataset): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await setTenant(client, tenantId);
      const current = await client
        .query("select 1 from companies where id = $1", [tenantId])
        .then((r) => (r.rowCount ? readDataset(client, tenantId) : null));
      await writeChanges(client, tenantId, current, data);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

export class PostgresAuditLog implements AuditLog {
  constructor(private readonly pool: Pool) {}
  async record(e: AuditEntry): Promise<void> {
    await this.pool.query(
      `insert into audit_log (company_id, user_id, email, command_type, payload, outcome, message, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [e.tenantId, e.userId, e.email, e.commandType, JSON.stringify(e.payload), e.outcome, e.message ?? null, e.at]
    );
  }
}
