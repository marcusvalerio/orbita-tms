import "server-only";
import { getDatabaseUrl } from "../config/runtime";
import { getPool } from "../infrastructure/postgres/pool";
import { PostgresAuditLog, PostgresOperationStore } from "../infrastructure/postgres/operation-store";
import { PostgresMembershipStore } from "../infrastructure/postgres/membership-store";
import { systemClock } from "../application/ports";
import type { CommandDeps } from "../application/execute-command";

// Raiz de composição do Modo Produção: único lugar que conhece os adapters
// concretos. Casos de uso e telas dependem apenas das portas.

export function getProductionDeps(): CommandDeps & { members: PostgresMembershipStore } {
  const pool = getPool(getDatabaseUrl());
  return {
    store: new PostgresOperationStore(pool),
    audit: new PostgresAuditLog(pool),
    clock: systemClock,
    members: new PostgresMembershipStore(pool),
  };
}
