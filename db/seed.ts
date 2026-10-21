import { getPool } from "../lib/infrastructure/postgres/pool";
import { PostgresOperationStore } from "../lib/infrastructure/postgres/operation-store";
import { PostgresMembershipStore } from "../lib/infrastructure/postgres/membership-store";
import { generateEmptyOperation } from "../lib/sim/generate-empty";
import { generateAtlasOperation } from "../lib/sim/generate-atlas";
import { isRole } from "../lib/authz/rbac";

// Prepara uma empresa no banco de PRODUÇÃO/homologação. Uso:
//   npm run db:seed -- --company atlas                 cadastros de referência, sem movimentação
//   npm run db:seed -- --company atlas --with-demo     inclui o cenário de demonstração
//   npm run db:seed -- --company atlas --admin pessoa@empresa.com
//   npm run db:seed -- --company atlas --grant pessoa@empresa.com:planejador
// Nunca apaga dados existentes: recusa rodar sobre empresa que já tem movimentação.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL.");
  const companyId = arg("company") ?? "atlas";
  const pool = getPool(url);
  const store = new PostgresOperationStore(pool);
  const members = new PostgresMembershipStore(pool);

  const existing = await store.load(companyId);
  if (!existing) {
    const base = process.argv.includes("--with-demo") ? generateAtlasOperation() : generateEmptyOperation();
    await store.replaceAll(companyId, { ...base, company: { ...base.company, id: companyId } });
    console.log(`Empresa ${companyId} criada${process.argv.includes("--with-demo") ? " com cenário de demonstração" : ""}.`);
  } else {
    console.log(`Empresa ${companyId} já existe — dados preservados.`);
  }

  const admin = arg("admin");
  if (admin) {
    await members.grant({ companyId, email: admin, role: "administrador" });
    console.log(`${admin} → administrador`);
  }
  const grant = arg("grant");
  if (grant) {
    const [email, role, partnerCompanyId] = grant.split(":");
    if (!isRole(role)) throw new Error(`Papel inválido: ${role}`);
    await members.grant({ companyId, email, role, partnerCompanyId });
    console.log(`${email} → ${role}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
