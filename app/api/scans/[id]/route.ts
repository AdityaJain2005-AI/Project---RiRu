import { DEMO_USER_ID, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const res = await query<{
      id: string;
      overall_score: number;
      metrics: unknown;
      concerns: unknown;
      ingredients: unknown;
      summary: string;
      source: string;
      created_at: string;
    }>(
      `SELECT id, overall_score, metrics, concerns, ingredients, summary, source, created_at
       FROM skin_scans WHERE id = $1 AND user_id = $2`,
      [id, DEMO_USER_ID]
    );
    const row = res.rows[0];
    if (!row) return Response.json({ error: "Scan not found" }, { status: 404 });
    return Response.json({
      scan: {
        id: row.id,
        overallScore: row.overall_score,
        metrics: row.metrics,
        concerns: row.concerns,
        ingredients: row.ingredients,
        summary: row.summary,
        source: row.source,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const res = await query(
      `DELETE FROM skin_scans WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, DEMO_USER_ID]
    );
    if (!res.rowCount) {
      return Response.json({ error: "Scan not found" }, { status: 404 });
    }
    await query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
      [DEMO_USER_ID, "Scan deleted", "A skin scan was removed from your history."]
    );
    return Response.json({ ok: true, id });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
