-- Phase 5 knowledge metadata. Safe to re-run.
-- The vector column and HNSW index stay in migrate.js, which skips them
-- when CREATE EXTENSION vector fails.

ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_key text;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT '';
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS last_reviewed date;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_chunk_key_key
  ON knowledge_chunks (chunk_key);
