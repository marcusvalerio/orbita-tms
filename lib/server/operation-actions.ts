"use server";

import { getAppMode } from "../config/runtime";
import { resolveSession } from "./session";
import { getProductionDeps } from "./container";
import { executeCommand, readOperation, type CommandOutcome } from "../application/execute-command";
import type { SimulationAction } from "../sim/reducer";
import type { OperationDataset } from "../domain/types";

// Fronteira de escrita do Modo Produção. Toda chamada revalida a sessão no
// servidor: nada vindo do navegador (papel, empresa, parceiro) é confiado.

export async function runOperationCommand(action: SimulationAction): Promise<CommandOutcome> {
  if (getAppMode() !== "production") {
    return { ok: false, error: "Servidor em Modo Demo: a operação roda no navegador.", code: "denied" };
  }
  if (!action || typeof action !== "object" || typeof (action as { type?: unknown }).type !== "string") {
    return { ok: false, error: "Comando inválido.", code: "rule" };
  }
  const session = await resolveSession();
  if (session.status !== "ok") {
    return { ok: false, error: "Sua sessão expirou. Entre novamente.", code: "denied" };
  }
  return executeCommand(getProductionDeps(), session.actor, action);
}

export async function refreshOperation(): Promise<OperationDataset | null> {
  if (getAppMode() !== "production") return null;
  const session = await resolveSession();
  if (session.status !== "ok") return null;
  return readOperation(getProductionDeps(), session.actor);
}
