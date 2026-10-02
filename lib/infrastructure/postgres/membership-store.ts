import type { Pool } from "pg";
import { isRole, type Role } from "../../authz/rbac";

export interface Membership {
  companyId: string;
  companyName: string;
  email: string;
  userId?: string;
  role: Role;
  partnerCompanyId?: string;
  displayName?: string;
}

/** Diretório de vínculos pessoa ↔ empresa ↔ papel. */
export class PostgresMembershipStore {
  constructor(private readonly pool: Pool) {}

  async listForEmail(email: string): Promise<Membership[]> {
    const res = await this.pool.query(
      `select m.company_id, c.name as company_name, m.email, m.user_id, m.role, m.partner_company_id, m.display_name
         from memberships m join companies c on c.id = m.company_id
        where m.email = lower($1) and m.is_active and c.is_active
        order by c.name`,
      [email]
    );
    return res.rows
      .filter((r) => isRole(r.role))
      .map((r) => ({
        companyId: r.company_id,
        companyName: r.company_name,
        email: r.email,
        userId: r.user_id ?? undefined,
        role: r.role,
        partnerCompanyId: r.partner_company_id ?? undefined,
        displayName: r.display_name ?? undefined,
      }));
  }

  /** Liga o usuário do provedor de identidade ao convite no primeiro acesso. */
  async bindUser(companyId: string, email: string, userId: string): Promise<void> {
    await this.pool.query(
      "update memberships set user_id = $3 where company_id = $1 and email = lower($2) and (user_id is null or user_id = $3)",
      [companyId, email, userId]
    );
  }

  async grant(input: { companyId: string; email: string; role: Role; partnerCompanyId?: string; displayName?: string }): Promise<void> {
    await this.pool.query(
      `insert into memberships (company_id, email, role, partner_company_id, display_name)
       values ($1, lower($2), $3, $4, $5)
       on conflict (company_id, email) do update
         set role = excluded.role, partner_company_id = excluded.partner_company_id,
             display_name = coalesce(excluded.display_name, memberships.display_name), is_active = true`,
      [input.companyId, input.email, input.role, input.partnerCompanyId ?? null, input.displayName ?? null]
    );
  }
}
