import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type MlStatus = "ok" | "unconfigured" | "unauthorized" | "unreachable";

async function checkMl(): Promise<MlStatus> {
  const base = process.env.ML_SERVICE_URL?.replace(/\/$/, "");
  if (!base) return "unconfigured";
  const token = process.env.ML_SERVICE_TOKEN;
  try {
    const res = await fetch(`${base}/internal/v1/health`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (res.status === 401) return "unauthorized";
    if (!res.ok) return "unreachable";
    return "ok";
  } catch {
    return "unreachable";
  }
}

export async function GET() {
  let db: "ok" | "error" = "error";
  let detail = "";
  let scans = 0;

  try {
    await query("SELECT 1");
    const r = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM skin_scans`);
    scans = r.rows[0]?.c ?? 0;
    db = "ok";
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }

  const ml = await checkMl();

  return Response.json(
    {
      status: "ok",
      service: "riru",
      db,
      ml,
      scans,
      env: process.env.NODE_ENV ?? "unknown",
      ...(detail ? { detail } : {}),
    },
    { status: 200 }
  );
}
