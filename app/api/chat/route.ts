import { cosmetologistReply, chatSystemPrompt, type ProductContext } from "@/lib/chat-engine";
import { DEMO_USER_ID, query } from "@/lib/db";
import type { ScanPayload } from "@/lib/scan-engine";
import { explainIngredients, extractChatIngredients, type IngredientDetail } from "@/lib/ocr";

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

    const productRes = await query<{
      ingredients: string[] | string;
      details: IngredientDetail[] | string;
    }>(
      `SELECT ingredients, details FROM product_scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [DEMO_USER_ID]
    ).catch(() => ({ rows: [] as { ingredients: string[]; details: IngredientDetail[] }[] }));

    const prow = productRes.rows[0];
    const chatHistory = await query<{ role: string; content: string }>(
      `SELECT role, content FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 100`,
      [DEMO_USER_ID]
    );
    const parseJson = <T,>(v: unknown, fallback: T): T => {
      if (v == null) return fallback;
      if (typeof v === "string") {
        try {
          return JSON.parse(v) as T;
        } catch {
          return fallback;
        }
      }
      return v as T;
    };
    const prefsRes = await query<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM user_prefs WHERE user_id = $1`,
      [DEMO_USER_ID]
    );
    const excluded = new Set(
      Array.isArray(prefsRes.rows[0]?.settings?.excludedIngredients)
        ? (prefsRes.rows[0].settings.excludedIngredients as unknown[]).map((n) => String(n).toLowerCase())
        : []
    );
    const ocrIngredients = prow
      ? parseJson<string[]>(prow.ingredients, []).filter((n) => !excluded.has(n.toLowerCase()))
      : [];
    const ocrDetails = prow
      ? parseJson<IngredientDetail[]>(prow.details, []).filter((d) => !excluded.has(d.name.toLowerCase()))
      : [];
    const chatAdded = chatHistory.rows.flatMap((m) =>
      m.role === "user"
        ? extractChatIngredients(m.content).filter((n) => !excluded.has(n.toLowerCase()))
        : []
    );
    const mergedNames = [...new Set([...ocrIngredients, ...chatAdded])];
    const chatDetails = explainIngredients(chatAdded);
    const detailByName = new Map(
      [...ocrDetails, ...chatDetails].map((d) => [d.name.toLowerCase(), d])
    );
    const product: ProductContext | null = mergedNames.length
      ? {
          ingredients: mergedNames,
          details: mergedNames.map((name) =>
            detailByName.get(name.toLowerCase()) ?? explainIngredients([name])[0]
          ),
        }
      : null;

    let reply = cosmetologistReply(text, scan, product);
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
                content: chatSystemPrompt(scan, product),
              },
              {
                role: "user",
                content: text,
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
