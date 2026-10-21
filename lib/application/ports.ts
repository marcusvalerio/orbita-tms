import type { OperationDataset } from "../domain/types";

// Portas da aplicação. Casos de uso dependem destas interfaces; os adapters
// (memória, localStorage, PostgreSQL/Neon) as implementam em lib/infrastructure.

/**
 * Unidade de trabalho sobre a operação de uma empresa. `transact` garante que
 * leitura → regra → gravação aconteçam de forma atômica e serializada por
 * empresa (sem corrida entre dois operadores no mesmo instante).
 */
export interface OperationStore {
  load(tenantId: string): Promise<OperationDataset | null>;
  transact<T>(
    tenantId: string,
    work: (current: OperationDataset) => Promise<{ next?: OperationDataset; result: T }> | { next?: OperationDataset; result: T }
  ): Promise<T>;
}

/** Registro de auditoria: quem executou qual comando, com qual resultado. */
export interface AuditEntry {
  tenantId: string;
  userId: string;
  email: string;
  commandType: string;
  payload: unknown;
  outcome: "applied" | "rejected" | "denied" | "failed";
  message?: string;
  at: Date;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
