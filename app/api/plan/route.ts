import { cosmetologistReply } from "@/lib/chat-engine";
import { DEMO_USER_ID, query } from "@/lib/db";
import type { ScanPayload } from "@/lib/scan-engine";
import { ROUTINE } from "@/lib/scan-engine";

export const dynamic = "force-dynamic";

/** Build a treatment plan for a concern and persist as chat + notification. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      concernId?: string;
      concernTitle?: string;
      zone?: string;
    };

    const scanRes = await query<{
      overall_score: number;
      metrics: ScanPayload["metrics"];
      concerns: ScanPayload["concerns"];
      ingredients: ScanPayload["ingredients"];
      summary: string;
      source: string;
    }>(
      `SELECT overall_score, metrics, concerns, ingredients, summary, source
       FROM skin_scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [DEMO_USER_ID]
    );
    const row = scanRes.rows[0];
    const concerns = (row?.concerns ?? []) as ScanPayload["concerns"];
    const concern =
      concerns.find((c) => c.id === body.concernId) ||
      concerns.find((c) => c.title === body.concernTitle) ||
      concerns[0];

    const title = concern?.title ?? body.concernTitle ?? "skin concern";
    const zone = concern?.zone ?? body.zone ?? "face";
    const ings = (row?.ingredients ?? []) as ScanPayload["ingredients"];
    const top = ings.slice(0, 3).map((i) => i.name);

    const steps = [
      `Target: ${title} (${zone})`,
      `AM: ${ROUTINE.am.map((s) => s.name).join(" → ")}`,
      `PM: ${ROUTINE.pm.map((s) => s.name).join(" → ")}`,
      top.length
        ? `Priority actives: ${top.join(", ")}`
        : "Priority: barrier repair + daily SPF",
      "Re-scan in 7 days to measure change.",
    ];

    const planText = steps.join("\n");
    const userLine = `Build a treatment plan for ${title} on my ${zone}.`;
    const scan: ScanPayload | null = row
      ? {
          overallScore: row.overall_score,
          metrics: row.metrics,
          concerns: row.concerns,
          ingredients: row.ingredients,
          summary: row.summary,
          source: (row.source as ScanPayload["source"]) ?? "camera",
          streakDays: 0,
        }
      : null;

    const aiText =
      cosmetologistReply(userLine, scan) +
      "\n\n**Your plan**\n" +
      steps.map((s, i) => `${i + 1}. ${s}`).join("\n");

    await query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'user', $2), ($1, 'ai', $3)`,
      [DEMO_USER_ID, userLine, aiText]
    );
    await query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
      [
        DEMO_USER_ID,
        `Plan: ${title}`,
        `Treatment plan saved to chat. Focus on ${zone} this week.`,
      ]
    );

    return Response.json({
      ok: true,
      plan: { title, zone, steps, text: planText },
      message: aiText,
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Plan failed" },
      { status: 500 }
    );
  }
}
