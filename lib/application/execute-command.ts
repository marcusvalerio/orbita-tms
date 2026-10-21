import { applyCommand, type SimulationAction } from "../sim/reducer";
import { authorizeCommand, type Actor } from "../authz/rbac";
import { projectForActor } from "./projection";
import type { AuditLog, Clock, OperationStore } from "./ports";
import type { OperationDataset } from "../domain/types";

export interface CommandDeps {
  store: OperationStore;
  audit: AuditLog;
  clock: Clock;
}

export type CommandOutcome =
  | { ok: true; data: OperationDataset }
  | { ok: false; error: string; code: "denied" | "rule" | "not_found" | "unexpected" };

/**
 * Caso de uso único de escrita: autoriza → aplica a regra de domínio dentro
 * de uma transação serializada por empresa → persiste → audita → devolve a
 * operação já recortada para quem executou.
 */
export async function executeCommand(deps: CommandDeps, actor: Actor, action: SimulationAction): Promise<CommandOutcome> {
  const at = deps.clock.now();
  const base = { tenantId: actor.tenantId, userId: actor.userId, email: actor.email, commandType: action.type, payload: action, at };

  const authz = authorizeCommand(actor, action);
  if (!authz.ok) {
    await deps.audit.record({ ...base, outcome: "denied", message: authz.reason });
    return { ok: false, error: authz.reason, code: "denied" };
  }

  try {
    const outcome = await deps.store.transact<CommandOutcome>(actor.tenantId, (current) => {
      const result = applyCommand(current, action, at);
      if (!result.ok) return { result: { ok: false, error: result.error, code: result.kind === "rule" ? "rule" : "unexpected" } };
      return { next: result.state, result: { ok: true, data: projectForActor(result.state, actor) } };
    });
    await deps.audit.record({
      ...base,
      outcome: outcome.ok ? "applied" : "rejected",
      message: outcome.ok ? undefined : outcome.error,
    });
    return outcome;
  } catch (err) {
    console.error("Falha ao executar comando:", { type: action.type, error: err });
    await deps.audit.record({ ...base, outcome: "failed", message: String(err) }).catch(() => {});
    return { ok: false, error: "Não foi possível concluir a ação. A operação não foi alterada.", code: "unexpected" };
  }
}

export async function readOperation(deps: Pick<CommandDeps, "store">, actor: Actor): Promise<OperationDataset | null> {
  const data = await deps.store.load(actor.tenantId);
  return data ? projectForActor(data, actor) : null;
}
