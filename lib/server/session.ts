import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getIdentityProvider, type Identity } from "../auth";
import { getProductionDeps } from "./container";
import type { Actor } from "../authz/rbac";
import type { Membership } from "../infrastructure/postgres/membership-store";

export const COMPANY_COOKIE = "orbita_company";

export type SessionState =
  | { status: "anonymous" }
  | { status: "no-membership"; identity: Identity }
  | { status: "ok"; actor: Actor; memberships: Membership[]; companyName: string };

/**
 * Identidade (Neon Auth) + vínculo (memberships) → Actor. Deduplicado por
 * requisição. Toda leitura/escrita do Modo Produção passa por aqui.
 */
export const resolveSession = cache(async (): Promise<SessionState> => {
  const identity = await getIdentityProvider().getIdentity();
  if (!identity) return { status: "anonymous" };

  const { members } = getProductionDeps();
  const memberships = await members.listForEmail(identity.email);
  if (memberships.length === 0) return { status: "no-membership", identity };

  const preferred = (await cookies()).get(COMPANY_COOKIE)?.value;
  const m = memberships.find((x) => x.companyId === preferred) ?? memberships[0];
  if (!m.userId) await members.bindUser(m.companyId, identity.email, identity.userId);
  else if (m.userId !== identity.userId) return { status: "no-membership", identity }; // convite já ligado a outra conta

  return {
    status: "ok",
    memberships,
    companyName: m.companyName,
    actor: {
      userId: identity.userId,
      email: identity.email,
      name: m.displayName ?? identity.name,
      tenantId: m.companyId,
      role: m.role,
      partnerCompanyId: m.partnerCompanyId,
    },
  };
});
