import { DEMO_USER_ID, query } from "@/lib/db";
import { ROUTINE } from "@/lib/scan-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userRes = await query<{
      id: string;
      name: string;
      initials: string;
      skin_type: string;
      streak_days: number;
    }>(`SELECT id, name, initials, skin_type, streak_days FROM users WHERE id = $1`, [
      DEMO_USER_ID,
    ]);
    const user = userRes.rows[0];
    if (!user) {
      return Response.json({ error: "User not found — run migrations" }, { status: 500 });
    }

    const scanRes = await query<{
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
       FROM skin_scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [DEMO_USER_ID]
    );
    const scan = scanRes.rows[0] ?? null;

    const historyRes = await query<{ overall_score: number; created_at: string }>(
      `SELECT overall_score, created_at FROM skin_scans
       WHERE user_id = $1 ORDER BY created_at ASC LIMIT 14`,
      [DEMO_USER_ID]
    );

    const chatRes = await query<{ id: string; role: string; content: string; created_at: string }>(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = $1 ORDER BY created_at ASC LIMIT 50`,
      [DEMO_USER_ID]
    );

    const prefsRes = await query<{
      routine_phase: string;
      favorite_ingredients: string[];
      settings: Record<string, unknown>;
    }>(
      `SELECT routine_phase, favorite_ingredients, settings FROM user_prefs WHERE user_id = $1`,
      [DEMO_USER_ID]
    );
    const prefs = prefsRes.rows[0] ?? {
      routine_phase: "am",
      favorite_ingredients: [],
      settings: {},
    };

    const notifRes = await query<{
      id: string;
      title: string;
      body: string;
      read: boolean;
      created_at: string;
    }>(
      `SELECT id, title, body, read, created_at FROM notifications
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [DEMO_USER_ID]
    );

    const favorites = Array.isArray(prefs.favorite_ingredients)
      ? prefs.favorite_ingredients
      : [];

    const ingredients = ((scan?.ingredients as { name: string }[]) ?? []).map((ing) => ({
      ...ing,
      favorited: favorites.includes(ing.name),
    }));

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        initials: user.initials,
        skinType: user.skin_type,
        streakDays: user.streak_days,
      },
      scan: scan
        ? {
            id: scan.id,
            overallScore: scan.overall_score,
            metrics: scan.metrics,
            concerns: scan.concerns,
            ingredients,
            summary: scan.summary,
            source: scan.source,
            createdAt: scan.created_at,
            lastScanLabel: formatScanTime(scan.created_at),
          }
        : null,
      history: historyRes.rows.map((h) => ({
        score: h.overall_score,
        date: h.created_at,
      })),
      messages: chatRes.rows.map((m) => ({
        id: m.id,
        role: m.role as "user" | "ai",
        text: m.content,
        createdAt: m.created_at,
      })),
      prefs: {
        routinePhase: prefs.routine_phase as "am" | "pm",
        favorites,
        settings: prefs.settings ?? {},
      },
      routine: ROUTINE,
      notifications: notifRes.rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load dashboard" },
      { status: 500 }
    );
  }
}

function formatScanTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today · ${time}` : `${d.toLocaleDateString()} · ${time}`;
}
