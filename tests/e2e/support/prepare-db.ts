import pg from "pg";
import { migrate } from "../../../db/migrate";
import { getPool } from "../../../lib/infrastructure/postgres/pool";
import { PostgresOperationStore } from "../../../lib/infrastructure/postgres/operation-store";
import { PostgresMembershipStore } from "../../../lib/infrastructure/postgres/membership-store";
import { generateAtlasOperation } from "../../../lib/sim/generate-atlas";
import { ROLES } from "../../../lib/authz/rbac";

// Banco do E2E de produção: recriado do zero a cada execução.
// Executado em processo separado (node --import tsx) pelo global setup.
async function prepare() {
  const url = process.env.E2E_DATABASE_URL!;
  if (!/e2e|test/.test(new URL(url).pathname)) throw new Error("E2E_DATABASE_URL precisa apontar para um banco de teste.");
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query("drop schema public cascade; create schema public;");
  await admin.end();

  await migrate(url, () => {});
  const pool = getPool(url);
  await new PostgresOperationStore(pool).replaceAll("atlas", generateAtlasOperation());
  const members = new PostgresMembershipStore(pool);
  for (const role of ROLES) {
    await members.grant({ companyId: "atlas", email: `${role}@atlas.test`, role, partnerCompanyId: role === "parceiro" ? "PAR-00001" : undefined });
  }
  await pool.end();
}

prepare().catch((err) => {
  console.error(err);
  process.exit(1);
});
