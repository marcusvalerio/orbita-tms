import type { OperationDataset, EntityCounters } from "../domain/types";

const STORAGE_KEY = "orbita-tms-simulation-v1";

/**
 * ================================================================
 * VERSIONAMENTO DO SCHEMA PERSISTIDO
 * ================================================================
 *
 * SCHEMA_VERSION atual: 2
 *
 * Histórico:
 *   v1 → formato original. Também cobre qualquer estado salvo sem
 *        envelope de versão (localStorage anterior a este mecanismo),
 *        tratado como v1 por não possuir `schemaVersion`.
 *   v2 → adiciona `counters` (IDs sequenciais persistentes por tipo de
 *        entidade: PED-00001, CAR-00001 etc.) e `orderEvents` (histórico
 *        por pedido). Migração v1→v2 preenche esses campos com valores
 *        neutros quando ausentes.
 *
 * Comportamento para estado corrompido ou incompatível de forma
 * irrecuperável: é descartado silenciosamente (log de desenvolvimento via
 * console.warn) e a aplicação inicializa um dataset vazio válido — nunca
 * repassa um objeto inválido ao reducer.
 */
export const SCHEMA_VERSION = 2;

interface PersistedEnvelope {
  schemaVersion: number;
  data: unknown;
}

const EMPTY_COUNTERS: EntityCounters = {
  order: 1,
  load: 1,
  shipment: 1,
  delivery: 1,
  occurrence: 1,
  document: 1,
  pod: 1,
  event: 1,
};

const REQUIRED_ARRAY_FIELDS: (keyof OperationDataset)[] = [
  "locations",
  "customers",
  "products",
  "vehicles",
  "drivers",
  "carriers",
  "orders",
  "loads",
  "tenders",
  "shipments",
  "occurrences",
  "deliveries",
  "rates",
  "freights",
  "documents",
  "kpiHistory",
  "orderEvents",
];

const REQUIRED_COUNTER_FIELDS: (keyof EntityCounters)[] = [
  "order",
  "load",
  "shipment",
  "delivery",
  "occurrence",
  "document",
  "pod",
  "event",
];

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Cada entrada migra da sua própria versão para a próxima (N → N+1). */
const MIGRATIONS: Record<number, Migration> = {
  1: (data) => ({
    ...data,
    orderEvents: Array.isArray(data.orderEvents) ? data.orderEvents : [],
    counters:
      data.counters && typeof data.counters === "object" ? data.counters : { ...EMPTY_COUNTERS },
  }),
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reconhece um objeto salvo antes do envelope de versão existir (schemaVersion 1 implícito). */
function looksLikeLegacyDataset(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  return Array.isArray(value.orders) && Array.isArray(value.locations) && Array.isArray(value.carriers);
}

/** Roda a cadeia de migrações de `fromVersion` até SCHEMA_VERSION, em sequência. */
function runMigrations(data: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let migrated = data;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) break; // sem migração definida para esse degrau — validação final vai pegar o que faltar
    migrated = migrate(migrated);
  }
  return migrated;
}

/** Valida a estrutura final — depois disso, o resto da aplicação pode assumir um OperationDataset íntegro. */
function isValidOperationDataset(value: unknown): value is OperationDataset {
  if (!isPlainObject(value)) return false;
  if (!REQUIRED_ARRAY_FIELDS.every((key) => Array.isArray(value[key]))) return false;
  if (!isPlainObject(value.counters)) return false;
  const counters = value.counters as Record<string, unknown>;
  if (!REQUIRED_COUNTER_FIELDS.every((key) => typeof counters[key] === "number")) return false;
  if (!isPlainObject(value.company)) return false;
  return true;
}

/**
 * Núcleo puro (sem tocar em `window`) de parse → identificar versão →
 * migrar → normalizar → validar. Testável isoladamente.
 */
export function parsePersistedState(raw: string | null): OperationDataset | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[ÓRBITA] Estado persistido não é um JSON válido — descartando.");
    return null;
  }

  let sourceVersion: number;
  let rawData: unknown;

  if (isPlainObject(parsed) && typeof parsed.schemaVersion === "number" && "data" in parsed) {
    sourceVersion = parsed.schemaVersion as number;
    rawData = parsed.data;
  } else if (looksLikeLegacyDataset(parsed)) {
    // Estado salvo antes do envelope de versão existir.
    sourceVersion = 1;
    rawData = parsed;
  } else {
    console.warn("[ÓRBITA] Estado persistido não reconhecido — descartando.");
    return null;
  }

  if (!isPlainObject(rawData)) {
    console.warn("[ÓRBITA] Estado persistido corrompido (payload não é um objeto) — descartando.");
    return null;
  }

  const migrated = runMigrations(rawData, sourceVersion);

  if (!isValidOperationDataset(migrated)) {
    console.warn(
      `[ÓRBITA] Estado persistido (v${sourceVersion}) incompatível de forma irrecuperável após migração — descartando e inicializando operação vazia.`
    );
    return null;
  }

  return migrated;
}

export function loadPersistedState(): OperationDataset | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const result = parsePersistedState(raw);
    if (raw && !result) {
      // O que estava salvo era irrecuperável — limpa para não tentar de novo à toa.
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return result;
  } catch {
    return null;
  }
}

export function persistState(data: OperationDataset): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: PersistedEnvelope = { schemaVersion: SCHEMA_VERSION, data };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
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
