import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 3,
  connectionTimeoutMillis: 2500,
});

export async function GET() {
  let db: "ok" | "error" = "error";
  let detail = "";

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      db = "ok";
    } finally {
      client.release();
    }
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }

  const body = {
    status: "ok",
    service: "facelab",
    db,
    env: process.env.NODE_ENV ?? "unknown",
    ...(detail ? { detail } : {}),
  };

  // Always 200 for platform readiness — DB status is advisory in payload.
  return Response.json(body, { status: 200 });
}
