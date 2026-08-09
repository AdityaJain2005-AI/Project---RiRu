import { DEMO_USER_ID, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await query<{
      id: string;
      overall_score: number;
      summary: string;
      source: string;
      metrics: { id: string; label: string; score: number }[];
      created_at: string;
    }>(
      `SELECT id, overall_score, summary, source, metrics, created_at
       FROM skin_scans WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 40`,
      [DEMO_USER_ID]
    );

    return Response.json({
      scans: res.rows.map((r) => ({
        id: r.id,
        overallScore: r.overall_score,
        summary: r.summary,
        source: r.source,
        metrics: r.metrics,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
