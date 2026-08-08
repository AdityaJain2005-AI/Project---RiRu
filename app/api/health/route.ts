import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

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

  return Response.json(
    {
      status: "ok",
      service: "facelab",
      db,
      scans,
      env: process.env.NODE_ENV ?? "unknown",
      ...(detail ? { detail } : {}),
    },
    { status: 200 }
  );
}
