import { DEMO_USER_ID, query } from "@/lib/db";
import { generateScan } from "@/lib/scan-engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      source?: "camera" | "upload";
      fileName?: string;
      /** Optional data URL or note that a live frame was captured */
      captured?: boolean;
      imageMeta?: { width?: number; height?: number; bytes?: number };
    };
    const source = body.source === "upload" ? "upload" : "camera";

    const prevRes = await query<{ metrics: { id: string; score: number }[] }>(
      `SELECT metrics FROM skin_scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [DEMO_USER_ID]
    );
    const prevMap: Record<string, number> = {};
    for (const m of prevRes.rows[0]?.metrics ?? []) {
      prevMap[m.id] = m.score;
    }

    const payload = generateScan(source, prevMap);

    const insert = await query<{ id: string; created_at: string }>(
      `INSERT INTO skin_scans
         (user_id, overall_score, metrics, concerns, ingredients, summary, source)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
       RETURNING id, created_at`,
      [
        DEMO_USER_ID,
        payload.overallScore,
        JSON.stringify(payload.metrics),
        JSON.stringify(payload.concerns),
        JSON.stringify(payload.ingredients),
        payload.summary,
        source,
      ]
    );

    await query(
      `UPDATE users SET streak_days = streak_days + 1, updated_at = NOW() WHERE id = $1`,
      [DEMO_USER_ID]
    );

    const title =
      source === "upload"
        ? `Photo analyzed${body.fileName ? `: ${body.fileName}` : ""}`
        : body.captured
          ? "Live camera scan complete"
          : "New face scan complete";

    await query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
      [
        DEMO_USER_ID,
        title,
        `Skin score ${payload.overallScore}. ${payload.summary}${
          body.imageMeta?.width
            ? ` · frame ${body.imageMeta.width}×${body.imageMeta.height}`
            : ""
        }`,
      ]
    );

    await query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'ai', $2)`,
      [
        DEMO_USER_ID,
        `Scan saved (${source}). Overall ${payload.overallScore}. ${payload.summary}`,
      ]
    );

    return Response.json({
      ok: true,
      scan: {
        id: insert.rows[0].id,
        overallScore: payload.overallScore,
        metrics: payload.metrics,
        concerns: payload.concerns,
        ingredients: payload.ingredients,
        summary: payload.summary,
        source,
        createdAt: insert.rows[0].created_at,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
