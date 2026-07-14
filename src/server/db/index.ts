import "server-only";

/**
 * Conexão com o Postgres.
 *
 * Um Pool único por processo. Em serverless (Vercel) cada instância quente
 * reaproveita o pool; por isso o `max` é baixo — o gargalo lá é o número de
 * conexões do banco, não o do processo.
 *
 * Funciona com Neon, Supabase ou qualquer Postgres: só muda a DATABASE_URL.
 * Use sempre a string do POOLER (não a direta) quando publicar em serverless.
 */

import { Pool, type QueryResultRow } from "pg";

declare global {
  var __simuladorPool: Pool | undefined;
}

function criarPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não está definida. Copie .env.example para .env.local e preencha.",
    );
  }

  // Provedores gerenciados (Neon/Supabase) exigem TLS; o Postgres local não tem
  // certificado. `sslmode=disable` na URL desliga explicitamente.
  const desabilitarSsl =
    connectionString.includes("sslmode=disable") ||
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: desabilitarSsl ? undefined : { rejectUnauthorized: true },
  });
}

/** Pool compartilhado — o `globalThis` evita recriar a cada hot reload no dev. */
export function pool(): Pool {
  if (!global.__simuladorPool) {
    global.__simuladorPool = criarPool();
  }
  return global.__simuladorPool;
}

/**
 * Consulta parametrizada. **Nunca** interpole valor em SQL: sempre `$1, $2…`.
 */
export async function consultar<T extends QueryResultRow>(
  sql: string,
  parametros: readonly unknown[] = [],
): Promise<T[]> {
  const resultado = await pool().query<T>(sql, parametros as unknown[]);
  return resultado.rows;
}

/** Consulta que espera 0 ou 1 linha. */
export async function consultarUm<T extends QueryResultRow>(
  sql: string,
  parametros: readonly unknown[] = [],
): Promise<T | null> {
  const linhas = await consultar<T>(sql, parametros);
  return linhas[0] ?? null;
}
