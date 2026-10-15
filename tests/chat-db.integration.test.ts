import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { ingestKnowledge } from "../lib/knowledge-store.ts";
import { MockEmbeddingProvider } from "../lib/embeddings.ts";

const live = process.env.RIRU_INTEGRATION === "1";

function dbConfig() {
  return {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? "riru",
    password: process.env.DB_PASS ?? "riru",
    database: process.env.DB_NAME ?? "riru",
  };
}

test(
  "ingested notes answer a sunscreen question from Postgres",
  { skip: live ? false : "set RIRU_INTEGRATION=1 with Postgres and the dev server" },
  async () => {
    process.env.EMBEDDINGS_PROVIDER = "mock";
    const stored = await ingestKnowledge(new MockEmbeddingProvider());
    assert.ok(stored >= 8);

    const base = process.env.RIRU_BASE_URL ?? "http://127.0.0.1:3000";
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "How much sunscreen should I apply on my face?",
        includeProfile: false,
      }),
    });
    const body = (await res.json()) as {
      sessionId?: string;
      message?: { text?: string; citations?: { id: string }[] };
      error?: string;
    };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.match(body.message?.text ?? "", /Informational only, not a medical diagnosis/);
    assert.ok(body.message?.citations?.some((item) => item.id === "sunscreen-amount"));

    const pool = new pg.Pool(dbConfig());
    try {
      const chunk = await pool.query<{ chunk_key: string; dims: number }>(
        `SELECT chunk_key, cardinality(embedding_fallback) AS dims
         FROM knowledge_chunks WHERE chunk_key = 'sunscreen-amount'`
      );
      assert.equal(chunk.rows[0]?.chunk_key, "sunscreen-amount");
      assert.equal(Number(chunk.rows[0]?.dims), 384);

      const message = await pool.query<{ citations: { id: string }[] | null }>(
        `SELECT citations FROM chat_messages
         WHERE session_id = $1 AND role = 'ai'
         ORDER BY created_at DESC LIMIT 1`,
        [body.sessionId]
      );
      assert.ok(message.rows[0]?.citations?.some((item) => item.id === "sunscreen-amount"));
    } finally {
      await pool.end();
    }
  }
);
