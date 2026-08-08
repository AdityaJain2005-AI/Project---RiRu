import { cosmetologistReply } from "@/lib/chat-engine";
import { DEMO_USER_ID, query } from "@/lib/db";
import type { ScanPayload } from "@/lib/scan-engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string };
    const text = (body.message ?? "").trim();
    if (!text) {
      return Response.json({ error: "Message required" }, { status: 400 });
    }

    await query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'user', $2)`,
      [DEMO_USER_ID, text]
    );

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

    // Optional SpaceXAI / xAI if key present; otherwise rule engine.
    let reply = cosmetologistReply(text, scan);
    const apiKey = process.env.XAI_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "grok-4-1-fast-non-reasoning",
            messages: [
              {
                role: "system",
                content:
                  "You are Facelab AI Cosmetologist. Short practical skincare advice. Use the user's latest scan scores when provided. No medical diagnosis.",
              },
              {
                role: "user",
                content: `Latest scan: ${JSON.stringify(scan)}\n\nUser: ${text}`,
              },
            ],
            temperature: 0.5,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) reply = content;
        }
      } catch {
        // fall back to rule engine
      }
    }

    const aiInsert = await query<{ id: string; created_at: string }>(
      `INSERT INTO chat_messages (user_id, role, content)
       VALUES ($1, 'ai', $2) RETURNING id, created_at`,
      [DEMO_USER_ID, reply]
    );

    return Response.json({
      ok: true,
      message: {
        id: aiInsert.rows[0].id,
        role: "ai" as const,
        text: reply,
        createdAt: aiInsert.rows[0].created_at,
      },
      provider: apiKey ? "xai" : "rules",
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
