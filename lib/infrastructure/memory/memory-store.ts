import type { AuditEntry, AuditLog, OperationStore } from "../../application/ports";
import type { OperationDataset } from "../../domain/types";

/** Adapter em memória — testes de aplicação e execução sem banco. */
export class MemoryOperationStore implements OperationStore {
  private readonly data = new Map<string, OperationDataset>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(seed?: Record<string, OperationDataset>) {
    Object.entries(seed ?? {}).forEach(([tenant, dataset]) => this.data.set(tenant, dataset));
  }

  async load(tenantId: string) {
    return this.data.get(tenantId) ?? null;
  }

  transact<T>(
    tenantId: string,
    work: (current: OperationDataset) => Promise<{ next?: OperationDataset; result: T }> | { next?: OperationDataset; result: T }
  ): Promise<T> {
    // Serializa as transações como o lock por empresa do adapter PostgreSQL.
    const run = this.queue.then(async () => {
      const current = this.data.get(tenantId);
      if (!current) throw new Error(`Empresa ${tenantId} não encontrada.`);
      const { next, result } = await work(current);
      if (next) this.data.set(tenantId, next);
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

export class MemoryAuditLog implements AuditLog {
  readonly entries: AuditEntry[] = [];
  async record(entry: AuditEntry) {
    this.entries.push(entry);
  }
}
