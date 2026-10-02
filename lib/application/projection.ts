import type { OperationDataset } from "../domain/types";
import { can, type Actor } from "../authz/rbac";

/**
 * Recorte da operação que pode sair do servidor para uma pessoa. Quem tem
 * `operation:read` recebe a operação da empresa; o parceiro recebe apenas o
 * necessário para o Portal (locais selecionáveis, a própria empresa e as
 * próprias solicitações) — nunca pedidos, frota ou dados de outros parceiros.
 */
export function projectForActor(data: OperationDataset, actor: Actor): OperationDataset {
  if (can(actor, "operation:read")) return data;

  const partnerId = actor.partnerCompanyId;
  return {
    company: data.company,
    locations: data.locations,
    customers: [],
    products: [],
    vehicles: [],
    drivers: [],
    carriers: [],
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
    counters: data.counters,
    partnerCompanies: data.partnerCompanies
      .filter((p) => p.id === partnerId)
      .map((p) => ({ ...p, accessCode: "" })),
    solicitations: data.solicitations.filter((s) => s.partnerCompanyId === partnerId),
  };
}
