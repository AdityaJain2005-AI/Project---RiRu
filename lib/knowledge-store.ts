import { query } from "./db.ts";
import { embeddingProviderFromEnv, type EmbeddingProvider } from "./embeddings.ts";
import {
  contentHash,
  loadKnowledgePack,
  type KnowledgeChunk,
} from "./knowledge.ts";

type ChunkRow = {
  chunk_key: string;
  heading: string;
  source: string;
  topic: string;
  content: string;
  embedding_fallback: number[] | null;
};

export async function vectorColumnExists(): Promise<boolean> {
  const found = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'`
  );
  return Boolean(found.rowCount);
}

export async function ingestKnowledge(embed: EmbeddingProvider = embeddingProviderFromEnv()): Promise<number> {
  const chunks = loadKnowledgePack();
  const vectors = await embed.embed(chunks.map((chunk) => `${chunk.title}\n${chunk.content}`));
  const hasVector = await vectorColumnExists();
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vector = vectors[i] ?? [];
    await query(
      `INSERT INTO knowledge_chunks
         (chunk_key, source, heading, topic, last_reviewed, content, content_hash, embedding_fallback)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8::float8[])
       ON CONFLICT (chunk_key) DO UPDATE SET
         source = EXCLUDED.source,
         heading = EXCLUDED.heading,
         topic = EXCLUDED.topic,
         last_reviewed = EXCLUDED.last_reviewed,
         content = EXCLUDED.content,
         content_hash = EXCLUDED.content_hash,
         embedding_fallback = EXCLUDED.embedding_fallback`,
      [
        chunk.id,
        chunk.source,
        chunk.title,
        chunk.topic,
        chunk.lastReviewed,
        chunk.content,
        contentHash(chunk.content),
        vector,
      ]
    );
    if (hasVector) {
      const literal = `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`;
      await query(
        `UPDATE knowledge_chunks SET embedding = $2::vector WHERE chunk_key = $1`,
        [chunk.id, literal]
      );
    }
  }
  return chunks.length;
}

export async function loadStoredChunks(): Promise<KnowledgeChunk[]> {
  const rows = await query<ChunkRow>(
    `SELECT chunk_key, heading, source, topic, content, embedding_fallback
     FROM knowledge_chunks
     WHERE chunk_key IS NOT NULL
     ORDER BY chunk_key ASC
     LIMIT 500`
  );
  return rows.rows.map((row) => ({
    id: row.chunk_key,
    title: row.heading,
    source: row.source,
    topic: row.topic,
    lastReviewed: "",
    content: row.content,
    embedding: Array.isArray(row.embedding_fallback) ? row.embedding_fallback.map(Number) : [],
  }));
}
