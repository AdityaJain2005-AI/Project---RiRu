import { Pool, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { facelabPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.facelabPool) {
    globalForPg.facelabPool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      max: 8,
      connectionTimeoutMillis: 4000,
    });
  }
  return globalForPg.facelabPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getPool().query<T>(text, params);
}

/** Demo profile id seeded by migrate.js */
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
