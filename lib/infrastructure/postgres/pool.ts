import pg from "pg";

// Colunas DATE chegam como texto "YYYY-MM-DD" (sem conversão para Date no
// fuso do servidor, que deslocaria o dia).
pg.types.setTypeParser(1082, (value: string) => value);

const globalForPool = globalThis as unknown as { __orbitaPools?: Map<string, pg.Pool> };

/**
 * Pool por connection string, reaproveitado entre recarregamentos em dev.
 * Em produção, use a connection string POOLED do Neon (host com "-pooler").
 */
export function getPool(connectionString: string): pg.Pool {
  globalForPool.__orbitaPools ??= new Map();
  let pool = globalForPool.__orbitaPools.get(connectionString);
  if (!pool) {
    pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
    globalForPool.__orbitaPools.set(connectionString, pool);
  }
  return pool;
}
