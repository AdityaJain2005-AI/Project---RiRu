import { DISCLAIMER } from "@riru/shared";
import { requireActor } from "@/lib/actor";
import { query } from "@/lib/db";
import { embeddingProviderFromEnv } from "@/lib/embeddings";
import { loadIngredientData } from "@/lib/ingredient-catalog";
import {
  answerChat,
  emptyProfile,
  MAX_CHAT_CHARS,
  PROFILE_CONTEXT_SQL,
  RECOVERY_FLAG_SQL,
  SCAN_SUMMARY_SQL,
  profileContext,
  type Citation,
} from "@/lib/knowledge";
import { llmProviderFromEnv, type ChatTurn } from "@/lib/llm";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { IngredientProfile } from "@riru/shared";

export const dynamic = "force-dynamic";

type HistoryRow = { role: string; content: string };

export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const userId = actor.userId;

    const limited = await consumeRateLimit(userId, "chat", 30, 3_600);
    if (!limited.ok) return rateLimitResponse(limited, "Too many messages this hour.");

    const body = (await req.json().catch(() => null)) as {
      message?: string;
      sessionId?: string;
      includeProfile?: boolean;
      stream?: boolean;
    } | null;
    const text = (body?.message ?? "").trim();
    if (!text) return Response.json({ error: "Message required" }, { status: 400 });
    if (text.length > MAX_CHAT_CHARS) {
      return Response.json({ error: "Message is too long." }, { status: 400 });
    }

    const llm = llmProviderFromEnv();
    if (!llm.configured()) {
      return Response.json({ error: "Chat is not configured." }, { status: 503 });
    }

    const sessionId = await ensureSession(userId, body?.sessionId ?? null, text);
    const history = await loadHistory(sessionId);
    await query(
      `INSERT INTO chat_messages (user_id, session_id, role, content) VALUES ($1, $2, 'user', $3)`,
      [userId, sessionId, text]
    );
    const includeProfile = body?.includeProfile === true;
    const profile = includeProfile ? await loadProfile(userId) : emptyProfile();
    const profileNote = includeProfile ? await loadProfileNote(userId) : null;
    let catalog;
    let pack;
    try {
      const loaded = loadIngredientData();
      catalog = loaded.catalog;
      pack = loaded.pack;
    } catch {
      return Response.json({ error: "The ingredient rules are not available." }, { status: 500 });
    }

    const { loadStoredChunks } = await import("@/lib/knowledge-store");
    const chunks = await loadStoredChunks();
    const answer = await answerChat({
      message: text,
      history,
      chunks,
      catalog,
      pack,
      profile,
      profileNote,
      embed: embeddingProviderFromEnv(),
      llm,
    });

    const saved = await query<{ id: string; created_at: string }>(
      `INSERT INTO chat_messages (user_id, session_id, role, content, citations)
       VALUES ($1, $2, 'ai', $3, $4::jsonb)
       RETURNING id, created_at`,
      [userId, sessionId, answer.text, JSON.stringify(answer.citations)]
    );
    await query(`UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 AND user_id = $2`, [
      sessionId,
      userId,
    ]);

    const payload = {
      ok: true,
      sessionId,
      provider: llm.name,
      disclaimer: DISCLAIMER,
      message: {
        id: saved.rows[0].id,
        role: "ai" as const,
        text: answer.text,
        createdAt: saved.rows[0].created_at,
        citations: answer.citations,
        followUps: answer.followUps,
        unsure: answer.unsure,
      },
    };

    if (body?.stream === true || req.headers.get("accept")?.includes("text/event-stream")) {
      return streamAnswer(payload.message.text, payload);
    }
    return Response.json(payload);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/chat", name: err instanceof Error ? err.name : "Error" }));
    return Response.json({ error: "Chat failed" }, { status: 500 });
  }
}

function streamAnswer(
  text: string,
  payload: {
    sessionId: string;
    provider: string;
    disclaimer: string;
    message: {
      id: string;
      text: string;
      citations: Citation[];
      followUps: string[];
      unsure: boolean;
    };
  }
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const parts = text.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of parts) send("token", { text: part });
      send("citation", { citations: payload.message.citations });
      send("followups", { followUps: payload.message.followUps });
      send("done", {
        sessionId: payload.sessionId,
        provider: payload.provider,
        disclaimer: payload.disclaimer,
        messageId: payload.message.id,
        unsure: payload.message.unsure,
      });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

async function ensureSession(userId: string, requested: string | null, title: string): Promise<string> {
  if (requested && /^[0-9a-f-]{36}$/i.test(requested)) {
    const found = await query<{ id: string }>(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [requested, userId]
    );
    if (found.rows[0]) return found.rows[0].id;
  }
  const created = await query<{ id: string }>(
    `INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id`,
    [userId, title.slice(0, 80)]
  );
  return created.rows[0].id;
}

async function loadHistory(sessionId: string): Promise<ChatTurn[]> {
  const rows = await query<HistoryRow>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1 AND role IN ('user', 'ai')
     ORDER BY created_at DESC LIMIT 6`,
    [sessionId]
  );
  return rows.rows.reverse().map((row) => ({
    role: row.role === "ai" ? "assistant" : "user",
    content: row.content,
  }));
}

async function loadProfile(userId: string): Promise<IngredientProfile> {
  const profile = emptyProfile();
  const row = await query<{
    pregnant_or_feeding: boolean;
    fragrance_sensitive: boolean;
    self_described_sensitive: boolean;
    allergies: unknown;
  }>(PROFILE_CONTEXT_SQL, [userId]);
  const found = row.rows[0];
  if (!found) return profile;
  const recovery = await query<{ active: boolean }>(RECOVERY_FLAG_SQL, [userId]);
  return {
    pregnantOrFeeding: found.pregnant_or_feeding,
    fragranceSensitive: found.fragrance_sensitive,
    selfDescribedSensitive: found.self_described_sensitive,
    recoveryActive: Boolean(recovery.rows[0]?.active),
    allergies: Array.isArray(found.allergies) ? found.allergies.filter((item) => typeof item === "string") : [],
  };
}

async function loadProfileNote(userId: string): Promise<string> {
  const row = await query<{
    pregnant_or_feeding: boolean;
    fragrance_sensitive: boolean;
    allergies: unknown;
  }>(
    `SELECT pregnant_or_feeding, fragrance_sensitive, allergies FROM profiles WHERE user_id = $1`,
    [userId]
  );
  const scan = await query<{ summary: string | null }>(SCAN_SUMMARY_SQL, [userId]);
  const found = row.rows[0];
  return profileContext({
    pregnantOrFeeding: Boolean(found?.pregnant_or_feeding),
    fragranceSensitive: Boolean(found?.fragrance_sensitive),
    allergies: Array.isArray(found?.allergies)
      ? found.allergies.filter((item) => typeof item === "string")
      : [],
    scanSummary: scan.rows[0]?.summary ?? null,
  });
}
