import { createRng } from "./rng";
import { generateReferenceData } from "./generate-atlas";
import type { OperationDataset } from "../domain/types";

const REFERENCE_SEED = 8420; // mesma seed dos cadastros — frota/transportadoras/clientes consistentes

/**
 * Operação vazia — o estado inicial real do ÓRBITA. Mantém apenas os
 * cadastros (localidades, clientes, produtos, frota, motoristas,
 * transportadoras); nenhuma movimentação (pedido, carga, viagem, entrega,
 * ocorrência, documento) existe até a pessoa usuária criá-la.
 */
export function generateEmptyOperation(): OperationDataset {
  const rng = createRng(REFERENCE_SEED);
  const { company, locations, customers, products, vehicles, drivers, carriers } = generateReferenceData(rng);

  return {
    company,
    locations,
    customers,
    products,
    vehicles,
    drivers,
    carriers,
    orders: [],
    loads: [],
    tenders: [],
    shipments: [],
    occurrences: [],
    deliveries: [],
    rates: [],
    freights: [],
    documents: [],
    kpiHistory: [],
    orderEvents: [],
    counters: { order: 1, load: 1, shipment: 1, delivery: 1, occurrence: 1, document: 1, pod: 1, event: 1 },
  };
}
