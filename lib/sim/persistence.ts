import type { OperationDataset } from "../domain/types";

const STORAGE_KEY = "orbita-tms-simulation-v1";

export function loadPersistedState(): OperationDataset | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OperationDataset;
  } catch {
    // Estado corrompido ou schema antigo incompatível — ignora e deixa a
    // simulação ser reinicializada a partir dos dados iniciais.
    return null;
  }
}

export function persistState(data: OperationDataset): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Armazenamento indisponível (modo privado, cota excedida etc.) —
    // a simulação continua funcionando apenas em memória para esta sessão.
  }
}

export function clearPersistedState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem ação possível — segue.
  }
}
