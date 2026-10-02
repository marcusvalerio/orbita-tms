import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import pg from "pg";

// Aplica db/migrations/*.sql em ordem, uma transação por arquivo, registrando
// versão e checksum em schema_migrations. Idempotente. Uso:
//   DATABASE_URL=postgres://… npm run db:migrate

const DIR = join(import.meta.dirname, "migrations");

export function listMigrations() {
  return readdirSync(DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const sql = readFileSync(join(DIR, file), "utf8");
      return { version: file.replace(/\.sql$/, ""), sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

export async function migrate(connectionString: string, log: (msg: string) => void = console.log) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`create table if not exists schema_migrations (
      version text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const applied = new Map(
      (await client.query("select version, checksum from schema_migrations")).rows.map((r) => [r.version, r.checksum])
    );
    for (const m of listMigrations()) {
      const existing = applied.get(m.version);
      if (existing) {
        if (existing !== m.checksum) throw new Error(`Migration ${m.version} foi alterada depois de aplicada.`);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(m.sql);
        await client.query("insert into schema_migrations (version, checksum) values ($1, $2)", [m.version, m.checksum]);
        await client.query("commit");
        log(`aplicada ${m.version}`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Falha em ${m.version}: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Defina DATABASE_URL (ou DATABASE_URL_UNPOOLED) para migrar.");
    process.exit(1);
  }
  migrate(url).then(
    () => console.log("Migrations em dia."),
    (err) => {
      console.error(err.message);
      process.exit(1);
    }
  );
}
