import type { SimulationAction, SimulationActionType } from "../sim/reducer";

// Autorização (RBAC) — separada da autenticação e do domínio.
// A autenticação diz QUEM é a pessoa; este módulo decide O QUE ela pode fazer
// numa empresa (tenant). O domínio do TMS não conhece papéis nem permissões.

export const ROLES = [
  "administrador",
  "gerente",
  "planejador",
  "operador",
  "conferente",
  "visualizacao",
  "parceiro",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  administrador: "Administrador",
  gerente: "Gerente de Operações",
  planejador: "Planejador",
  operador: "Operador",
  conferente: "Conferente",
  visualizacao: "Somente leitura",
  parceiro: "Empresa parceira",
};

export const PERMISSIONS = [
  "operation:read", // ver a operação interna (pedidos, cargas, viagens, frota…)
  "orders:create",
  "planning:consolidate", // formar cargas
  "shipments:contract", // contratar transporte / despachar viagem
  "shipments:execute", // iniciar viagem e concluir entrega
  "occurrences:report",
  "occurrences:resolve",
  "partners:manage",
  "solicitations:create",
  "solicitations:convert",
  "members:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

/**
 * Matriz papel → permissões. Novos papéis ou permissões entram aqui sem tocar
 * no domínio; a matriz é coberta por testes.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  administrador: ALL,
  gerente: ALL.filter((p) => p !== "members:manage"),
  planejador: [
    "operation:read",
    "orders:create",
    "planning:consolidate",
    "shipments:contract",
    "occurrences:report",
    "solicitations:convert",
  ],
  operador: ["operation:read", "orders:create", "shipments:execute", "occurrences:report", "occurrences:resolve"],
  conferente: ["operation:read", "shipments:execute", "occurrences:report"],
  visualizacao: ["operation:read"],
  parceiro: ["solicitations:create"],
};

/** Permissão exigida por cada comando do domínio. */
export const COMMAND_PERMISSION: Record<SimulationActionType, Permission> = {
  CREATE_ORDER: "orders:create",
  CREATE_LOAD: "planning:consolidate",
  CREATE_SHIPMENT: "shipments:contract",
  START_SHIPMENT: "shipments:execute",
  COMPLETE_DELIVERY: "shipments:execute",
  CREATE_OCCURRENCE: "occurrences:report",
  RESOLVE_OCCURRENCE: "occurrences:resolve",
  CREATE_PARTNER_COMPANY: "partners:manage",
  REGENERATE_PARTNER_CODE: "partners:manage",
  CREATE_SOLICITATION: "solicitations:create",
  CONVERT_SOLICITATION_TO_ORDER: "solicitations:convert",
};

/** Pessoa autenticada no contexto de uma empresa. */
export interface Actor {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  role: Role;
  /** Só para o papel "parceiro": a empresa parceira que a pessoa representa. */
  partnerCompanyId?: string;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(actor: Pick<Actor, "role">, permission: Permission): boolean {
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

export type AuthorizationResult = { ok: true } | { ok: false; reason: string };

export function authorizeCommand(actor: Actor, action: SimulationAction): AuthorizationResult {
  const permission = COMMAND_PERMISSION[action.type];
  if (!permission || !can(actor, permission)) {
    return { ok: false, reason: `Seu papel (${ROLE_LABELS[actor.role]}) não permite esta ação.` };
  }
  // Escopo do parceiro: só age em nome da própria empresa parceira.
  if (actor.role === "parceiro") {
    if (!actor.partnerCompanyId) return { ok: false, reason: "Conta de parceiro sem empresa vinculada." };
    if (action.type === "CREATE_SOLICITATION" && action.input.partnerCompanyId !== actor.partnerCompanyId) {
      return { ok: false, reason: "Parceiros só podem solicitar em nome da própria empresa." };
    }
  }
  return { ok: true };
}

/** Pessoa fictícia do Modo Demo (sem login): administrador da operação no navegador. */
export const DEMO_ACTOR: Actor = {
  userId: "demo",
  email: "demo@orbita.local",
  name: "Operador de demonstração",
  tenantId: "atlas",
  role: "administrador",
};
